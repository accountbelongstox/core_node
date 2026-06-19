# Watch/Exec JSON config - summary document [mMMhLw]

to use HuTiGong `<content>` ( WenJianJianShi and Zhi line use JSON config ) JianMing summary . 

## structure 
DanCeng JSON to Xiang , char segment YiCi for : watch ( ShuZu ) , ignore ( ShuZu ) , ext ( char FuChuan ) , verbose ( BuEr ) , exec ( char FuChuan ) , restartable ( char FuChuan ) , colours ( BuEr ) , events ( to Xiang ) . 

## key points 
- **watch**: JianTingLuJing `ncore/`, `apps/`, `main.js`. 
- **ignore**: KongShuZu , not HuLveRenHeLuJing . 
- **ext**: `"js,json"`, JinZhen to js and json KuoZhanMingChuFa . 
- **verbose**: true, output XiangXiRiZhi . 
- **exec**: QiDongMingLing `node ./main.js --app=VoiceStaticServer --word_segmentation=0-30000`, i.e. to VoiceStaticServer Ying use , FenCiFanWei 030000 Yun line main.js. 
- **restartable**: `"hr"`, TongChangBiaoShiReZhongZai or ChongQiFangShi ( YiJuTiGongJu and Ding ) . 
- **colours**: true, ZhongDuanCaiSe output . 
- **events**: Kong to Xiang , KeKuoZhanShiJianGou sub . 

## purpose 
as nodemon or LeiSiKaiFaGongJu config WenJian , in ncore/, apps/, main.js etc. BianGeng when ZiDongChongQi and Zhi line ShangShu node MingLing , use at KaiFaQi VoiceStaticServer this Yun line and TiaoShi . 
