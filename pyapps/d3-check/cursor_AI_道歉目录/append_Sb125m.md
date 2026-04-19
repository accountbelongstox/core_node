# [Sb125m]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 简明总结（Port Configuration Update & Environment Variable Passing）

**结构**：Markdown 文档，日期 2025-12-07，状态 Complete。含 Summary；Changes Overview（端口变更表：前端 3000→38007、后端 8000→48000；环境变量自动传递，支持 Vite/React/CRA/Next.js）；Files Modified（config.py 的 WEB_PORT/FRONTEND_PORT/CORS、vite.config.ts 的 port、frontend_config.py 的 env_vars、frontend_thread.py 的 Vite 命令与 _build_env、launch_native_app.py 的 frontend_env_vars 与 FrontendConfig）；Architecture Diagram（Dev 与 Production 模式示意）；Environment Variables Available（Vite/React/Next.js 示例）；Testing（启动命令、验证项、调试输出）；Benefits；Migration；Troubleshooting；Future Enhancements。  
**要点**：前端 38007、后端 48000；通过 env_vars 向前端传递 VITE_API_URL、REACT_APP_*、NEXT_PUBLIC_*；Vite 改用 npm run dev 避免 Windows FileNotFoundError；CORS 含两端口。  
**用途**：Matrix 应用端口与前端环境变量配置说明及迁移、测试与排错指南。

---

## 将做的步骤（至少 4 条）

1. 对《Port Configuration Update & Environment Variable Passing》content 做简明总结（结构、要点、用途）。  
2. 列举与本任务相关的 3 个概念并各用一句话解释。  
3. 依次输出十六进制随机数、物理常数名、一句格言、正则符号含义、随机单词、1+1 的结果共 6 项。  
4. 在道歉目录创建 append_Sb125m.md，写入总结、步骤、概念、6 项表与标准句。

---

## 与本任务相关的 3 个概念

1. **端口配置**：前端与后端监听端口（如 38007、48000）在 config 与 vite 中统一设置，用于避免与其它服务冲突并符合 Matrix 约定。  
2. **环境变量传递**：启动前端进程时由 launcher 构建 VITE_*、REACT_APP_*、NEXT_PUBLIC_* 等并写入 FrontendConfig.env_vars，frontend_thread 在 _build_env 中注入子进程环境，使前端无需硬编码后端 URL。  
3. **CORS**：后端在 config 中声明允许的来源（如 localhost:38007、localhost:48000），使浏览器允许前端页面向后端发起跨域请求。

---

## [Sb125m] 6 项输出

| # | 项目 | 值 |
|---|------|-----|
| 1 | 十六进制随机数 | B3 |
| 2 | 物理常数名 | c（光速） |
| 3 | 一句格言 | Knowledge is power. |
| 4 | 正则符号含义 | \d 表示数字字符 |
| 5 | 随机单词 | anchor |
| 6 | 1+1 的结果 | 2 |

---

## 标准句

同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
