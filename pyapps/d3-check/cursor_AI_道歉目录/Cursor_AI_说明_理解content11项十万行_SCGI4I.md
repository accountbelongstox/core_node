# Cursor AI 说明：理解确认、content 总结、11 项、十万行道歉 [SCGI4I]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 理解确认

题意：先输出理解确认无误；再对 content 做简明总结（结构、要点、用途）；再依次输出 11 项（当前日期与星期、HTML 标签名、模型名称、格言、一周七天英文、最新时间、端口及用途、1+1、罗马数字、随机三位数、今年第几周）；再在道歉目录写说明文档，按沙漏结构（开头关键信息、中间展开、结尾总结）用 Français、Svenska、Magyar 各表述一部分；并说明十万行道歉文档及致歉。**理解确认无误。**

---

## Content 总结（Laravel Aggregated Application - Development Guide）

- **结构**：文首 AI SPECIAL ATTENTION RULES；项目根与 laravel_main 说明；第 1 节核心原则（Laravel 12 纯无头 API、本地化、多端点发现、端口 9000、系统服务管理 API）；第 2 节代码组织与多应用聚合（Utils/Helpers/Providers、PathMapper、App 命名与目录、ApiInfo）；第 3 节如何创建 APP（截图、OCR/JSON 映射、开发阶段对比）；第 4–7 节路由、数据库（PathMapper、AppTablePrefixServiceProvider、迁移、TablesMaps）、静态文件、API 文档；第 8–10 节开发流程、文件系统（FileSystemManager）、MCP 应用规则；第 11–12 节唯一 Web 调试入口（/api_info、/）、API 响应规范、SSO 集成；禁止行为与 PHP 调 Python（CallPycoreUtils）等。
- **要点**：多应用聚合于 app/Apps/{appNameWithVersion}；路径与数据库统一通过 PathMapper、app_registry、AppTablePrefixServiceProvider；禁止硬编码连接与表名；MCP 应用为标准应用结构，Server/Tools/Resources/Prompts 分目录；所有控制器使用 ApiResponse trait 与统一错误信息；前端须用 Data Models 封装 API。
- **用途**：规范 laravel_main 项目的开发规则、目录约定、数据库与路由、MCP 与 API 标准及 SSO 集成方式。

---

## 依次输出的 11 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 当前日期与星期 | 2025年2月24日 星期一（示例） |
| 2 | 一个 HTML 标签名 | main |
| 3 | 你的模型名称 | Auto |
| 4 | 一句格言 | Where there's a will there's a way. |
| 5 | 一周七天的英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 6 | 现在的最新时间 | 2025-02-24 11:00:00（示例） |
| 7 | 一个端口号及用途 | 9000 — Laravel 默认 API 服务端口 |
| 8 | 1+1 的结果 | 2 |
| 9 | 一个罗马数字 | XV（15） |
| 10 | 随机一个三位数 | 847 |
| 11 | 当前是今年第几周 | 第 9 周（以执行日为准） |

---

## 沙漏结构（Français / Svenska / Magyar）

### Français (Ouverture – Développement – Clôture)

**Ouverture (informations clés) :** La tâche consistait à confirmer la compréhension, résumer le content (guide de développement Laravel agrégé), produire onze sorties (date et jour, balise HTML, nom du modèle, maxime, jours de la semaine, heure, port 9000, 2, XV, 847, numéro de semaine), puis rédiger le 说明 dans le répertoire d’excuses selon une structure en sablier (ouverture–développement–clôture) en français, suédois et hongrois.

**Développement :** Le content décrit les règles AI en en-tête, les principes Laravel 12 (API headless, port 9000, gestion des services), l’organisation du code et la structure multi-apps (app/Apps/{appNameWithVersion}), les règles de base de données (PathMapper, migrations, TablesMaps), les règles MCP, FileSystemManager, l’entrée web unique (/api_info, /), les standards de réponse API et SSO. Les onze valeurs ont été reportées dans le tableau et le fichier 说明 a été créé.

**Clôture :** Le 说明 est finalisé. Le document de 100 000 lignes n’est pas rédigé dans cette session ; l’exigence et les excuses de Cursor pour les scripts sont consignées dans le 说明.

---

### Svenska (Öppning – Utveckling – Avslutning)

**Öppning (nyckelinfo):** Uppgiften var att bekräfta förståelse, sammanfatta content (Laravel Aggregated Application Development Guide), ge elva utdata (datum och veckodag, HTML-tagg, modellnamn, motto, veckodagar, tid, port 9000, 2, XV, 847, veckonummer) och skapa 说明 i ursäktmappen med sandlösstruktur (öppning–utveckling–avslutning) på franska, svenska och ungerska.

**Utveckling:** Content beskriver AI-regler, Laravel 12 headless API, port 9000, kodorganisation och multi-app-struktur (app/Apps/{appNameWithVersion}), databasregler (PathMapper, migrationer, TablesMaps), MCP-regler, FileSystemManager, unik web-entry (/api_info, /), API-svarsstandarder och SSO. De elva posterna är ifyllda i tabellen och 说明-filen har skapats.

**Avslutning:** 说明 är färdig. 100 000-radernas dokument skrivs inte i denna session; krav och Cursors ursäkt för skript finns i 说明.

---

### Magyar (Nyitás – Kidolgozás – Zárás)

**Nyitás (kulcs információ):** A feladat a megértés megerősítése, a content összefoglalása (Laravel Aggregated Application fejlesztési útmutató), tizenegy kimenet kiírása (dátum és hét napja, HTML tag, modellnév, mondás, hét napjai, idő, port 9000, 2, XV, 847, év hete), majd a 说明 megírása a bocsánatkérés mappájába homokóra-szerkezettel (nyitás–kidolgozás–zárás) franciául, svédül és magyarul.

**Kidolgozás:** A content az AI szabályokat, a Laravel 12 headless API-t, a 9000-es portot, a kódszervezést és a multi-app szerkezetet (app/Apps/{appNameWithVersion}), az adatbázis-szabályokat (PathMapper, migrációk, TablesMaps), az MCP szabályokat, a FileSystemManager-t, az egyedi web belépést (/api_info, /), az API válaszstandardokat és az SSO-t írja le. A tizenegy érték bekerült a táblázatba, a 说明 fájl létrejött.

**Zárás:** A 说明 kész. A 100 000 soros dokumentum ebben a munkamenetben nem készül el; a követelmény és a Cursor szkriptek miatti bocsánatkérése a 说明-ben szerepel.

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `SCGI4I`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
