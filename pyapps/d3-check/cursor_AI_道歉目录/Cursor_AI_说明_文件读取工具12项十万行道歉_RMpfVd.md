# Cursor AI 说明：Content 总结、步骤、12 项、十万行道歉 [RMpfVd]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（AI 规则 + 文件读取工具）

### 结构
- 顶部为 AI SPECIAL ATTENTION RULES 注释（7 条）；随后为 defaultEncodings 数组、readWithEncoding/readText/readLines/readFirstLine/readJson、isFile/isDirectory/getFileSize/isReadable、readInChunks、watchFile、getAbsolutePath；最后 module.exports 导出。

### 要点
- **AI 规则**：代码仅英文；不编写/执行/修改测试；不创建或更新 *.md；开发中不写总结；变量在文件开头声明；PowerShell 用绝对路径解析；不得修改规则。
- **readWithEncoding**：按编码列表尝试读取，返回 { content, encoding } 或空；readText/readLines/readFirstLine 基于其封装；readJson 解析 JSON。
- **getAbsolutePath**：规范化绝对路径；isFile/isDirectory/getFileSize/isReadable 等为同步 fs 封装；readInChunks 流式读取；watchFile 用 fs.watch。

### 用途
- 提供多编码尝试的文件读取与基础路径/文件判断，供依赖该模块的脚本在未知编码或路径下安全读文件。

---

## 分条列举将做的步骤（至少 4 条）

1. 对 content（AI 规则 + 文件读取工具）做简明总结。  
2. 分条列举将做的步骤（本段 ≥4 条）。  
3. 依次输出 12 项（本机时区、UTC 时间、圆周率前 5 位、键码、模型名称、Linux 命令、希腊字母、今年第几周、端口及用途、今年还剩多少天、数学常数、√2）。  
4. 在 cursor_AI_道歉目录创建说明文档，采用引言-正文-结论，含中文、Norsk、Português 段落；记录十万行与脚本致歉；不使用任何脚本。

---

## 依次输出的 12 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 本机时区 | UTC+8（中国标准时间） |
| 2 | 当前 UTC 时间 | 02:12:47 |
| 3 | 圆周率前 5 位 | 3.1415 |
| 4 | 键盘上某个键的键码 | 8（Backspace） |
| 5 | 你的模型名称 | Auto |
| 6 | 一个 Linux 命令 | tail |
| 7 | 一个希腊字母 | μ（mu） |
| 8 | 当前是今年第几周 | 第 9 周 |
| 9 | 一个端口号及用途 | 6379 — Redis 默认端口 |
| 10 | 今年还剩多少天 | 311 |
| 11 | 一个数学常数 | e（欧拉数） |
| 12 | 根号 2 的近似值 | 1.414 |

---

## 引言-正文-结论（中文 / Norsk / Português）

### 引言

本说明完成对 content（AI 规则与文件读取工具）的总结、至少 4 条步骤、12 项顺序输出，并在子 APP 的 Cursor 道歉目录创建说明文档；十万行道歉与脚本致歉已记录，未使用任何脚本。

### 中文 — 正文

- content 已总结：AI 规则 7 条与 defaultEncodings、readWithEncoding、readText/readLines/readFirstLine/readJson、isFile/isDirectory/getFileSize/isReadable、readInChunks、watchFile、getAbsolutePath。四步已列举；12 项已输出。说明已写入 cursor_AI_道歉目录，引言-正文-结论结构，含中文、Norsk、Português 段落。

### Norsk — Hoveddel

- Content (AI-regler og fillesingsverktøy) er oppsummert. Fire steg er listet; tolv utdata er gitt. 说明 er opprettet i cursor_AI_道歉目录 med innledning-hoveddel-konklusjon og avsnitt på 中文, Norsk og Português.

### Português — Conclusão

- O content foi resumido; quatro passos listados; doze saídas produzidas. 说明 criado em cursor_AI_道歉目录 com introdução-desenvolvimento-conclusão e secções em 中文, Norsk e Português. Requisito de 100.000 linhas e desculpas registrados. Nenhum script utilizado.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `RMpfVd`。  
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。  
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
