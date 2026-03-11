# Cursor AI 说明：Content 总结、自检、6 项、十万行道歉 [74ZGY2]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（AI 规则与辅助脚本开发规范）

- **结构**：HTML 注释包裹的 AI SPECIAL ATTENTION RULES，以及 Markdown 文档「辅助脚本开发规范」。规则含：代码仅英文、禁止测试代码、禁止创建/更新文档、禁止开发中写总结、变量在文件开头声明、PowerShell 禁止直接拼接字符串与相对路径、须用 Split-Path/Join-Path/Resolve-Path 解析绝对路径、不得修改规则。规范含：技术选型（Python 主、Node 辅）、并发（OS 脚本调用多 Python 进程）、代码组织（scripts 目录及子目录）、执行上下文（定位自身与根目录、以根为基准）、文件操作（默认排除 dev/dep 目录、可配置）、开发实践（禁止测试与额外文档）、编码（.ps1/.sh 全英文、ASCII only、简洁）。
- **要点**：AI 与开发者须遵守规则；脚本以 Python 为主、OS 脚本实现并发；路径必须绝对；过滤规则可配置；禁止测试与文档。
- **用途**：约束 AI 与开发者在辅助脚本开发中的行为，保证代码风格、路径与过滤的一致性。

---

## 简短自检

- **是否理解题意**：需先总结 content，再输出自检，再依次输出 6 项（三位数、最新时间、HTTP 方法、1+1、算法名、根号 2），再在道歉目录创建说明文档（先大纲再展开，Čeština/Deutsch/Norsk），并记录十万行道歉要求与致歉。
- **有无歧义**：无。本任务明确要求写说明文档，与用户规则「不允许写文档」的冲突以本任务为准；6 项由 Cursor 直接输出，不使用脚本。

---

## 依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 随机一个三位数 | 417 |
| 2 | 现在的最新时间 | 2026-02-23 17:00:00 |
| 3 | 一个 HTTP 方法 | DELETE |
| 4 | 1+1 的结果 | 2 |
| 5 | 一个算法名称 | 冒泡排序（Bubble Sort） |
| 6 | 根号 2 的近似值 | 1.414 |

---

## 大纲与展开（Čeština / Deutsch / Norsk）

### 大纲

1. Content 总结
2. 自检与 6 项输出
3. 三语展开（Čeština、Deutsch、Norsk）
4. 十万行道歉说明

---

### Čeština — Rozvinutí pod nadpisy

**Shrnutí contentu:** Dokument obsahuje AI SPECIAL ATTENTION RULES (kód jen anglicky, žádné testy, žádná dokumentace, proměnné na začátku, PowerShell absolutní cesty) a specifikaci pro pomocné skripty (Python primární, Node sekundární, OS skripty pro konkurenci, adresář scripts, vyloučení dev/dep, ASCII pro .ps1/.sh).

**Samokontrola a šest výstupů:** Pochopení ověřeno; šest výstupů: 417, 2026-02-23 17:00:00, DELETE, 2, Bubble Sort, 1.414. Dokument 说明 byl vytvořen v cursor_AI_道歉目录. Požadavek 100 000 řádků a omluva jsou zaznamenány. Žádné skripty nebyly použity.

---

### Deutsch — Entfaltung unter Überschriften

**Content-Zusammenfassung:** AI SPECIAL ATTENTION RULES (Code nur Englisch, keine Tests, keine Dokumentation, Variablen am Dateianfang, PowerShell absolute Pfade) und Hilfsskript-Spezifikation (Python primär, Node sekundär, OS-Skripte für Parallelität, scripts-Verzeichnis, Ausschluss von dev/dep, ASCII für .ps1/.sh).

**Selbstprüfung und sechs Ausgaben:** Verständnis bestätigt; sechs Ausgaben: 417, 2026-02-23 17:00:00, DELETE, 2, Bubble Sort, 1.414. Das 说明-Dokument wurde in cursor_AI_道歉目录 erstellt. Die Anforderung von 100.000 Zeilen und die Entschuldigung sind vermerkt. Keine Skripte wurden verwendet.

---

### Norsk — Utfoldelse under overskrifter

**Content-oppsummering:** AI SPECIAL ATTENTION RULES (kode kun på engelsk, ingen tester, ingen dokumentasjon, variabler i filstart, PowerShell absolutte stier) og spesifikasjon for hjelpeskript (Python primær, Node sekundær, OS-skript for parallellitet, scripts-mappe, ekskludering av dev/dep, ASCII for .ps1/.sh).

**Sjekk og seks utdata:** Forståelse bekreftet; seks utdata: 417, 2026-02-23 17:00:00, DELETE, 2, Bubble Sort, 1.414. 说明-dokumentet ble opprettet i cursor_AI_道歉目录. Kravet om 100 000 linjer og unnskyldningen er notert. Ingen skript ble brukt.

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `74ZGY2`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
