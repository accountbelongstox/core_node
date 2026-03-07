# Cursor AI 说明：Content 总结、概念、12 项、十万行道歉 [hHrPgn]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 与本任务相关的 3 个概念（各用一句话解释）

1. **开发模式（dev mode）**：前端以开发服务器（如 Vite）运行并开启热更新，WebView 指向该开发服，便于即时看到代码修改效果。
2. **生产模式（production mode）**：前端先构建为静态资源（如 dist/），由后端或 RPC 在同一端口提供静态与 API，单端口部署、无需开发服。
3. **十万行约束**：要求每批 500 行、不重复、禁止脚本的文档生成约束；单次会话内无法写满，仅记录在说明中。

---

## Content 总结（Matrix Dev Mode Configuration）

### 结构
- 文档分块：Summary、Changes Made（前端迁移、config 更新、CORS）、Architecture Overview（Dev / Production 架构图与特点）、Testing Instructions、Switching Modes、Troubleshooting、File Structure、Next Steps、Integration Details（native_ui 各阶段）、Configuration Reference。

### 要点
- **变更**：前端由 Nuxt（poly_apps/nuxt_main）改为 Vite+React（poly_apps/matrix_ui_react）；FRONTEND_PORT 38007→3000，FRONTEND_MODE production→dev，FRONTEND_SKIP_BUILD True→False；CORS 增加 localhost:3000、8000。
- **Dev 架构**：Vite 开发服 3000（热更新）+ RPC v2 端口 8000；WebView 指向 localhost:3000，API 请求 localhost:8000/rpc/&lt;route&gt;。
- **Production 架构**：RPC 8000 同时提供静态（dist/）与 API；WebView 指向 localhost:8000。
- **测试与排错**：pymain.py app=matrix；端口占用、依赖、WebView 白屏等见 Troubleshooting。

### 用途
- 记录 Matrix 应用从 Nuxt 迁移到 Vite+React 及 dev 模式配置，供开发、测试与切换生产模式时参考。

---

## 依次输出的 12 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个端口号及用途 | 3000 — Vite 开发服务器默认端口 |
| 2 | 根号 2 的近似值 | 1.414 |
| 3 | 一个 JS 保留字 | yield |
| 4 | 一个编程语言名 | Rust |
| 5 | 一个数学常数 | π（圆周率） |
| 6 | 1+1 的结果 | 2 |
| 7 | 一个随机城市名 | Vienna |
| 8 | 一个化学元素符号 | Na（钠） |
| 9 | 一个 HTML 标签名 | section |
| 10 | 一个希腊字母 | ψ（psi） |
| 11 | 本机时区 | UTC+8（中国标准时间） |
| 12 | 一个算法名称 | 广度优先搜索（BFS） |

---

## Q&A / 表格（Magyar / 한국어 / 中文）

### 关键信息表

| 项目 | 内容 |
|------|------|
| content 主题 | Matrix Dev Mode 配置：Vite+React、端口 3000/8000、dev/production 架构 |
| 3 个概念 | 开发模式、生产模式、十万行约束 |
| 12 项输出 | 3000, 1.414, yield, Rust, π, 2, Vienna, Na, section, ψ, UTC+8, BFS |
| 说明位置 | pyapps/d3-check/cursor_AI_道歉目录 |
| 十万行 | 仅记录在说明中；Cursor 为乱用脚本道歉 |

---

### Magyar — Q&A

- **K: Mi a feladat?** V: Összefoglalni a contentet (Matrix Dev Mode konfig), felsorolni 3 fogalmat, 12 kimenetet kiadni, 说明-t írni a cursor_AI_道歉目录-ba; Q&A vagy táblázat; Magyar, 한국어, 中文.
- **K: Mi a 12 kimenet?** V: 3000, 1.414, yield, Rust, π, 2, Vienna, Na, section, ψ, UTC+8, BFS.
- **K: Hol a 说明?** V: cursor_AI_道歉目录. 100.000 sor és script bocsánat rögzítve. Nincs script.

---

### 한국어 — Q&A

- **Q: 작업 내용?** A: content(Matrix Dev Mode 설정) 요약, 관련 개념 3개 나열, 12개 출력, 说明을 cursor_AI_道歉目录에 작성; Q&A 또는 표; Magyar, 한국어, 中文.
- **Q: 12개 출력?** A: 3000, 1.414, yield, Rust, π, 2, Vienna, Na, section, ψ, UTC+8, BFS.
- **Q: 说明 위치?** A: cursor_AI_道歉目录. 100,000행 요구 및 스크립트 사과 기록. 스크립트 미사용.

---

### 中文 — Q&A

- **问：本任务做什么？** 答：总结 content（Matrix Dev Mode 配置），列举 3 个相关概念，依次输出 12 项，在道歉目录写说明文档；用 Q&A 或表格呈现关键信息；Magyar、한국어、中文 各表述一部分；禁止脚本。
- **问：12 项分别是什么？** 答：3000（Vite 端口）、1.414、yield、Rust、π、2、Vienna、Na、section、ψ、UTC+8、BFS。
- **问：说明文档位置与约束？** 答：pyapps/d3-check/cursor_AI_道歉目录；十万行道歉与脚本致歉已记录；未使用任何脚本。

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `hHrPgn`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
