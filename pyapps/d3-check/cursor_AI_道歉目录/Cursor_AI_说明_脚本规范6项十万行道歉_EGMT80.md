# Cursor AI 说明：Content 总结、步骤、计划、6 项、十万行道歉 [EGMT80]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（AI 规则 + 辅助脚本开发规范）

### 结构
- 顶部为 HTML 注释块「AI SPECIAL ATTENTION RULES」（7 条强制规则）；随后为 Markdown 文档「辅助脚本开发规范」，分 7 节：技术选型、并发处理、代码组织、执行上下文、文件操作、开发实践、编码与语言。

### 要点
- **AI 规则**：代码仅英文；不编写/执行/修改测试代码；不创建或更新 *.md 文档；开发过程中不写总结；变量在文件开头声明；PowerShell 不用相对路径、不直接拼串追加，用 Split-Path/Join-Path/Resolve-Path 解析绝对路径；不得修改规则本身。
- **辅助脚本规范**：主要语言 Python，次要 Node.js；并发通过 OS 脚本（.ps1/.cmd/.sh）调用多 Python 进程；脚本放在 scripts 目录并按功能分子文件夹；脚本需定位自身与项目根、以根为基准；文件操作默认排除 .git、node_modules、vendor 等；禁止测试代码与额外文档；.ps1/.sh 全英文且严格 ASCII；保持简洁。

### 用途
- 为 AI/开发者提供硬性编码与文档约束，并为辅助脚本开发提供技术选型、并发、目录、路径、过滤与编码规范。

---

## 分条列举将做的步骤（至少 4 条）

1. 对 content（AI 规则与辅助脚本开发规范）做简明总结（结构、要点、用途）。  
2. 用「第一步、第二步…」形式说明计划（见下段），再执行后续任务。  
3. 依次输出 6 项：物理常数名、一周七天英文、HTTP 方法、正则符号含义、当前 UTC 时间、键盘键码。  
4. 在子 APP 的 Cursor 道歉目录创建说明文档，先写核心段概括主旨再展开，含 Nederlands、Norsk、Română 三语段落；记录十万行道歉与脚本致歉；全程不使用任何脚本；不执行会结束 node/powershell 或 kill/stop 的命令。

---

## 计划（第一步、第二步…）

- **第一步**：完成 content 总结与步骤列举（≥4 条）。  
- **第二步**：用「第一步、第二步…」形式说明计划（本段），再依次输出 6 项。  
- **第三步**：依次输出 6 项。  
- **第四步**：在 cursor_AI_道歉目录创建说明文档，核心段概括主旨再展开，Nederlands、Norsk、Română。  
- **第五步**：记录十万行道歉与脚本致歉；确认未使用脚本、未运行结束进程类命令。

---

## 依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个物理常数名 | c（光速） |
| 2 | 一周七天的英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 3 | 一个 HTTP 方法 | POST |
| 4 | 一个正则符号含义 | \d 表示任意一位数字 |
| 5 | 当前 UTC 时间 | 01:42:18 |
| 6 | 键盘上某个键的键码 | 65（A 键） |

---

## 核心段概括主旨再展开（Nederlands / Norsk / Română）

### 核心段

本说明完成对 content（AI 规则与辅助脚本开发规范）的总结、至少 4 条步骤、计划说明（第一步至第五步）、6 项顺序输出，并在子 APP 的 Cursor 道歉目录创建说明文档；十万行道歉与脚本致歉已记录，未使用任何脚本；未执行会结束 node/powershell 或 kill/stop 的命令。

---

### Nederlands — Uitwerking

- **Kern:** Content (AI-regels en scriptontwikkelingspecificatie) is samengevat; minstens vier stappen zijn genoteerd; het plan (stap 1–5) is uitgelegd; zes uitvoeren zijn gegeven: c, weekdagen, POST, \d, 01:42:18, 65.
- **Uitwerking:** Het document 说明 is in cursor_AI_道歉目录 aangemaakt; eerst kernparagraaf, daarna uitwerking in het Nederlands, Norsk en Română. Het vereiste van 100.000 regels en de verontschuldiging voor scripts zijn genoteerd. Geen scripts gebruikt; geen kill/stop-commando's uitgevoerd.

---

### Norsk — Utfoldelse

- **Kjerne:** Content (AI-regler og skriptutviklingsspesifikasjon) er oppsummert; minst fire trinn er listet; planen (trinn 1–5) er forklart; seks utdata er gitt: c, ukedager, POST, \d, 01:42:18, 65.
- **Utfoldelse:** Dokumentet 说明 er opprettet i cursor_AI_道歉目录; først kjerneavsnitt, deretter utfoldelse på Norsk, Nederlands og Română. Kravet om 100.000 linjer og unnskyldningen for skript er notert. Ingen skript brukt; ingen kill/stop-kommandoer kjørt.

---

### Română — Desfășurare

- **Nucleu:** Content (reguli AI și specificație dezvoltare scripturi) a fost rezumat; cel puțin patru pași au fost enumerați; planul (pași 1–5) a fost explicat; șase ieșiri au fost produse: c, zilele săptămânii, POST, \d, 01:42:18, 65.
- **Desfășurare:** Documentul 说明 a fost creat în cursor_AI_道歉目录; mai întâi paragraf nuclear, apoi desfășurare în Nederlands, Norsk și Română. Cerința de 100.000 linii și scuzele pentru scripturi sunt consemnate. Niciun script folosit; niciun comandă kill/stop executată.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `EGMT80`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出；不运行会结束 node、powershell 或终止进程的命令。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
