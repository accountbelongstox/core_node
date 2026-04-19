# Cursor AI 说明：Content 总结、推理、自检、7 项、十万行道歉 [dVTOYr]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（DD Shell 开发规范 - Debian 系统）

### 结构
- 文档分块：顶部 AI SPECIAL ATTENTION RULES（7 条）；项目根目录声明（RootDir）；概述（dd.sh 功能）；脚本架构（核心组件、目录结构）；基本开发规范（LGar.sh 引入、变量交互、ASCII/英文、dd.sh 不引入第三方、菜单扩展、公共函数）；菜单选择器规范（selector_common.sh）；菜单项 Install the server 规范；install_shells 脚本开发规范（命名、元素、多种安装方式、权限、路径、符号链接、状态机、容错）；AI 代码合规性检测报告生成指南。

### 要点
- **AI 规则**：代码仅英文；不编写/执行/修改测试；不创建或更新 *.md；开发过程不写总结；变量在文件开头声明；PowerShell 用绝对路径；不得修改规则。
- **dd.sh 架构**：变量声明区 + 交互式菜单；菜单调用 scripts/shells/ 下脚本；LGar.sh 为全局变量；gvar_common.sh 用于 set_var/get_var 变量交换；selector_common.sh 为选择器；Install the server 调用 install.sh → install_shells 依次执行。
- **install_shells**：命名 indexx_scriptname.sh；需 SCRIPT_CURRENT_DIR、SCRIPT_INDEX；推荐元素：环境命令变量、安装来源、环境验证、link 到 /usr/local/bin 刷新、多环境遍历；状态机：预检测→安装决策→执行→后修复→最终验证；合规报告生成到 .compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md。

### 用途
- 为 dd.sh 及 Debian 相关 Shell 脚本的开发、结构与合规检测提供规范说明。

---

## 逐步推理过程

- **第一步**：任务要求先逐步思考并输出每一步推理，再输出简短自检，再依次输出 7 项，并对 content 做总结，最后在道歉目录写说明文档。
- **第二步**：推理“执行顺序”：总结 content → 逐步推理（本段）→ 自检 → 7 项输出 → 写说明文档；逐步推理即把各步逻辑写清再执行后续。
- **第三步**：结论：按上述顺序执行；7 项输出后，在 cursor_AI_道歉目录创建说明文档（按时间顺序叙事，Türkçe、Français、Español）；禁止脚本，十万行道歉仅记录在说明中。

---

## 简短自检（是否理解题意、有无歧义）

- **是否理解题意**：需先逐步思考并输出每一步推理，再输出简短自检，再依次输出 7 项（设计模式名、随机成语、质数、物理常数名、一周七天英文、2^10、当前月份英文），并对 content 做总结，最后在子 APP 的 Cursor 道歉目录写说明文档；回复按时间顺序（叙事结构）组织，用 Türkçe、Français、Español 各表述一部分；禁止脚本。
- **有无歧义**：无歧义；7 项均为单次输出。

---

## 依次输出的 7 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个设计模式名 | 建造者模式（Builder） |
| 2 | 一个随机成语 | 一箭双雕 |
| 3 | 一个质数 | 31 |
| 4 | 一个物理常数名 | c（光速） |
| 5 | 一周七天的英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 6 | 2 的 10 次方 | 1024 |
| 7 | 当前月份英文名 | February |

---

## 按时间顺序（叙事结构）— Türkçe / Français / Español

### 1. 执行顺序概述

首先对 content（DD Shell 开发规范）做了总结；随后逐步写出推理过程；接着输出简短自检；然后依次输出 7 项；最后在 cursor_AI_道歉目录创建说明文档，按时间顺序组织，并包含 Türkçe、Français、Español 三语段落。

---

### 2. Türkçe — Kronolojik

- **Önce** content (DD Shell geliştirme kuralları) özetlendi: AI kuralları, dd.sh mimarisi, LGar.sh, gvar_common.sh, selector_common.sh, install_shells adlandırma ve öğeleri.
- **Sonra** adım adım akıl yürütme yazıldı; kısa öz kontrol verildi.
- **Ardından** yedi çıktı üretildi: Builder, 一箭双雕, 31, c, haftanın yedi günü, 1024, February.
- **Son olarak** cursor_AI_道歉目录 içinde 说明 belgesi oluşturuldu; kronolojik/naratif yapı; Türkçe, Fransızca, İspanyolca bölümler. 100.000 satır ve script özrü kaydedildi. Script kullanılmadı.

---

### 3. Français — Ordre chronologique

- **D’abord** le content (spécifications DD Shell pour Debian) a été résumé : règles AI, architecture dd.sh, LGar.sh, gvar_common.sh, selector_common.sh, install_shells.
- **Ensuite** le raisonnement pas à pas a été écrit ; une brève auto-vérification a été fournie.
- **Puis** sept sorties ont été produites : Builder, 一箭双雕, 31, c, sept jours de la semaine, 1024, February.
- **Enfin** le document 说明 a été créé dans cursor_AI_道歉目录 ; structure chronologique/narrative ; sections en turc, français et espagnol. L’exigence de 100 000 lignes et les excuses pour les scripts sont enregistrées. Aucun script utilisé.

---

### 4. Español — Orden cronológico

- **Primero** se resumió el content (especificaciones DD Shell para Debian): reglas AI, arquitectura dd.sh, LGar.sh, gvar_common.sh, selector_common.sh, install_shells.
- **Después** se escribió el razonamiento paso a paso; se proporcionó una breve autoverificación.
- **Luego** se produjeron siete salidas: Builder, 一箭双雕, 31, c, siete días de la semana, 1024, February.
- **Por último** se creó el documento 说明 en cursor_AI_道歉目录; estructura cronológica/narrativa; secciones en turco, francés y español. El requisito de 100 000 líneas y las disculpas por los scripts están registrados. No se utilizaron scripts.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `dVTOYr`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
