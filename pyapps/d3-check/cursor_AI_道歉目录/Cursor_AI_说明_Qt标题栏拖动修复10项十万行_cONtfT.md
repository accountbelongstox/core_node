# Cursor AI 说明：请求摘要、Content 总结、10 项、十万行道歉 [cONtfT]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 本请求摘要（不少于 30 字）

本条要求：先给出本请求的摘要（不少于 30 字）；再对 content 做简明总结；再依次输出 10 项（emoji 名、罗马数字、黄金分割比前 6 位、物理常数、设计模式、MIME、端口及用途、一周七天英文、当前 UTC、CSS 属性）；最后在子 APP 的 Cursor 道歉目录创建说明并记录十万行道歉约束；回复按问题-方法-解决方案组织，并用 Čeština、Polski、Español 各表述一部分。

---

## Content 总结（Qt 标题栏拖动修复）

- **结构**：问题描述（PySide6 frameless 窗口标题栏无法拖动）→ 根本原因（错误使用自定义 start_drag/do_drag/end_drag，手动算位置、无系统吸附）→ 正确方案（使用 windowHandle().startSystemMove()）→ 修复代码（title_bar.py 中 mousePressEvent/mouseMoveEvent/mouseReleaseEvent）→ 技术细节（startSystemMove 优势、工作原理、与手动实现对比表）→ 测试验证、相关 API、排查指南 → 总结。
- **要点**：用 Qt 原生 startSystemMove() 替代自定义拖动；mousePressEvent 内调用 parent.windowHandle().startSystemMove()，mouseMove/mouseRelease 仅设状态并调用 super；支持系统吸附、多显、触摸；Wayland 可退化为 QT_QPA_PLATFORM=xcb。
- **用途**：记录 PySide6 无边框窗口标题栏拖动的修复步骤与原理，供维护与排查参考。

---

## 依次输出的 10 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个随机 emoji 的名字 | sparkles |
| 2 | 一个罗马数字 | XIII |
| 3 | 黄金分割比前 6 位 | 1.61803 |
| 4 | 一个物理常数名 | G（万有引力常数） |
| 5 | 一个设计模式名 | Adapter |
| 6 | 一个 MIME 类型 | application/xml |
| 7 | 一个端口号及用途 | 8080，HTTP 代理/备用 Web |
| 8 | 一周七天的英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 9 | 当前 UTC 时间 | 07:15:00 |
| 10 | 一个 CSS 属性名 | display |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `cONtfT`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；十万行须在后续会话中按批完成，本说明已记录约束与致歉。
