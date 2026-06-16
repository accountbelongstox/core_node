# WordFlow 文档中心(功能描述)

> **定位.** 本目录只保留 **功能描述文档** —— 描述 WordFlow *做什么、用户如何体验、
> 设计与交互意图、后端须满足的行为*。**不含**代码示例、代码结构/架构内部、接口契约、
> 设计令牌/类名、实现指导与进度内容;这些技术实现**由 AI 在构建时按本文档的意图自由完成**。
>
> **来源 / Origin.** 2026-06 自 `poly_apps/qy_capacitor/docs/` 迁移而来,经多轮精简:
> 先去重去历史/报告,再剥离全部代码与技术实现指导,只留功能描述。WordFlow 前端原仓库
> `poly_apps/qy_capacitor` 与其移植端 `poly_apps/pycore_laravel_wordflow_ui/apps/wordflow` 共用本说明。

## 文档清单

| 文档 | 内容(功能层) |
|------|--------------|
| [FEATURES.md](FEATURES.md) | **功能描述**(核心):词汇学习、音频与 TTS、基于语言的学习组、图标与多语言首页 —— 每个功能做什么、用户如何体验。 |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | **设计与交互意图**:目标观感(Iris 配色氛围、玻璃拟态、渐变用于主视觉)、移动端布局与悬浮岛导航、信息架构、用户流程、交互状态、覆盖层与动效行为。 |
| [BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md) | **后端功能要求**:注册自动初始化、学习组、音频生成协调、批量状态查询等后端必须做到的**行为**。 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | **能力与数据流概览**:应用能做什么、概念数据流(用户视角)。 |
| [BACKLOG_AND_NOTES.md](BACKLOG_AND_NOTES.md) | **功能注意事项与边界**:产品须处理的边界情况、头像生成与翻译服务的行为说明。 |

## 原则

- 文档=**功能描述**;实现(架构、接口、代码结构、样式令牌)**不写入**,由 AI 实时发挥。
- 整文件替换:过时即整篇重写,不增量堆叠。
- 设计/后端的权威引用方:`poly_apps/qy_capacitor/CLAUDE.md` 与
  `.cursor/rules/wordflow-design.mdc` 已指向本目录。
