# ChordDNS

Distributed DNS server with Chord Ring. Written in Node.js

Demo-DNS.js is from [hursing/dns-server](https://github.com/hursing/dns-server/blob/master/index.js)

Demo-Chord.js is from [optimizely/chord](https://github.com/optimizely/chord/blob/master/chord.js)

# 文件夹结构简介

```
18340216_张烨禧_计科八班
├── 报告.docx					//报告的docx版本
├── 报告.pdf					//报告的pdf版本（推荐阅读此版本）
├── ChordDNS				//代码，也可以在github中找到
│   ├── config.json				//服务端运行配置
│   ├── Demo-Chord.js			//Chord环的实现
│   ├── Demo-DNS.js				//参考代码：DNS服务器
│   ├── DNS-Modifier.js			//Chord环修改器
│   ├── DNS-Server.js			//服务端
│   ├── log_sys.js				//日志系统
│   ├── package.json			//npm配置
│   └── README.md				//本文档
├── README.md			//本文档
└── Report Src			//报告附件（若图片失效，可以访问）
    ├── ChordDNS-流程图.png
    ├── ChordDNS-Add.png
    ├── ChordDNS-Cache.png
    ├── ChordDNS.drawio
    ├── ChordDNS.png
    └── ChordDNS-Query.png
```

# 运行方式

1. 运行前，请确保拥有Node.js环境
2. 在ChordDNS目录下，执行`npm install`来安装依赖
3. 使用`node DNS-Server`来执行服务器
   - 修改config.json来改变一些运行时参数
4. 使用`node DNS-Modifier`来执行Chord环编辑器
   - 程序内会有引导

# 获取

在[https://github.com/zetako/ChordDNS](https://github.com/zetako/ChordDNS)获取该代码