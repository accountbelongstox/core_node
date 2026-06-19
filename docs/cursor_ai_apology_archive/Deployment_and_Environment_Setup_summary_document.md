# Deployment and Environment Setup Guide summary document 

this WenDang for to use HuTiGong <Deployment and Environment Setup Guide> within Rong JianMing summary and SuoYin , Bian at KuaiSuChaYue . 

## structure GaiLan 
- ** No. 1 BuFen **: ChuShiHuanJing (Windows: curl + dd.cmd; Linux: dos2unix + dd.sh) . 
- ** No. 2 BuFen **: Ying use YiLai (DocumentOffline: iconv-lite, jsdom; Puppeteer XiangGuanBao ) . 
- ** No. 3 BuFen **: FuWuGuanLi and TiaoShi (VoiceStaticServer systemctl, --client/--server, ChongQi and BuShuMingLing and CanShu ) . 
- ** No. 4 BuFen **: WaiBuFuWu and GongJu (Brave Search API, Cursor LianJie , Xata.io LianJie and CLI use Fa ) . 

## key points SuCha 
- HuanJingJiao this : Windows use `dd.cmd`, Linux use `dd.sh` ( Xu dos2unix) . 
- FuWuTiaoShi : Xian `systemctl stop VoiceStaticServer-node.service`, Zai to `--client` or `--server` Yun line main.js. 
- FuWuCanShu : `--server` to FuWuDuanMoShiQiDong , `--rebuildmaindb` ChongJianZhuKu . 
- Xata: TiGong PostgreSQL and HTTP DuanDian and API Key; CLI TongGuo `xata init` and ShengChengDaiMaJin line ChaXun . 

## purpose 
for core_node project TiGongCongHuanJingChuShiHua , YiLaiAnZhuang , this Ji / FuWuQiYun line and TiaoShi to WaiBu API/ ShuJuKu config YiZhanShiBuShu and HuanJingSheZhi note . 
