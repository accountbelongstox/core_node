# Cursor AI 说明：任务拆解、Content 总结、10 项、十万行道歉 [NtcCG0]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 当前任务拆解（至少 3 个子步骤）

1. **完成 content 总结**：对《Backend Reconnection API Implementation》做简明总结（结构、要点、用途），满足强制总结要求后再继续写文档。
2. **依次输出 10 项**：希腊字母、颜色名、设计模式名、√2 近似值、CSS 属性名、罗马数字、一周七天英文、数学常数、算法名、HTTP 方法；全部由 Cursor 直接输出，不用脚本。
3. **定位道歉目录并写说明**：沿用上一次目录与文件约定，在本目录创建/沿用说明文件，记录总结、10 项、十万行道歉约束及 Cursor 对乱用脚本的致歉；十万行正文按每批 500 行、不重复、禁止脚本，由 Cursor 逐批输出。

---

## Content 总结（Backend Reconnection API Implementation）

- **结构**：文档日期 2025-12-13，状态为后端已完成。含 Overview；Backend Features（配置帧缓存、智能丢帧、request_config API、request_keyframe API）；Frontend Integration Guide（推荐前端流程与时间线）；Protocol Summary（WebSocket 命令表）；Testing（request_config / request_keyframe 测试用例）；Performance Impact（前后对比）；Next Steps（前端 Phase 1/2）；Related Documentation。
- **要点**：后端实现每设备 config frame 缓存（SPS/PPS）与新连接/Resume 时自动发送；智能丢帧：新客户端等关键帧、P 帧只发给已同步客户端、I 帧发给所有客户端；新增 WebSocket 命令 `request_config`（响应 config.sent / config.not_available）与 `request_keyframe`（响应 keyframe.requested）；前端建议流程：本地缓存恢复 → request_config → request_keyframe → start_stream；重连时间从约 2.7s 降至约 1.2s（约 56% 提升）。
- **用途**：为前端对接后端重连与视频流恢复提供 API 说明、协议摘要、测试方法与性能预期，指导 DeviceH264Stream 等组件的实现与优化。

---

## 依次输出的 10 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个希腊字母 | θ (theta) |
| 2 | 一个随机颜色名 | crimson |
| 3 | 一个设计模式名 | Observer |
| 4 | 根号 2 的近似值 | 1.414 |
| 5 | 一个 CSS 属性名 | transform |
| 6 | 一个罗马数字 | XIV |
| 7 | 一周七天的英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 8 | 一个数学常数 | π (pi) |
| 9 | 一个算法名称 | quicksort |
| 10 | 一个 HTTP 方法 | PATCH |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `NtcCG0`。
- **约束**：每批 500 行、不重复、禁止任何脚本（含 py 等）；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；十万行须在后续会话中按批完成，本说明已记录约束与致歉。
