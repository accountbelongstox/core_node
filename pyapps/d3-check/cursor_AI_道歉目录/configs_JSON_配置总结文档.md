# configs JSON 配置总结文档

本文档对用户提供的 `<content>`（JSON 配置）做简明总结，便于查阅与维护。

## 顶层结构
- **configs**：数组，每项为一条应用/功能配置。
- **version**：配置集版本，如 `"202111020001"`。

## 单条配置通用字段
- **appName**：功能或应用名。
- **data**：具体配置（策略、名单、开关等），结构因 app 而异。
- **effectStrategy**：`launch`（启动时生效）或 `realtime`（实时生效）。
- **type**：`builtin` 或 `normal`。
- **version**：该条配置版本。
- **appId** / **instanceId**：部分配置存在，用于标识实例。

## 主要配置项概览
- **base**：拉取策略（foreground、launch、minFetchSeconds、pushTrigger、sessionSeconds）。
- **app_block**：应用/网页拦截与 scheme 映射（如 jd/taobao/zhihu/weibo），含 androidBlockList、iosBlockList、whiteList、schemeMapping。
- **ads_block**：视频广告开关（videoAds.enable）。
- **reading_view**：阅读视图 blockList/whiteList、textLengthThreshold。
- **lightning**：upsell 开关（新老用户、收藏夹、表单等）。
- **bingviz**：遥测域名（china/default、market_check_url）。
- **sydchat / discoverchat**：平台开关、regionBlockList（如 CN/RU/KP）、requiredWaitList。
- **add_topsite / topsites**：顶栏站点与操作版本、topSitesV2 开关。
- **app_selfupdate**：更新入口与 upsell、versionInterval。
- **dma**：preDMA 相关间隔与次数。
- **darkmode**：Android/iOS 暗色模式 blocklist（含正则）。
- **beta_enrollment**：beta 入口与 upsell 开关。
- **growthEngine**：营销活动列表（campaignId、target、trigger、surface、enabled 等）。

## 用途
作为远程功能与实验配置，控制各模块的开关、名单、策略与活动投放，适用于浏览器或类 Edge 客户端。
