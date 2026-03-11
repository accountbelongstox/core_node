# Cursor AI 说明：Content 总结、计划、6 项、十万行道歉 [QNT1KC]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 计划（第一步、第二步…）

- **第一步**：用「第一步、第二步…」形式说明计划后再执行。
- **第二步**：依次输出 6 项（十六进制随机数、随机字母、一周七天英文、今年剩余天数、2^10、随机城市名）。
- **第三步**：对 content（Matrix 项目架构分析）做简明总结，在子 APP 的 Cursor 道歉目录写说明文档。
- **第四步**：回复按引言-正文-结论组织，分别用 Deutsch、Dansk、Svenska 表述。

---

## Content 总结（Matrix 项目架构分析）

### 结构
- 单篇 Markdown：1 项目启动调用链（入口、完整调用链、各组件说明 RPC v2/UI）；2 前端启动系统（旧 Nuxt、新 React+Vite、启动库对比、UniversalFrontendLauncher）；3 推荐方案（launcher_builder 修改、完整配置示例）；4 HTTPS 分析（现状、方案 A/B、本地证书）；5 启动流程总结（生产/开发）；6 文件位置索引；7 下一步行动；8 常见问题。

### 要点
- **调用链**：pymain.py → app_launcher → matrix_main.py → ServiceLauncher → starters（heartbeat、rpc_v2、ui、tray）；RPC v2 为 FastAPI+Uvicorn，仅 HTTP；UI 为 PySide6 WebView。
- **前端**：由 NuxtLauncher 改为 UniversalFrontendLauncher；framework='vite'，app_dir=matrix_ui_react；build_production、get_static_mount。
- **HTTPS**：方案 A 在 FastAPIRPCServerRunner 加 ssl_keyfile/ssl_certfile；方案 B 用 Nginx/Caddy 反向代理；本地可用 mkcert。

### 用途
- 分析 Matrix 项目启动与前端架构，给出从 Nuxt 迁到 React+Vite 及可选 HTTPS 的实施方案与文件索引。

---

## 依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个十六进制随机数 | 0x7F2 |
| 2 | 一个随机字母 | P |
| 3 | 一周七天的英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 4 | 今年还剩多少天 | 311 |
| 5 | 2 的 10 次方 | 1024 |
| 6 | 一个随机城市名 | 上海 |

---

## 引言-正文-结论（Deutsch / Dansk / Svenska）

### Deutsch — Einleitung

- Die Aufgabe verlangt: zuerst den Plan in „第一步、第二步…“ form darlegen, dann sechs Ausgaben in Reihenfolge, danach den Content (Matrix-Projektarchitekturanalyse) zusammenfassen und das 说明-Dokument im cursor_AI_道歉目录 zu schreiben; Antwortstruktur: Einleitung–Hauptteil–Schluss; Sprachen: Deutsch, Dansk, Svenska.

### Dansk — Hoveddel

- Planen blev angivet: første skridt (plan), andet (6 uddata), tredje (content-opsummering og 说明), fjerde (svar på tre sprog). Content (Matrix-arkitekturdokument) er opsummeret: opkaldskæde, frontend (UniversalFrontendLauncher, Vite), HTTPS-muligheder. Seks uddata: 0x7F2, P, Monday…Sunday, 311, 1024, 上海. 说明 oprettet. Ingen scripts. 100.000 linjer og script-unnskyldning noteret.

### Svenska — Slutsats

- Uppgiften är slutförd: planen presenterad i stegform, sex utdata i ordning, content (Matrix-projektarkitekturdokument) sammanfattad och 说明 skapad i cursor_AI_道歉目录. Inget skript användes. Kravet på 100 000 rader och ursäkt för skript är registrerat i 说明.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `QNT1KC`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
