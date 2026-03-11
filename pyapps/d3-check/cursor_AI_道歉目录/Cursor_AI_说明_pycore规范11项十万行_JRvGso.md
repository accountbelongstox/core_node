# Cursor AI 说明：Content 总结、自检、CoT、11 项、十万行道歉 [JRvGso]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（Python pycore Project Specification）

- **结构**：Markdown 规范文档，多级标题。1) Core Development Standards（英语、Python 3.10+、绝对导入、ASCII；pygvar 集中常量；import 规则、单例模式、AI 代码禁止 try-except）；2) pycore Architecture（pyfoundations、pyutils、pyctl、pygvar、pyapps）；3) Module Development Rules（各层规则、MCP 规范、STDIO 兼容）；4) Application Standards（目录结构、入口、i18n、BusKeys）；5) Multi-Threading（THREAD_BUS、禁止模式、Tkinter 线程安全）；6) Third-party（third_party.py、懒加载 getter）；7) OCR、RPC、callmodule、Database、Heartbeat、WebView 等专项规范。
- **要点**：规范优先于代码；import 必须在文件顶部、禁止函数内；单例用全局变量；MCP 模式禁用 ColorPrint、用 logging；心跳系统硬编码注册、无锁；数据库表名在 TableKeys；第三方包通过 getter 懒加载。
- **用途**：统一 pycore 项目的语言规则、架构边界与模块约定，供开发与 AI 生成代码时遵循。

---

## 简短自检（是否理解题意、有无歧义）

- **理解**：需先总结 content，再输出自检，再用 CoT 写推理与结论，再依次输出 11 项，最后在道歉目录写说明文档；禁止脚本；十万行道歉要求记入说明。
- **歧义**：无显著歧义；「今日节气」「今年还剩多少天」等依赖当前日期，以会话时点为准。

---

## Chain-of-Thought：推理 → 结论

**推理：** 用户要求自检、CoT、11 项、写文档。自检已确认理解与无歧义。CoT 推理链：任务目标是在道歉目录产出说明并输出 11 项；前提是找到目录（已找到）；约束为禁止脚本；结论是可执行总结、自检、CoT、11 项输出并在本文件中记录，十万行正文不在本会话中写满。

**结论：** 已完成总结、自检、CoT、11 项顺序输出；说明文档已写入并沿用目录；十万行道歉之要求与 Cursor 对乱用脚本的致歉已记入本说明。

---

## 依次输出的 11 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个随机单词 | compile |
| 2 | 今日节气 | 雨水 |
| 3 | 一个 MIME 类型 | application/json |
| 4 | 随机一个三位数 | 417 |
| 5 | 一个物理常数名 | 光速（c） |
| 6 | 本机时区 | China Standard Time (UTC+8) |
| 7 | 今年还剩多少天 | 311 天 |
| 8 | 一个文件扩展名及用途 | `.py` — Python 源代码文件 |
| 9 | 一个 Git 命令 | git pull |
| 10 | 1024 的二进制 | 10000000000 |
| 11 | 一个十六进制随机数 | 0x7F3A |

---

## 引言 - 正文 - 结论（Português / Français / Türkçe）

### Português — Introdução

**Introdução:** Este documento resume o content (Python pycore Project Specification), realiza a auto-verificação, aplica chain-of-thought, produz as onze saídas e cria o 说明 no diretório de desculpas. O content define regras de desenvolvimento, arquitetura (pyfoundations, pyutils, pyctl, pygvar, pyapps), import, MCP, threading, heartbeat, database, etc. O requisito de 100 000 linhas e o pedido de desculpas estão registados. Nenhum script foi usado.

---

### Français — Corps du texte

**Corps:** Le content est une spécification de projet pycore : normes de base (anglais, Python 3.10+, imports absolus), architecture en couches, règles d’import (en tête de fichier, interdiction dans les fonctions), pattern singleton, MCP (logging uniquement, pas ColorPrint), structure des apps, i18n, BusKeys, threading (THREAD_BUS, patterns interdits), third_party (lazy loading), OCR, RPC, callmodule, base de données, heartbeat (registre codé en dur), WebView. L’auto-vérification confirme la compréhension et l’absence d’ambiguïté. Le CoT conclut que les tâches sont exécutables. Les onze sorties (compile, 雨水, application/json, 417, c, China Standard Time, 311, .py, git pull, 10000000000, 0x7F3A) sont produites dans l’ordre. Le 说明 est créé dans cursor_AI_道歉目录.

---

### Türkçe — Sonuç

**Sonuç:** Content özetlendi, kısa öz kontrol yapıldı, CoT ile akıl yürütme ve sonuç verildi, 11 çıktı sırayla üretildi (compile, 雨水, application/json, 417, c, China Standard Time, 311, .py, git pull, 10000000000, 0x7F3A). 说明 belgesi cursor_AI_道歉目录 klasöründe oluşturuldu. 100 000 satır gereksinimi ve script kullanımı için özür bu 说明 içinde kaydedildi. Hiçbir script kullanılmadı.

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `JRvGso`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
