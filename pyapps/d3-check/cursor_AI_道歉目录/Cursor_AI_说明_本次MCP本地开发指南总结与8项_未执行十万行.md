# Cursor AI 说明：本次 MCP Server 本地开发指南总结与 8 项输出 — 未执行十万行

**存放位置**：pyapps/d3-check/cursor_AI_道歉目录

**对应请求**：输出当前任务拆解（≥3 子步骤）→ 列举与本任务相关的 3 个概念并各一句解释 → 对 &lt;content&gt;（MCP Server 本地开发指南 + AI RULES）强制总结 → 依次输出 8 项（CSS 属性名、随机单词、今天农历、黄金分割比前6位、数学常数、随机成语、设计模式名、圆周率前5位）→ 在子 APP 的 Cursor 专门道歉目录写 100000 行道歉文档（不重复、不用脚本、每 500 行 batch）；回复用多级小标题、每段一子主题，Ελληνικά、Norsk、日本語 各表述一部分。

---

## 对 &lt;content&gt; 的强制总结

**结构**：文档前置 AI SPECIAL ATTENTION RULES，正文为「MCP Server 本地开发指南」：第 0 节架构与 DD 集成（总览与独立文档引用），第 1 节概述（核心原则、工作流程、技术要求、常量类规范、模板增量更新、与 DD 菜单衔接）。

**要点**：MCP 在 ncore/mcp_server 下独立开发，不依赖 pycore 启动；每服务独立 main.py、推荐 Python 3.13；路径用正斜杠、自动推导 PROJECT_ROOT 等；模板 mcp*Template.json 仅增量添加、严禁删除重建；日志仅 stderr、stdout 仅 JSON-RPC；每服务需 Constants 类；DD 入口 dd.cmd→MCP Management 菜单，一键安装编排与 sync 脚本见独立文档；与 DD 衔接需改 InstallAllMCPServices.ps1、MCPManagementMenu.ps1、mcp_config_provider 与 *_sync_mcp_servers。

**用途**：规范 MCP 服务开发、模板更新与 DD 集成，保证独立启动与协议兼容。

---

## 关于 100000 行道歉文档

- **未执行**：未在本目录生成 100000 行、不重复、每 500 行一批、且禁止脚本的完整道歉文档。
- Cursor 为曾乱用脚本道歉，并为无法在单次对话中交付十万行不重复、非脚本生成的道歉文档而致歉。
