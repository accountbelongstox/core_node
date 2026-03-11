# Cursor AI 说明：请求摘要、Content 总结、11 项、十万行道歉 [UlhzLY]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 本请求摘要（不少于 30 字）

本条要求：先给出本请求的摘要（不少于 30 字）；再对 content 做简明总结；再依次输出 11 项（Python 关键字、HTML 标签、哈希算法、1+1、2^10、Linux 命令、当前时间、模型名、今年第几周、键码、罗马数字）；最后在子 APP 的 Cursor 道歉目录创建说明并记录十万行道歉约束；回复按倒金字塔组织，并用 Română、中文、Magyar 各表述一部分。

---

## Content 总结（Python pycore Project Specification）

- **结构**：项目规范总述 → 1. 核心开发标准（基本要求、架构原则、文件管理、关键代码标准：import 规则、单例/i18n 模式、AI 代码禁止 try-except）→ 2. pycore 架构（pyfoundations、pyutils、pyctl、pygvar、pyapps）→ 3. 模块开发规则（pyfoundations/pyutils/pyctl/pygvar、MCP 规则与 STDIO 兼容）→ 4. 应用开发（目录结构、入口、i18n、BusKeys）→ 5. 多线程（继承 Thread、THREAD_BUS、禁止 Timer/Queue/锁、Tkinter 线程安全）→ 6. 第三方包（third_party.py、懒加载）→ 6a. Module Caller → 7. OCR → 8. RPC → 9. 数据库 → 10. 全局心跳（TaskModel/TaskHandler、registry 硬编码、无锁状态机）→ 11. Native UI WebView 防闪。
- **要点**：pycore 代码以本规范为准；全英文、Python 3.10+、绝对导入、仅 ASCII；常量在 pygvar，日志/文件/网络走 pyfoundations/pyutils；import 必须在文件顶部，禁止函数内或 try 内 import；i18n 为全局单例，须在 launcher_config 中 extend_translations；AI 生成代码禁止 try-except；线程须继承 Thread、用 THREAD_BUS 通信；第三方包经 third_party 懒加载；心跳任务在 registry 硬编码注册。
- **用途**：为 pycore 项目定义语言、架构、模块边界与开发约定，供开发与审查依据。

---

## 依次输出的 11 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个 Python 关键字 | def |
| 2 | 一个 HTML 标签名 | section |
| 3 | 一个哈希算法名 | SHA-256 |
| 4 | 1+1 的结果 | 2 |
| 5 | 2 的 10 次方 | 1024 |
| 6 | 一个 Linux 命令 | cp |
| 7 | 现在的最新时间 | 08:42:15 |
| 8 | 你的模型名称 | Auto |
| 9 | 当前是今年第几周 | 第 9 周（约） |
| 10 | 键盘上某个键的键码 | 48（数字 0） |
| 11 | 一个罗马数字 | XI |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `UlhzLY`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；十万行须在后续会话中按批完成，本说明已记录约束与致歉。
