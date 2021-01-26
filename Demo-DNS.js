// The regular expression keyword in domain name.
const domain = /hursing/
// When keyword matched, resolve to this IP.
const targetIp = '127.0.0.1'
// When keyword not matched, use the fallback dns server to resolve.
const fallbackServer = '114.114.114.114'

const dgram = require('dgram')

const server = dgram.createSocket('udp4')

function copyBuffer(src, offset, dst) {
  for (let i = 0; i < src.length; ++i) {
    dst.writeUInt8(src.readUInt8(i), offset + i)
  }
}

function resolve(msg, rinfo) {
  const queryInfo = msg.slice(12)
  const response = Buffer.alloc(28 + queryInfo.length)
  let offset = 0
  const id = msg.slice(0, 2)
  copyBuffer(id, 0, response)  // Transaction ID
  offset += id.length
  response.writeUInt16BE(0x8180, offset)  // Flags
  offset += 2
  response.writeUInt16BE(1, offset)  // Questions
  offset += 2
  response.writeUInt16BE(1, offset)  // Answer RRs
  offset += 2
  response.writeUInt32BE(0, offset)  // Authority RRs & Additional RRs
  offset += 4
  copyBuffer(queryInfo, offset, response)
  offset += queryInfo.length
  response.writeUInt16BE(0xC00C, offset)  // offset to domain name
  offset += 2
  const typeAndClass = msg.slice(msg.length - 4)
  copyBuffer(typeAndClass, offset, response)
  offset += typeAndClass.length
  response.writeUInt32BE(600, offset)  // TTL, in seconds
  offset += 4
  response.writeUInt16BE(4, offset)  // Length of IP
  offset += 2
  targetIp.split('.').forEach(value => {
    response.writeUInt8(parseInt(value), offset)
    offset += 1
  })
  // console.log(response.toString('hex'))
  server.send(response, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.log(err)
      server.close()
    }
  })
}

function forward(msg, rinfo) {
  const client = dgram.createSocket('udp4')
  client.on('error', (err) => {
    console.log(`client error:\n${err.stack}`)
    client.close()
  })
  client.on('message', (fbMsg, fbRinfo) => {
    server.send(fbMsg, rinfo.port, rinfo.address, (err) => {
      err && console.log(err)
    })
    client.close()
  })
  client.send(msg, 53, fallbackServer, (err) => {
    if (err) {
      console.log(err)
      client.close()
    }
  })
}

function parseHost(msg) {
  let num = msg.readUInt8(0)
  let offset = 1
  let host = ""
  while (num !== 0) {
    host += msg.slice(offset, offset + num).toString()
    offset += num
    num = msg.readUInt8(offset)
    offset += 1
    if (num !== 0) {
      host += '.'
    }
  }
  return host
}

server.on('message', (msg, rinfo) => {
  // console.log(msg.toString('hex'))
  const host = parseHost(msg.slice(12))
  console.log(`receive query: ${host}`)
  if (domain.test(host)) {
    resolve(msg, rinfo)
  } else {
    forward(msg, rinfo)
  }
})

server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`)
  server.close()
})

server.on('listening', () => {
  const address = server.address()
  console.log(`server listening ${address.address}:${address.port}`)
})

// On linux or Mac, run node with sudo. Because port 53 is lower then 1024.
server.bind(5666)
