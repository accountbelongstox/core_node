# Deployment and Environment Setup Guide - summary document [mqkeHZ]

to use HuTiGong `<content>` ( BuShu and HuanJing config ZhiNan ) JianMing summary . 

## structure 
1. Initial Environment Setup (Windows: curl XiaZai dd.cmd and Zhi line ; Linux: dos2unix + chmod +x dd.sh) . 2. Application-Specific Dependencies (DocumentOffline: iconv-lite, jsdom; Puppeteer XiangGuanBao ) . 3. Server Management and Debugging (VoiceStaticServer TingZhi / to client/server or MoRenYun line , KuaiSuChongQi , --server/--rebuildmaindb, BuShuMingLing ) . 4. External Services (Brave Search API, Cursor LianJie , Xata.io LianJie and CLI use Fa ) . 

## key points 
- HuanJing : dd.cmd (Windows) , dd.sh (Linux) for ChuShiRuKou . 
- Ying use YiLai : AnYing use yarn add. 
- VoiceStaticServer: systemctl GuanLi ; node main.js --app=VoiceStaticServer ZhiChi --client, --server, --rebuildmaindb, --service. 
- Xata: TiGongLianJie char FuChuan and CLI (npm install @xata.io/cli, xata init, getXataClient) ShiLi . 

## purpose 
for KaiFaHuanJingZhunBei , Ying use YiLaiAnZhuang , VoiceStaticServer BuShu and TiaoShi and Brave/Xata etc. WaiBuFuWu config TiGong step note . 
