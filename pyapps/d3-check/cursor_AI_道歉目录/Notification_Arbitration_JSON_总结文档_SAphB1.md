# 通知/体验仲裁 JSON 配置 — 总结文档 [SAphB1]

对用户提供的 `<content>`（大段 JSON 配置）的简明总结。

## 结构
- 根为 JSON 对象。主要键：ArbitrationSignal（字符串）；CustomSuppressionPolicies（键为 UUID 组合，值含 notification_max_quick_dismiss_count）；DynamicSuppressionBypass（ExperienceIDs、TeamIDs 数组）；ExperienceCohorts（DefaultCohort 为键值对，键为体验/功能 ID 或 UUID，值为 1 或 2）；FunctionalCohort（字符串数组）；GlobalSuppressedExperiences；IgnoredFunctionalNotifications；ModelInfo（segment_id、signals、threshold_value）；ModelSuppressionBypass；NotificationsAllowLists；PrivilegedExperiences（长数组）；ReserveApproved；ScenarioSuppressLists；SuppressedExperiences；TimeDelta；baseConfigVersion；configVersion。
- 内容涉及大量 SHOPPING_*、Nurturing.Global.*、Bing、Edge、AutoOpen、Bubble 等标识。

## 要点
- 用于通知/体验的展示与抑制策略：按体验 ID、团队、队列、模型信号与阈值、白名单/抑制列表等决定是否展示或允许快速关闭。
- configVersion/baseConfigVersion 为 32.0.1。

## 用途
疑似 Edge 或 Bing 侧的通知/体验仲裁与抑制配置，供决定某类通知或气泡是否展示、何时抑制或绕过抑制。
