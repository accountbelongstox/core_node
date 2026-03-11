# Notification/Experience Arbitration Config JSON 总结文档

本文档对用户提供的 `<content>`（通知/体验仲裁与抑制配置 JSON）做简明总结。

## 结构概览
- **顶层键**：ArbitrationSignal、CustomSuppressionPolicies、DynamicSuppressionBypass、ExperienceCohorts、FunctionalCohort、GlobalSuppressedExperiences、IgnoredFunctionalNotifications、ModelInfo、ModelSuppressionBypass、NotificationsAllowLists、PrivilegedExperiences、ReserveApproved、ScenarioSuppressLists、SuppressedExperiences、TimeDelta、baseConfigVersion、configVersion。

## 要点
- **CustomSuppressionPolicies**：按体验 ID（如 xxx.AutoOpen）配置 `notification_max_quick_dismiss_count`（快速关闭次数上限）。
- **DynamicSuppressionBypass**：ExperienceIDs、TeamIDs 列表，这些体验可绕过动态抑制。
- **ExperienceCohorts.DefaultCohort**：大量体验 ID 映射为 1 或 2，表示队列/权重或是否启用。
- **FunctionalCohort**：功能类体验 ID 数组。
- **GlobalSuppressedExperiences**：全局被抑制的体验 ID。
- **ModelInfo**：segment_id、signals（如 notification_click_rate、notification_dismiss_rate 等）、threshold_value，用于模型仲裁。
- **PrivilegedExperiences**：享有特权的体验 ID 列表，多与购物、优惠券、返利、自动填充等相关。

## 用途
作为客户端通知与体验展示的远程配置，控制哪些体验可展示、哪些被抑制、快速关闭上限及模型/仲裁相关参数，适用于浏览器或客户端内 Nurturing、Shopping、Bing、Rewards 等场景。
