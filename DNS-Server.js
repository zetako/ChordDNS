/* ========== Dependency ========== */
const fs=require('fs-extra');
const db=require('better-sqlite3')('./runtime.db');
const dgram=require('dgram');
const logSys=require('./log_sys');
const server=dgram.createSocket('udp4');
var chord=require('./Demo-Chord');

/* ========== Variables ========== */
var fallbackServer='114.114.114.114';
var listeningAddr='0.0.0.0';
var listeningPort=5666;
var chordPort=5667;
var chordLocalNode=1;
var chordGuide=false;
var chordGuideAddr='127.0.0.1';
var chordGuidePort=5666;
function updateVar(pathlike)
{
    if (!fs.existsSync(pathlike)) return false;
    let config=require(pathlike);
    if (config.DNS.host!=undefined) listeningAddr=config.DNS.host;
    if (config.DNS.port!=undefined) listeningPort=config.DNS.port;
    if (config.DNS.fallback!=undefined) fallbackServer=config.DNS.fallback;
    if (config.Chord.listen!=undefined) chordPort=config.Chord.listen;
    if (config.Chord.localNum!=undefined) chordLocalNode=config.Chord.localNum;
    if (config.Chord.joinOther!=undefined) chordGuide=config.Chord.joinOther;
    if (config.Chord.host!=undefined) chordGuideAddr=config.Chord.host;
    if (config.Chord.port!=undefined) chordGuidePort=config.Chord.port;
    return true;
}
/* ========== DataBase ========== */
function writeRR(thisRR)
{
    var insertQuery=db.prepare('insert into RRs values(?,?,?,?,?,?)');
    insertQuery.run(
        thisRR.NAME,
        thisRR.TYPE,
        thisRR.CLASS,
        thisRR.TTL,
        thisRR.RDLENGTH,
        thisRR.RDATA
    );
    return;
}
/* ========== Chord Ring ========== */
function chord_message(msgType,msgStatus,msgContent)
{
    this.type=msgType;
    this.status=msgStatus;
    this.content=msgContent;
}
function chord_onMsgFunc(from,id,message,reply)//the on_message function
{
    logSys.writeLog('chord','log',`recv from ${id}, type=${message.type}`);
    switch (message.type)
    {
        case 'query':
            if (message.status!='A') break;
            let query=db.prepare("select * from RRs where TYPE='A' and NAME=?").all(message.content);
            let replyMsg;
            logSys.writeLog('DB','log',`query ${message.content} of ${query.length} record(s)`);
            if (query.length==0) replyMsg=new chord_message('reply','notfound',null);
            else replyMsg=new chord_message('reply','found',JSON.stringify(query[0]));
            reply(replyMsg);
            break;

        case 'store':
            let thisObj=JSON.parse(message.content);
            let thisRR=new RR(thisObj.domain,'A','IN',100,thisObj.ip.length,thisObj.ip);
            writeRR(thisRR);
            break;

        default:
            break;
    }
}

