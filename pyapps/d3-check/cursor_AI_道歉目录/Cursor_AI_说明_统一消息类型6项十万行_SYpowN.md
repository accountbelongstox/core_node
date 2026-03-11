# Cursor AI 说明：Content 总结、要点、6 项、十万行道歉 [SYpowN]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（统一消息类型规范 UNIFIED MESSAGE TYPES）

- **结构**：核心概念；UnifiedMessage 基础结构；MessageType、TaskStatus、QueueInfo 枚举与接口；WebSocket 推送（response、error、event、inventory）；HTTP 轮询（accepted、processing、completed、failed）；完整流程示例；前后端实现要点；总结与消息类型清单。
- **要点**：前后端使用相同消息对象；type 区分消息类型；id 关联请求与响应；WebSocket 与 HTTP 共用结构；queue 可为 null；requires_ack 触发 ACK；inventory 用于重连后补发离线任务。
- **用途**：统一 WebSocket 推送与 HTTP 轮询的消息格式，避免前后端转换与混淆。

---

## 至少 5 条要点或步骤

1. 对 content 做简明总结（结构、要点、用途）。
2. 列出至少 5 条要点或步骤（本列表即满足）。
3. 依次输出 6 项：当前月份英文名、当前日期与星期、编程语言名、HTTP 200 含义、JS 保留字、HTML 标签名。
4. 在道歉目录创建说明文档。
5. 记录十万行道歉要求与致歉；未使用任何脚本。

---

## 依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 当前月份英文名 | February |
| 2 | 当前日期与星期 | 2025-02-23 星期一 |
| 3 | 一个编程语言名 | TypeScript |
| 4 | HTTP 状态码 200 的含义 | 请求成功（OK） |
| 5 | 一个 JS 保留字 | async |
| 6 | 一个 HTML 标签名 | `<article>` |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；标签 `SYpowN`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
