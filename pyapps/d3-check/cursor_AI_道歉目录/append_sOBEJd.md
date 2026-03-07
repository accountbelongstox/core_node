# [sOBEJd]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 要点与步骤（≥5）

1. 列出至少 5 条要点或步骤。  
2. 依次输出 12 项（HTML 标签、节气、编程语言、格言、希腊字母、颜色、1024 二进制、罗马数字、扩展名、秒数、正则含义、时区）。  
3. 对 content 做简明总结并写入本文件。  
4. 在道歉目录创建 append_sOBEJd.md，含标准十万行句。  
5. 禁止脚本生成与重复行；不运行会结束 node/powershell 的命令。

---

## Content 简明总结（Singleton Busy State Control）

**结构**：文档含 Overview、Architecture 流程图、Complete Example（RPC 设置 busy、数据库事务保护、主线程手动控制）、Testing 两终端示例、Two Singleton Modes（replace / exit if exists / force launch）、API Summary（THREAD_BUS 方法、LauncherConfig 参数、Decision Flow）、Best Practices、Troubleshooting、Summary。  
**要点**：通过 `THREAD_BUS.set_busy(True/False)` 与 `is_busy()` 在单例收到 SHUTDOWN 时决定是否接受关闭；若 busy 则拒绝关闭、新实例不启动；LauncherConfig 的 singleton、shutdown_existing、force_launch 控制行为；建议在 finally 中清除 busy、提供有意义 reason。  
**用途**：在 pycore/pylauncher 单例场景下，防止关键任务执行时被新实例替换导致中断。

---

## [sOBEJd] 12 项

| # | 项目 | 值 |
|---|------|-----|
| 1 | HTML 标签名 | div |
| 2 | 今日节气 | 雨水 |
| 3 | 编程语言名 | Python |
| 4 | 一句格言 | 工欲善其事，必先利其器。 |
| 5 | 希腊字母 | π (pi) |
| 6 | 随机颜色名 | coral |
| 7 | 1024 的二进制 | 10000000000 |
| 8 | 罗马数字 | VII |
| 9 | 文件扩展名及用途 | .md，Markdown 文档 |
| 10 | 当前秒数 | 15 |
| 11 | 正则符号含义 | \s 表示空白字符 |
| 12 | 本机时区 | China Standard Time (UTC+8) |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
