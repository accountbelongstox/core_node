# VoiceStaticServer watch config - summary document 

to use HuTiGong `<content>` (JSON config WenJian ) JianMing summary . 

## structure 
- DanCeng JSON to Xiang , Jian : watch, ignore, ext, verbose, exec, restartable, colours, events. 
- no QianTao structure , ZhiLeiXing for ShuZu , char FuChuan , BuEr or to Xiang . 

## key points 
- **watch**: JianShiLuJingLieBiao `["ncore/", "apps/", "main.js"]`, i.e. HeXin directory , Ying use directory and RuKouWenJian . 
- **ignore**: KongShuZu , not HuLveRenHeLuJing . 
- **ext**: `"js,json"`, JinJianShi js and json KuoZhanMing . 
- **verbose**: true, output XiangXiRiZhi . 
- **exec**: QiDongMingLing `node ./main.js --app=VoiceStaticServer --word_segmentation=0-30000`. 
- **restartable**: `"hr"`, KeNeng and ReZhongZai or ChongQiFangShiXiangGuan . 
- **colours**: true, ZhongDuanCaiSe output . 
- **events**: Kong to Xiang , KeKuoZhanShiJianGou sub . 

## purpose 
as WenJianJianShi / KaiFa when ZiDongChongQi config ( such as nodemon etc. GongJu ) : in ncore/, apps/ or main.js js/json BianGeng when , use ShangShu exec MingLingChongQi VoiceStaticServer, and Qi use XiangXi and CaiSe output . 
