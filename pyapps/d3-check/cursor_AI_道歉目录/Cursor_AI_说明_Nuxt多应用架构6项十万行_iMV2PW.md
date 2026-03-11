# Cursor AI 说明：请求摘要、Content 总结、6 项、十万行道歉 [iMV2PW]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 本请求摘要（不少于 30 字）

本条要求：先给出本请求的摘要（不少于 30 字）；再对 content 做简明总结；再依次输出 6 项（设计模式、数学常数、成语、质数、颜色名、化学元素符号）；最后在子 APP 的 Cursor 道歉目录创建说明并记录十万行道歉约束；回复用多级小标题分段，并用 한국어、Čeština、Русский 各表述一部分。

---

## Content 总结（Nuxt Multi-App Namespace Architecture）

- **结构**：版本与状态 → AI 开发指南（优先扩展 common、勿改 _build_dir、pages 自动管理）→ 核心原则（命名空间隔离、目录结构：废弃 apps/app_{namespace}/、新结构 app_{namespace}_pages/）→ 架构层（namespace-registry、useRouteNamespace、configs、API、layout、switch-pages-directory、switch-app-entry-plus、i18n）→ common 与 app 分层标准 → 命名空间规则（DO/DON'T）→ 添加新应用步骤 → 关键文件表 → 校验清单 → 常用模式 → 当前应用列表。
- **要点**：每应用独立 namespace，源码以 app_{namespace}_pages/ 为唯一真相源；pages/ 仅自动拷贝 index.vue、blank.vue、layouts/ 与 INDEX.md，禁止直接编辑；common/ 放可复用逻辑，扩展时先查 common；API 请求带 X-App-Namespace；废弃目录需迁移到 app_{namespace}_pages/。
- **用途**：为 poly_apps/nuxt_main 多应用 Nuxt 项目提供命名空间架构、目录约定、pages 管理与 common 扩展规范，供开发与迁移参考。

---

## 依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个设计模式名 | Decorator |
| 2 | 一个数学常数 | π (pi) |
| 3 | 一个随机成语 | 胸有成竹 |
| 4 | 一个质数 | 29 |
| 5 | 一个随机颜色名 | lavender |
| 6 | 一个化学元素符号 | Au（金） |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `iMV2PW`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；十万行须在后续会话中按批完成，本说明已记录约束与致歉。
