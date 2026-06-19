# configs JSON config summary WenDang 

this WenDang to use HuTiGong `<content>` (JSON config ) ZuoJianMing summary , Bian at ChaYue and WeiHu . 

## DingCeng structure 
- **configs**: ShuZu , every item for Yi item Ying use / GongNeng config . 
- **version**: config JiBan this , such as `"202111020001"`. 

## Dan item config Tong use char segment 
- **appName**: GongNeng or Ying use Ming . 
- **data**: JuTi config ( CeLve , MingDan , KaiGuan etc. ) , structure because app and Yi . 
- **effectStrategy**: `launch` ( QiDong when ShengXiao ) or `realtime` ( Shi when ShengXiao ) . 
- **type**: `builtin` or `normal`. 
- **version**: Gai item config Ban this . 
- **appId** / **instanceId**: BuFen config Cun in , use at BiaoShiShiLi . 

## ZhuYao config item GaiLan 
- **base**: LaQuCeLve (foreground, launch, minFetchSeconds, pushTrigger, sessionSeconds) . 
- **app_block**: Ying use / WangYeLanJie and scheme YingShe ( such as jd/taobao/zhihu/weibo) , Han androidBlockList, iosBlockList, whiteList, schemeMapping. 
- **ads_block**: ShiPinGuangGaoKaiGuan (videoAds.enable) . 
- **reading_view**: YueDuShiTu blockList/whiteList, textLengthThreshold. 
- **lightning**: upsell KaiGuan ( XinLao use Hu , ShouCangJia , BiaoDan etc. ) . 
- **bingviz**: YaoCeYuMing (china/default, market_check_url) . 
- **sydchat / discoverchat**: PingTaiKaiGuan , regionBlockList ( such as CN/RU/KP) , requiredWaitList. 
- **add_topsite / topsites**: DingLanZhanDian and CaoZuoBan this , topSitesV2 KaiGuan . 
- **app_selfupdate**: GengXinRuKou and upsell, versionInterval. 
- **dma**: preDMA XiangGuanJianGe and CiShu . 
- **darkmode**: Android/iOS AnSeMoShi blocklist ( HanZhengZe ) . 
- **beta_enrollment**: beta RuKou and upsell KaiGuan . 
- **growthEngine**: YingXiaoHuoDongLieBiao (campaignId, target, trigger, surface, enabled etc. ) . 

## purpose 
as YuanChengGongNeng and ShiYan config , KongZhiGe module KaiGuan , MingDan , CeLve and HuoDongTouFang , Shi use at LiuLanQi or Lei Edge KeHuDuan . 
