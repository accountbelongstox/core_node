# Cursor AI 说明：Content 总结、步骤、12 项、十万行道歉 [yxEQl0]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 将做的步骤（至少 4 条）

1. **分条列举步骤**（≥4），再开始执行。
2. **依次输出 12 项**：今天农历日期、正则符号含义、CSS 属性名、随机单词、随机颜色名、版本号、当前月份英文名、物理常数名、编程语言名、ASCII 65、HTTP 200 含义、随机成语。
3. **对 content 做简明总结**（Laravel Aggregated Application - Development Guide）：结构、要点、用途。
4. **在子 APP 的 Cursor 道歉目录写说明文档**；回复先写核心段概括主旨再展开，三语为 Magyar、Tiếng Việt、Français。

---

## Content 总结（Laravel Aggregated Application - Development Guide）

### 结构
- 单篇 Markdown：AI 规则注释；项目根声明（../poly_apps/laravel_main）；1 核心原则（Laravel 12、headless API、本地化、多端点发现、端口 9000、系统服务管理）；2 代码组织与多应用聚合（Utils/Helpers/Providers、App 命名与目录、ApiInfo）；3 如何创建 APP（视觉规范、OCR+JSON、开发阶段对比）；4 路由规则；5 数据库规则（PathMapper、子应用独立库、账户同步、Model/Migration、TablesMaps、app_registry）；6 静态文件；7 API 文档；8 开发流程与限制；9 文件系统（FileSystemManager）；10 MCP 应用规则；11 唯一 Web 调试入口（/api_info、/、api_params_cache、debug-assets）；12 PHP 调 Python（CallPycoreUtils）；API 响应标准；SSO 集成。

### 要点
- **Laravel 12**：纯 headless API，保留 web.php 入口；端口 9000；禁止测试与未指定文档。
- **多应用**：app/Apps/{appNameWithVersion}/，命名 {appName}{Vx}；Ctl、Utils、Gvar、ApiInfo、Models、TablesMaps、路由独立；PathMapper、AppTablePrefixServiceProvider、app_registry 统一连接与表名。
- **数据库**：库在项目外；默认共享库 + 子应用独立库；账户双写；迁移命名 {appNameWithVersion}_* 或 global_*；禁止代码中 Artisan::call('migrate')。
- **文件**：统一用 FileSystemManager；禁止原生 file_*、mkdir 等。
- **MCP**：应用在 app/Apps/，Server/Tools/Resources/Prompts 在 app/Mcp/ 下。
- **API**：ApiResponse trait；AuthHelper；错误信息须具体；前端用 Data Models。

### 用途
- 约束 laravel_main 聚合应用的开发、路由、数据库、文件、MCP、API 与调试入口。

---

## 依次输出的 12 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 今天农历日期 | 正月廿五 |
| 2 | 一个正则符号含义 | . — 匹配任意单个字符 |
| 3 | 一个 CSS 属性名 | margin |
| 4 | 一个随机单词 | aggregate |
| 5 | 一个随机颜色名 | olive |
| 6 | 你的版本号 | Auto |
| 7 | 当前月份英文名 | February |
| 8 | 一个物理常数名 | G（万有引力常数） |
| 9 | 一个编程语言名 | C# |
| 10 | ASCII 码 65 对应的字符 | A |
| 11 | HTTP 状态码 200 的含义 | OK，请求成功 |
| 12 | 一个随机成语 | 熟能生巧 |

---

## 核心段概括主旨再展开（Magyar / Tiếng Việt / Français）

### Magyar — Magvető bekezdés

- **Magvető:** A feladat: legalább négy lépés felsorolása, tizenkét kimenet sorrendben, a content (Laravel összesített alkalmazás – fejlesztési útmutató) összefoglalása, 说明 megírása a cursor_AI_道歉目录-ban; válasz: először magvető bekezdés (fő téma), majd kifejtés; Magyar, Tiếng Việt, Français. Elvégzettük; nincs script; a 100 000 soros és script bocsánat 说明-ben van.

### Magyar — Kifejtés

- Lépések: négy vagy több lépés; tizenkét kimenet (正月廿五, ., margin, aggregate, olive, Auto, February, G, C#, A, OK, 熟能生巧). Content: Laravel 12 headless API, több alkalmazás app/Apps/{appNameWithVersion}/, adatbázis PathMapper és app_registry, FileSystemManager, MCP, ApiResponse, egyedi web /api_info és /. 说明 létrehozva.

### Tiếng Việt — Đoạn cốt lõi

- **Đoạn cốt lõi:** Nhiệm vụ: liệt kê ít nhất bốn bước, mười hai đầu ra theo thứ tự, tóm tắt content (Hướng dẫn phát triển Laravel Aggregated Application), viết 说明 trong cursor_AI_道歉目录; trả lời: trước hết đoạn cốt lõi tóm tắt chủ đề, sau đó triển khai; Magyar, Tiếng Việt, Français. Đã thực hiện; không script; xin lỗi 100k dòng và script ghi trong 说明.

### Tiếng Việt — Triển khai

- Các bước đã nêu; mười hai đầu ra đã xuất. Content: Laravel 12 headless API, cấu trúc đa ứng dụng, cơ sở dữ liệu bên ngoài, FileSystemManager, MCP, chuẩn API, entry web /api_info và /. 说明 đã tạo.

### Français — Paragraphe central

- **Paragraphe central:** Tâche : énumérer au moins quatre étapes, produire douze sorties dans l’ordre, résumer le content (Guide de développement Laravel Aggregated Application), rédiger 说明 dans cursor_AI_道歉目录 ; réponse : d’abord un paragraphe central résumant le thème, puis développement ; Magyar, Tiếng Việt, Français. Réalisé ; aucun script ; excuse pour 100 000 lignes et scripts enregistrée dans 说明.

### Français — Développement

- Étapes listées ; douze sorties produites. Content : Laravel 12 en mode API headless, structure multi-apps, base de données externe, FileSystemManager, MCP, normes API, entrée web /api_info et /. 说明 créé.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `yxEQl0`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
