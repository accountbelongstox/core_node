# MCP Server 指南（架构集成 + 本地服务开发）

两部分：MCP 架构与 DD 菜单集成；在 `ncore/mcp_server/` 下开发本地 MCP 服务。相对路径基于项目根。

## 架构（唯一入口 = DD 菜单）
- `dd.cmd → scripts/shells/win/dd.ps1` 的「MCP Management」菜单是安装/管理 MCP 的唯一入口；一键安装编排顺序：Chrome MCP → Context7（仅确保包）→ 内置 Wait Please → 同步。
- 同步层 `scripts/pytools/ai_tools/`：`mcp_config_provider.py` 为单一配置源，`<client>_sync_mcp_servers.py`（claude/codex/gemini/droid）把配置写入各 AI 客户端；winenvs / special_software_env_manager 复用同一同步脚本，不替代 DD。

## 本地 MCP 服务（核心规范）
- 每个 `ncore/mcp_server/<service>/` 子目录 = 一个独立服务（Python 3.13），有独立 `main.py`，**不经 `pymain.py`、不依赖 pycore**；需后端时走 HTTP（pycore :59000、ncore :58000）。
- 模板 `_prompt/mcp{Windows,Linux,UbuntoDesktop,WSL}Template.json`：**仅增量添加，严禁删除/重建/覆盖**；新增服务后必须同步更新全部 4 个。
- stdio JSON-RPC：**stdout 只输出纯 JSON，所有日志走 stderr**（否则破坏协议）。
- 仅 ASCII；会话/临时目录用 `tmp_` 前缀；路径在代码内自动推导（不经环境变量）；每服务实现一个 Constants 类；多 AI 并发需命名空间协调，后启动的 AI 须能识别服务已就绪。
- 禁止写/运行测试代码与文档。

## 接入 DD 菜单（新服务）
在 `InstallAllMCPServices.ps1` 加一步；在 `MCPManagementMenu.ps1` 加菜单项；在 `mcp_config_provider.py` 加该服务配置（各 `*_sync_mcp_servers.py` 自动写入客户端）。
