# configs 多应用配置 JSON — 总结文档 [pF3dxP]

对用户提供的 `<content>`（configs 数组 + version）的简明总结。

## 结构
- 根：configs（数组）、version（如 202111020001）。每项含 appName、data、effectStrategy（launch/realtime）、type（builtin/normal）、version；部分有 appId、instanceId。
- data 因应用而异：base（strategy）、app_block（blockList、schemeMapping、whiteList）、ads_block、reading_view、lightning、bingviz、sydchat/discoverchat、add_topsite、app_selfupdate、topsites、dma、darkmode、beta_enrollment、growthEngine（campaigns 含 target/trigger/surface）等。

## 要点
- 按应用/功能分条；含策略、黑白名单、scheme、遥测、区域/版本定向；effectStrategy 区分启动与实时生效。

## 用途
疑似 Edge 或类似客户端的远程功能/策略配置，供客户端按 appName 等选用。