/* ========== deal DNS Query ========== */
function RR(RR_name,RR_type,RR_class,RR_ttl,RR_rdlength,RR_rdata)
{
    this.NAME=RR_name;
    this.TYPE=RR_type;
    this.CLASS=RR_class;
    this.TTL=RR_ttl;
    this.RDLENGTH=RR_rdlength;
    this.RDATA=RR_rdata;
}
function parseDNSQuery(buffer)
{
    let offset=2;
    let flag=buffer.readUInt16BE(offset);//the flag
    if (flag!=0x0100) return { vaild:false,value:null };
    offset+=2;
    let qdcount=buffer.readUInt16BE(offset);//question num, we only parse the 1st question
    offset+=8;
    if (qdcount<1) return { vaild:false,value:null };
    let num=buffer.readUInt8(offset);//this part's len
    offset+=1;
    let host='';
    while (num!==0)
    {
        host+=buffer.slice(offset,offset+num).toString();
        offset+=num;
        num=buffer.readUInt8(offset);
        offset+=1;
        if (num!==0) host+='.';
    }
    let queryInstance={
        vaild:true,
        value:host
    };
    return queryInstance;
}
function findRR(target,chordSend,msg,remoteInfo)
{
    let queryClient=chord.Client((chord_from,chord_id,chord_msg,chord_reply)=>{
        if (chord_msg.type!='reply')
        {
            logSys.writeLog('Chord','warning','Client Recv Wrong Msg');
            return;
        }
        if (chord_msg.status=='found')
        {
            logSys.writeLog('chord','log',`target ${target} in chord ring`);
            sendAnswer(msg,target,chord_msg.content,remoteInfo);
        }
        else if (chord_msg.status=='notfound')
        {
            logSys.writeLog('chord','log',`target ${target} not in chord ring`);
            passForward(msg,remoteInfo);
        }
    });
    let queryMsg=new chord_message('query','A',target);
    queryClient({address:'localhost',port:chordPort},target,queryMsg);
    queryClient.close();
}
function passForward(message,remoteInfo)
{
    const client=dgram.createSocket('udp4');
    client.on('error',(error)=>{
        logSys.writeLog('UDP Forward','error',`ERROR in forward UDP recv:\n${error.stack}`);
        client.close()
    });
    client.on('message',(msg,upstreamInfo)=>{
        server.send(msg,remoteInfo.port,remoteInfo.address,(error)=>{
            if (error)
                logSys.writeLog('UDP','error',`Recv form upstream but fail to send back:\n${error}`);
        });
        client.close();
    });

    client.send(message,53,fallbackServer,(err)=>{
        if (err) {
            logSys.writeLog('UDP Forward','error',`ERROR in forward UDP send:\n${error.stack}`);
            client.close();
        }
    });
}
function sendAnswer(queryMsg,queryHost,answerRR,remoteInfo)
{
    answerRR=JSON.parse(answerRR);
    /* ===== Get Buffer ===== */
    let lenHeader=12;
    
    let tmp=queryMsg.slice(12);
    let offset=0;
    let partLen=tmp.readUInt8(offset);
    while (partLen!==0)
    {
        offset=offset+1+partLen;
        partLen=tmp.readUInt8(offset);
    }
    let lenQuestion=offset+1+4;
    lenQuestion=queryMsg.length-12;

    let lenAnswer=2+2+2+4+2+4;

    let response=Buffer.alloc(lenHeader+lenQuestion+lenAnswer);

    /* ===== Header ===== */
    offset=0;
    const TransID=queryMsg.slice(0,2);
    response.writeUInt16BE(TransID.readUInt16BE(),offset);  //write Transaction ID
    offset+=2;
    response.writeUInt16BE(0x8180,offset);                  //write Flags: Standard Query
    offset+=2;  
    response.writeUInt16BE(1,offset);                       //write Number of Questions
    offset+=2;
    response.writeUInt16BE(1,offset);                       //write Number of Answer RRs
    offset+=2;
    response.writeUInt16BE(0,offset);                       //write Number of Authority RRs
    offset+=2;
    response.writeUInt16BE(0,offset);                       //write Number of Additional RRs
    offset+=2;

    /* ===== Question ===== */
    offset=12;
    for (let i=0;i<lenQuestion;i++)
    {
        response.writeUInt8(queryMsg.readUInt8(offset),offset);
        offset+=1;
    }

    /* ===== Answer ===== */
    response.writeUInt16BE(0xC00C,offset);          //write name: Pointer to domain
    offset+=2;
    response.writeUInt16BE(0x0001,offset);          //write type: A
    offset+=2;
    response.writeUInt16BE(0x0001,offset);          //write class: IN
    offset+=2;
    response.writeUInt16BE(answerRR.TTL,offset);    //write TTL
    offset+=4;
    response.writeUInt16BE(0x0004,offset);          //write length: 4
    offset+=2;
    answerRR.RDATA.split('.').forEach(value =>{          //write IP
        response.writeUInt8(parseInt(value),offset);
        offset+=1;
    });
    /* ===== Send Buffer ===== */
    server.send(response,remoteInfo.port,remoteInfo.address,(error)=>{
        if (error)
        {
            logSys.writeLog('DNS','error',`Send response to ${remoteInfo.address}:${remoteInfo.port} failed`);
        }
    });
}

/* ========== Server Part ========== */
function setupServer(pathlike)
{
    updateVar(pathlike);
    var chordServer;
    if (chordGuide)//join others
    {
        chordServer=chord.Chord(chordPort,chordLocalNode,{
                address:chordGuideAddr,
                port:chordGuidePort
            },chord_onMsgFunc);
    }
    else chordServer=chord.Chord(chordPort,chordLocalNode,chord_onMsgFunc);
    server.bind(listeningPort,listeningAddr);
    server.on('listening',()=>{
        logSys.writeLog('UDP','notify',`Server start listening: ${server.address().address}:${server.address().port}`);
    })
    server.on('message',(msg,remoteInfo)=>{
        logSys.writeLog('UDP','log','message incoming');
        const query=parseDNSQuery(Buffer.from(msg));
        if (query.vaild)//only work when parse
        {
            logSys.writeLog('DNS','notify',`receive query: ${query.value}`);
            findRR(query.value,chordServer,msg,remoteInfo);
        }
    })
    server.on('error',(error)=>{
        logSys.writeLog('UDP','error',`ERROR in UDP connect:\n${error.stack}`);
    })
}

/* ========== running ========== */
setupServer('./config.json');