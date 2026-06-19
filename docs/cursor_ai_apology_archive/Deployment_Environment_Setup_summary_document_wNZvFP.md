# Deployment and Environment Setup Guide - summary document [wNZvFP]

to use HuTiGong `<content>` ( BuShu and HuanJingSheZhiZhiNan ) JianMing summary . 

## structure 
- WenDangFen for 4 DaJie : 1. Initial Environment Setup (Windows/Linux) ; 2. Application-Specific Dependencies (DocumentOffline, Puppeteer) ; 3. Server Management and Debugging (VoiceStaticServer) ; 4. External Services and Tools (Brave, Cursor, Xata) . 

## key points 
- ** ChuShiHuanJing **: Windows use `curl` XiaZai and Zhi line `dd.cmd`; Linux use `apt`, `dos2unix`, `chmod +x` ChuLi `dd.sh`. 
- ** Ying use YiLai **: DocumentOffline Xu `iconv-lite`, `jsdom`; Puppeteer Xu `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth` etc. . 
- ** FuWuGuanLi **: VoiceStaticServer TongGuo systemctl QiTing ; ZhiChi `--client`, `--server`, `--rebuildmaindb`; BuShuLuJing `/www/wwwroot/core_node`, KuaiSuChongQiHan `git pull` + systemctl restart. 
- ** WaiBuFuWu **: Brave Search API MiYaoLianJie ; Cursor XiangGuanCangKuLianJie ; Xata TiGong PostgreSQL/HTTP DuanDian and API Key, CLI AnZhuang , `xata init`, DuJiLuShiLi . 

## purpose 
GongKaiFaZheWanChengCongXiTongHuanJing , Ying use YiLai , FuWuTiaoShi to WaiBuFuWu (Brave, Cursor, Xata) WanZhengBuShu and config . 
