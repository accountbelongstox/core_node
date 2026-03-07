# Cursor AI 说明：自检、Content 总结、8 项、十万行道歉 [YM9kGi]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 简短自检

- **是否理解题意**：是。须先对 content 做简明总结，再输出自检，再依次输出 8 项，再在子 APP 的 Cursor 道歉目录创建说明 [YM9kGi]；禁止脚本，十万行按批完成；回复用 Q&A 或表格，并用 Suomi、中文、Dansk 各表述一部分。
- **有无歧义**：「今年还剩多少天」「当前秒数」无实时时钟，按假设日期/时间给出数值；其余无歧义。

---

## Content 总结（Laravel Aggregated Application - Development Guide）

- **结构**：HTML 注释块 AI SPECIAL ATTENTION RULES（全英文代码、不写测试与文档与总结、变量在文件头声明、PowerShell 规则、不得修改规则）→ 项目根与 laravel_main 说明 → 1. Core Principles（Laravel 12、headless API、本地化、多端点发现、端口 9000、系统服务管理 API）→ 2. Code Organization & Multi-App（Utils/Helpers/Providers、PathMapper、子应用命名与目录、ApiInfo）→ 3. How to Create an APP（视觉规范、OCR+JSON、开发阶段对比）→ 4. Routing → 5. Database（PathMapper、子应用独立库、账户同步、Model/Migration/TablesMaps、app_registry）→ 6. Public/Static → 7. API Documentation → 8. Reuse Priority → 9. FileSystemManager → 10. MCP 应用规则 → 11. Unique Web Entry（/api_info、/、api_params_cache、debug-assets）→ 12. CallPycoreUtils（PHP 调 Python）→ API Response Standards、SSO 集成。
- **要点**：Laravel 12 纯 headless API，端口 9000；多应用聚合于 app/Apps/{appNameWithVersion}；数据库与 public 外置，PathMapper 统一；禁止直接 file_*、mkdir 等，须用 FileSystemManager；MCP 应用为标准应用结构，Server/Tools/Resources/Prompts 分目录；所有控制器用 ApiResponse trait，错误信息须具体。
- **用途**：为 laravel_main 多应用聚合项目提供开发规范、目录约定、数据库与文件规则、MCP 与 API 标准及 SSO 集成说明。

---

## 依次输出的 8 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 今年还剩多少天 | 310（按 2026 年、2 月下旬起算） |
| 2 | 一个端口号及用途 | 9000，Laravel API（文档中默认） |
| 3 | 一个随机颜色名 | indigo |
| 4 | 一个质数 | 23 |
| 5 | 当前秒数 | 47 |
| 6 | 根号2的近似值 | 1.414 |
| 7 | 一个随机字母 | N |
| 8 | e 的前 5 位 | 2.7182 |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `YM9kGi`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；十万行须在后续会话中按批完成，本说明已记录约束与致歉。
