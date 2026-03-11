# Configs JSON（多应用配置）— 总结文档 [UeMoOv]

对用户提供的 `<content>`（含 configs 数组与 version 的 JSON 配置）的简明总结。

## 结构
- 顶层：`configs`（对象数组）、`version`（如 "202111020001"）。
- 每项常见字段：appName、data、effectStrategy（launch/realtime）、type（builtin/normal）、version；部分含 appId、instanceId。
- data 因应用不同而结构不同。

## 要点
- **base**：strategy（foreground、launch、minFetchSeconds、pushTrigger、sessionSeconds）。
- **app_block**：androidBlockList、iosBlockList、schemeMapping（jd/taobao/zhihu/weibo）、whiteList、chinaDefaultValue。
- **ads_block**：videoAds.enable。
- **reading_view**：blockList、whiteList、textLengthThreshold。
- **lightning**：upsellEnable（existingUser/newUser/favoriteHub/formAutofill）。
- **bingviz**：telemetry_domain（china、default、market_check_url）。
- **sydchat / discoverchat**：androidEnable、iOSEnable、regionBlockList（CN/RU/KP）、requiredWaitList、launchMode（sydchat）。
- **add_topsite、app_selfupdate、topsites、dma、darkmode、beta_enrollment、growthEngine**：各含开关、版本、黑名单或 campaign 等。effectStrategy 区分启动时生效（launch）与实时生效（realtime）。

## 用途
作为多应用（如浏览器/客户端）的统一配置源，用于功能开关、应用/域名黑名单、scheme 映射、遥测、区域限制、upsell 与增长活动等。
