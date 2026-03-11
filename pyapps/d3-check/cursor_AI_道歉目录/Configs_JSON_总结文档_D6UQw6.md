# Configs JSON（多应用配置）— 总结文档 [D6UQw6]

对用户提供的 `<content>`（含 configs 数组与 version 的 JSON 配置）的简明总结。

## 结构
顶层：configs（对象数组）、version。每项常见字段：appName、data、effectStrategy（launch/realtime）、type（builtin/normal）、version；部分含 appId、instanceId。data 因应用不同而结构不同。

## 要点
base：strategy。app_block：androidBlockList、iosBlockList、schemeMapping、whiteList、chinaDefaultValue。ads_block、reading_view、lightning、bingviz、sydchat、discoverchat、add_topsite、app_selfupdate、topsites、dma、darkmode、beta_enrollment、growthEngine：各含开关、黑名单、遥测、campaign 等。effectStrategy 区分启动时（launch）与实时（realtime）生效。

## 用途
作为多应用（如浏览器/客户端）的统一配置源，用于功能开关、黑名单、scheme 映射、遥测、区域限制、upsell 与增长活动等。
