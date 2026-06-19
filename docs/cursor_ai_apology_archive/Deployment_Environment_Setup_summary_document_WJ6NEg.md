# Deployment and Environment Setup Guide - summary document [WJ6NEg]

to use HuTiGong `<content>` ( BuShu and HuanJing config ZhiNan ) JianMing summary . 

## structure 
- **1. Initial Environment Setup**: Windows use curl XiaZai dd.cmd and Zhi line ; Linux AnZhuang dos2unix, to dd.sh Zhi line dos2unix and chmod +x, or use to Chu Yi line MingLing . 
- **2. Application-Specific Dependencies**: DocumentOffline Xu yarn add iconv-lite jsdom; Puppeteer Xu puppeteer, puppeteer-extra, puppeteer-extra-plugin-stealth, @puppeteer/browsers, user-agents. 
- **3. Server Management and Debugging**: TingZhi VoiceStaticServer-node.service Hou to --client/--server or MoRenMoShiYun line main.js; KuaiSuChongQi for git pull + systemctl restart; CanShuHan --server, --rebuildmaindb; BuShuMingLingHan --service --server + systemctl restart. 
- **4. External Services and Tools**: Brave Search API MiYaoLianJie ; Cursor XiangGuanCangKuLianJie ; Xata.io PostgreSQL/HTTP DuanDian and API Key, CLI AnZhuang , xata init, getXataClient ChaXunShiLi . 

## key points 
- HuanJing : dd.cmd (Windows) , dd.sh (Linux) for ChuShiJiao this RuKou . 
- Ying use YiLai : AnYing use FenBie yarn add. 
- VoiceStaticServer: systemctl GuanLiFuWu ; node main.js --app=VoiceStaticServer ZhiChi --client, --server, --rebuildmaindb, --service. 
- Xata: TiGongLianJie char FuChuan and CLI use step . 

## purpose 
for KaiFaHuanJingZhunBei , Ying use YiLaiAnZhuang , VoiceStaticServer BuShu and TiaoShi and Brave/Xata etc. WaiBuFuWu config TiGong step note . 
