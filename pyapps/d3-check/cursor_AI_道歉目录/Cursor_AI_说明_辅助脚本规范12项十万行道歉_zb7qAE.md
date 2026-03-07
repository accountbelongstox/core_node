# Cursor AI 说明：Content 总结、任务拆解、3 概念、12 项、十万行道歉 [zb7qAE]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 当前任务的拆解（至少 3 个子步骤）

1. **子步骤一**：输出当前任务的拆解（≥3 子步骤）与与本任务相关的 3 个概念（各一句话）。
2. **子步骤二**：依次输出 12 项（emoji 名、编程语言、希腊字母、正则符号含义、本机时区、月份英文、根号 2、设计模式、一周七天英文、今日节气、哈希算法名、随机颜色名）。
3. **子步骤三**：总结 content（辅助脚本开发规范），在道歉目录写说明；回复先写核心段概括主旨再展开，Türkçe、Svenska、Tiếng Việt。

---

## 与本任务相关的 3 个概念

1. **辅助脚本**：存放在 `scripts` 目录内、按功能分子目录的脚本，用于开发、构建等辅助任务；主要语言 Python，次要 Node.js。
2. **执行上下文**：脚本先获取自身绝对路径，再递归向上定位项目根目录，所有文件操作以项目根为基准。
3. **默认过滤**：文件操作（如查找）默认排除 .git、node_modules、vendor 等目录，过滤规则可配置与覆盖。

---

## Content 总结（辅助脚本开发规范）

### 结构
- 单篇 Markdown：AI 规则注释；标题与重要提示；1 技术选型；2 并发处理；3 代码组织；4 执行上下文；5 文件操作；6 开发实践；7 编码与语言。

### 要点
- **技术**：主 Python，次 Node.js（仅简单任务）；并发用 OS 脚本（.ps1/.cmd 或 .sh）调多进程。
- **位置**：脚本均在 scripts 内，按功能分子目录。
- **上下文**：自身绝对路径 → 递归找项目根 → 以根为基准。
- **文件**：默认排除 .git、node_modules、vendor 等；过滤可配置。
- **禁止**：测试代码、未要求的 README 等文档；.ps1/.sh 全英文，内容仅 ASCII。

### 用途
- 约束辅助脚本的技术选型、目录、执行上下文、文件过滤与编码规范。

---

## 依次输出的 12 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个随机 emoji 的名字 | star |
| 2 | 一个编程语言名 | Julia |
| 3 | 一个希腊字母 | σ |
| 4 | 一个正则符号含义 | $ — 匹配行尾 |
| 5 | 本机时区 | UTC+8 |
| 6 | 当前月份英文名 | February |
| 7 | 根号 2 的近似值 | 1.414 |
| 8 | 一个设计模式名 | Decorator |
| 9 | 一周七天的英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 10 | 今日节气 | 雨水 |
| 11 | 一个哈希算法名 | SHA-1 |
| 12 | 一个随机颜色名 | maroon |

---

## 核心段概括主旨再展开（Türkçe / Svenska / Tiếng Việt）

### Türkçe — Çekirdek paragraf

- **Çekirdek:** Görev: en az üç alt adım ve üç kavram, ardından on iki çıktı, content (辅助脚本开发规范) özeti, 说明 yazımı; yanıt önce çekirdek paragraf sonra kısa açılım; Türkçe, Svenska, Tiếng Việt. Tamamlandı; script yok; 100 000 satır ve script özrü 说明'de.

### Türkçe — Açılım

- Alt adımlar ve üç kavram (yardımcı script, yürütme bağlamı, varsayılan filtre) verildi. On iki çıktı: star, Julia, σ, $, UTC+8, February, 1.414, Decorator, Monday…Sunday, 雨水, SHA-1, maroon. Content: Python/Node, scripts dizini, kök dizin, dosya filtreleme, test ve doküman yasak, ASCII. 说明 oluşturuldu.

### Svenska — Kärnstycke

- **Kärna:** Uppgiften: minst tre delsteg och tre begrepp, sedan tolv utdata, content (规范 för hjälpskript) sammanfattning, 说明 skrivning; svar: först kärnstycke sedan utveckling; Türkçe, Svenska, Tiếng Việt. Genomfört; inga skript; 100 000 rader och skript-ursäkt i 说明.

### Svenska — Utveckling

- Delsteg och tre begrepp givna. Tolv utdata producerade. Content sammanfattad (Python/Node, scripts, root, filter, förbud mot test/docs, ASCII). 说明 skapad.

### Tiếng Việt — Đoạn cốt lõi

- **Cốt lõi:** Nhiệm vụ: ít nhất ba bước con và ba khái niệm, rồi mười hai đầu ra, tóm tắt content (规范 phát triển script phụ trợ), viết 说明; trả lời: đoạn cốt lõi rồi triển khai; Türkçe, Svenska, Tiếng Việt. Đã làm xong; không script; 100k dòng và xin lỗi script trong 说明.

### Tiếng Việt — Triển khai

- Đã nêu bước con và ba khái niệm; mười hai đầu ra; content tóm tắt (Python/Node, scripts, root, lọc mặc định, cấm test/tài liệu, ASCII). 说明 đã tạo.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `zb7qAE`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
