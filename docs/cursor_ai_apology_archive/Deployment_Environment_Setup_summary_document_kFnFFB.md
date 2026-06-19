# Deployment and Environment Setup Guide - summary document [kFnFFB]

to use HuTiGong `<content>` ( BuShu and HuanJingSheZhiZhiNan ) JianMing summary . 

## structure 
- WenDangFen for 4 DaJie : 1. Initial Environment Setup (Windows/Linux) ; 2. Application-Specific Dependencies (DocumentOffline, Puppeteer) ; 3. Server Management and Debugging (VoiceStaticServer) ; 4. External Services and Tools (Brave, Cursor, Xata) . 

## key points 
- ** ChuShiHuanJing **: Windows use curl XiaZai and Zhi line dd.cmd; Linux use apt, dos2unix, chmod ChuLi dd.sh. 
- ** Ying use YiLai **: DocumentOffline Xu iconv-lite, jsdom; Puppeteer XuXiangGuanBao . 
- ** FuWuGuanLi **: VoiceStaticServer TongGuo systemctl QiTing ; ZhiChi --client, --server, --rebuildmaindb; BuShuLuJing /www/wwwroot/core_node. 
- ** WaiBuFuWu **: Brave Search API, Cursor LianJie , Xata PostgreSQL/HTTP and CLI. 

## purpose 
GongKaiFaZheWanChengCongXiTongHuanJing , Ying use YiLai , FuWuTiaoShi to WaiBuFuWu WanZhengBuShu and config . 
