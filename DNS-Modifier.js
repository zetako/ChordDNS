const logSys=require('./log_sys');
var chord=require('./Demo-Chord');
const inquirer=require('inquirer');

let mainQuestions=[
    {
        type:"input",
        name:"addr.address",
        message:"The Guide Node's address: "
    },
    {
        type:"input",
        name:"addr.port",
        message:"The Guide Node's port: "
    },
    {
        type:"list",
        name:"type",
        choices:[
            {
                name:"Add",
                value:"add",
                short:"add"
            },
            {
                name:"Delete",
                value:"delete",
                short:"delete"
            },
            {
                name:"End",
                value:"end",
                short:"end"
            }
        ],
        message:"Job to do:"
    }
];
inquirer.prompt(mainQuestions).then((answer) =>{
    console.log(answer);
    let client=chord.Client((chord_from,chord_id,chord_msg,chord_reply)=>{
        if (chord_msg.type!='reply') 
        {
            logSys.writeLog('Chord','warning','Client Recv Wrong Msg');
            client.close();
        }
        else if (chord_msg.status=='invalid')
        {
            logSys.writeLog('Chord','error','Node return ERROR');
            client.close();
        }
        else
        {
            logSys.writeLog('chord','notify','Operation success');
            client.close();
        }
    });
    let question;
    switch (answer.type)
    {
    case 'add':
        logSys.writeLog('Modify','notify',`connect to guide node ${answer.addr.address}:${answer.addr.port}`);
        question=[
            {
                type:"input",
                name:"domain",
                message:"A Domain: "
            },
            {
                type:"input",
                name:"ip",
                message:"A Domain's IP: "
            }
        ];
        inquirer.prompt(question).then((subAnswer)=>{
            console.log(subAnswer);
            let chordMsg={ type:'store', status:'A', content:JSON.stringify(subAnswer)};
            client(answer.addr,subAnswer.domain,chordMsg);
        });
        break;
    case 'delete':
        logSys.writeLog('Modify','notify',`connect to guide node ${answer.addr.address}:${answer.addr.port}`);
        question=[
            {
                type:"input",
                name:"domain",
                message:"A Domain: "
            }
        ];
        inquirer.prompt(question).then((subAnswer)=>{
            console.log(subAnswer);
            let chordMsg={ type:'delete', status:'A', content:subAnswer.domain};
            client(answer.addr,subAnswer.domain,chordMsg);
        });
        break;
    case 'end':
        logSys.writeLog('Modify','notify','OK, GoodBye!');
    default:
        break;
    }
});