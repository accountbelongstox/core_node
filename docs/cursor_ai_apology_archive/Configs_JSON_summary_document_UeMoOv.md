# Configs JSON ( DuoYing use config ) - summary document [UeMoOv]

to use HuTiGong `<content>` ( Han configs ShuZu and version JSON config ) JianMing summary . 

## structure 
- DingCeng : `configs` ( to XiangShuZu ) , `version` ( such as "202111020001") . 
- every item ChangJian char segment : appName, data, effectStrategy (launch/realtime) , type (builtin/normal) , version; BuFenHan appId, instanceId. 
- data because Ying use not Tong and structure not Tong . 

## key points 
- **base**: strategy (foreground, launch, minFetchSeconds, pushTrigger, sessionSeconds) . 
- **app_block**: androidBlockList, iosBlockList, schemeMapping (jd/taobao/zhihu/weibo) , whiteList, chinaDefaultValue. 
- **ads_block**: videoAds.enable. 
- **reading_view**: blockList, whiteList, textLengthThreshold. 
- **lightning**: upsellEnable (existingUser/newUser/favoriteHub/formAutofill) . 
- **bingviz**: telemetry_domain (china, default, market_check_url) . 
- **sydchat / discoverchat**: androidEnable, iOSEnable, regionBlockList (CN/RU/KP) , requiredWaitList, launchMode (sydchat) . 
- **add_topsite, app_selfupdate, topsites, dma, darkmode, beta_enrollment, growthEngine**: GeHanKaiGuan , Ban this , HeiMingDan or campaign etc. . effectStrategy QuFenQiDong when ShengXiao (launch) and Shi when ShengXiao (realtime) . 

## purpose 
as DuoYing use ( such as LiuLanQi / KeHuDuan ) TongYi config Yuan , use at GongNengKaiGuan , Ying use / YuMingHeiMingDan , scheme YingShe , YaoCe , QuYuXianZhi , upsell and ZengZhangHuoDong etc. . 
