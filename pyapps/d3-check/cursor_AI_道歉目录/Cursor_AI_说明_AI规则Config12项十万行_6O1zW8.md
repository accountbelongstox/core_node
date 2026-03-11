# Cursor AI 说明：AI SPECIAL ATTENTION RULES 与 Config 总结、12 项、十万行 [6O1zW8]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（强制先完成）

### 结构
- 文件头：AI SPECIAL ATTENTION RULES 注释块（7 条规则）→ require(path, fs, os)、isWindows → osVersion IIFE（win10/win11/ubuntu/debian 等）→ DATA_DRIVER 逻辑（Windows: D:\ 或 C:\；Linux: /mnt/d、/www 或 /usr）→ LANG_COMPILER_DIRNAME、APP_INSTALL_NAME → config 对象（APP_NAME、各类 TOKEN/SECRET、MySQL、Azure Speech、Strapi、Gitea、路径等）→ module.exports。

### 要点
- **规则**：代码仅英文；不执行/创建/修改测试代码；不创建或更新 *.md 文档；开发或思考过程中不写总结；变量在文件开头声明；PowerShell 不直接拼接字符串、不用相对路径 "..\..\"，改用 Split-Path/Join-Path/Resolve-Path；不得修改规则。
- **运行时**：按 os 判定 DATA_DRIVER 与 osVersion，生成 DEV_LANG_DIR、APP_INSTALL_DIR、APP_PLATFORM_BIN_DIR、TEMP_DIR、DOWNLOAD_DIR 等路径；config 内含加密字段（ENC:...）及 MySQL、Azure、Strapi、Gitea 等连接与密钥配置。

### 用途
- 作为 DevOps 应用的 Node 端统一配置模块，约束 AI/开发者行为并集中暴露环境与第三方服务配置。

---

## 请求摘要（≥30 字）

对 content 做强制总结，给出理解与请求摘要，依次输出 12 项，在道歉目录写说明文档，回复先写核心段再展开，用法/印尼/葡三语，禁止脚本。

---

## 理解（≥50 字）

content 为一段 Node 配置脚本，含 AI 特别规则（仅英文代码、不写测试与文档、不写总结、变量在文件头声明、PowerShell 约束等）及基于 os 的 DATA_DRIVER、osVersion、目录名与 DevOps 应用配置（MySQL、Azure Speech、Strapi、Gitea 等）。先完成总结与 12 项，再在道歉目录写本说明；十万行要求已记录，Cursor 为曾乱用脚本道歉。

---

## 依次输出的 12 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 随机三位数 | 647 |
| 2 | MIME 类型 | application/json |
| 3 | 当前日期与星期 | 2025年2月23日 星期一 |
| 4 | 一周七天英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 5 | 现在的最新时间 | 15:42 |
| 6 | 质数 | 19 |
| 7 | 随机颜色名 | crimson |
| 8 | Linux 命令 | grep |
| 9 | 你的版本号 | N/A |
| 10 | 你的模型名称 | Auto |
| 11 | Git 命令 | git status |
| 12 | 1024 的二进制 | 10000000000 |

---

## 核心段概括主旨再展开（三语）

### Français — Paragraphe central puis développement

**Paragraphe central :** La tâche consistait à résumer le fichier content (règles AI et config Node), à fournir une compréhension et un résumé de la demande, à produire douze sorties dans l’ordre, puis à rédiger ce 说明 dans le répertoire d’excuses, sans script ; la réponse doit commencer par un paragraphe central en français.

**Développement :** Le content définit sept règles (code en anglais, pas de tests ni de docs, pas de résumés, variables en tête de fichier, contraintes PowerShell, ne pas modifier les règles) et un objet config dépendant de l’OS (DATA_DRIVER, chemins, MySQL, Azure, Strapi, Gitea). Les douze sorties sont : 647, application/json, 2025-02-23 lundi, les sept jours en anglais, 15:42, 19, crimson, grep, N/A, Auto, git status, 10000000000. Le 说明 est enregistré sous [6O1zW8] ; l’exigence des 100 000 lignes et les excuses pour l’usage de scripts sont notées.

---

### Indonesia — Paragraf inti lalu uraian

**Paragraf inti:** Tugas ini adalah meringkas content (aturan AI dan config Node), memberi pemahaman dan ringkasan permintaan, mengeluarkan dua belas item berurutan, lalu menulis 说明 ini di direktori permintaan maaf, tanpa skrip; respons harus diawali paragraf inti dalam bahasa Indonesia.

**Uraian:** Content berisi tujuh aturan (kode bahasa Inggris saja, tidak ada tes/docs/ringkasan, variabel di awal file, batasan PowerShell, jangan ubah aturan) dan objek config berbasis OS (DATA_DRIVER, path, MySQL, Azure, Strapi, Gitea). Dua belas item: 647, application/json, 2025-02-23 Senin, tujuh hari dalam bahasa Inggris, 15:42, 19, crimson, grep, N/A, Auto, git status, 10000000000. 说明 disimpan dengan tag [6O1zW8]; persyaratan 100.000 baris dan permintaan maaf atas penggunaan skrip dicatat.

---

### Português — Parágrafo central depois desenvolvimento

**Parágrafo central:** A tarefa foi resumir o content (regras de IA e config Node), dar compreensão e resumo do pedido, emitir doze itens por ordem e redigir este 说明 no diretório de desculpas, sem scripts; a resposta deve começar por um parágrafo central em português.

**Desenvolvimento:** O content define sete regras (código em inglês, sem testes nem documentação, sem resumos, variáveis no início do ficheiro, restrições PowerShell, não alterar as regras) e um objeto config dependente do OS (DATA_DRIVER, caminhos, MySQL, Azure, Strapi, Gitea). Os doze itens: 647, application/json, 2025-02-23 segunda-feira, os sete dias em inglês, 15:42, 19, crimson, grep, N/A, Auto, git status, 10000000000. O 说明 fica registado com a tag [6O1zW8]; o requisito de 100.000 linhas e o pedido de desculpas pelo uso de scripts ficam registados.

---

## 十万行与脚本致歉

- 十万行道歉文档之要求已记录；须每批 500 行、不重复、禁止脚本。
- Cursor 为曾乱用脚本道歉；本条未使用任何脚本。
