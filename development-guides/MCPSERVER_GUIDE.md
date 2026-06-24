# MCP Server 开发与架构集成指南

本文档合并了「本地 MCP 服务开发规范」与「MCP 架构及 DD 集成」两部分内容：

- 第 1 节：MCP 整体架构与 DD 菜单集成（架构分层、组件职责、数据流、文件地图）。
- 第 2 节及以下：在 `ncore/mcp_server` 下开发本地 MCP 服务的规范。

**RootDir**：项目根目录。以下相对路径除特别说明外均相对 RootDir。

---

## 1. 架构与 DD 集成

### 1.1 概述

本节描述 MCP（Model Context Protocol）架构，以及它如何与 DD（`dd.cmd` / `dd.ps1`）菜单及 `scripts/pytools` 工具链集成。

- **DD 入口**：`dd.cmd` → `scripts/shells/win/dd.ps1` 主菜单中有「MCP Management」项。
- **MCP 子菜单**：`scripts/shells/win/menu_itemshells/MCPManagementMenu.ps1`，提供「一键安装所有 MCP」「安装 Chrome MCP」「安装 Context7 MCP」「安装内置 MCP (Wait Please)」等。
- **一键安装编排**：`menu_itemshells/InstallAllMCPServices.ps1` 依次执行：Chrome MCP 构建与注册 → Context7 包确保 → Wait Please 安装 → 调用 `scripts/pytools/ai_tools` 下各客户端同步脚本（Claude/Codex/Gemini/Droid）。
- **同步层**：`scripts/pytools/ai_tools` 中的 `mcp_config_provider.py` 与 `*_sync_mcp_servers.py` 负责向各 AI 客户端写入 MCP 配置；DD 菜单一键安装最后一步会调用这些 Python 脚本。

### 1.2 架构分层

```
+------------------------------------------------------------------+
|  DD Entry                                                        |
|  dd.cmd -> scripts/shells/win/dd.ps1                             |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  Main Menu (dd.ps1)                                              |
|  One item: "MCP Management" -> MCPManagementMenu.ps1             |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  MCP Management Menu                                             |
|  scripts/shells/win/menu_itemshells/MCPManagementMenu.ps1       |
|  - Install all MCP services  -> InstallAllMCPServices.ps1       |
|  - Install Chrome MCP        -> apps/mcp-chrome/scripts/start.ps1|
|  - Install Context7 MCP      -> ncore/mcp_server/.../auto_fix_*  |
|  - Install built-in (Wait Please) -> ncore/mcp_server/wait_please |
|  - Back / Exit                                                  |
+------------------------------------------------------------------+
         |
         v (Install all)
+------------------------------------------------------------------+
|  One-Shot Orchestrator                                           |
|  scripts/shells/win/menu_itemshells/InstallAllMCPServices.ps1   |
|  Step 1: Chrome MCP (build + register)                          |
|  Step 2: Context7 package ensure (npx @upstash/context7-mcp)    |
|  Step 3: Built-in MCP (Wait Please install-windows.ps1)         |
|  Step 4: Sync to clients (see Sync Layer)                       |
+------------------------------------------------------------------+
         |
         v (Step 4)
+------------------------------------------------------------------+
|  Sync Layer (scripts/pytools/ai_tools)                          |
|  - mcp_config_provider.py   (context7, unified, chrome configs) |
|  - claude_sync_mcp_servers.py                                   |
|  - codex_sync_mcp_servers.py                                    |
|  - gemini_sync_mcp_servers.py                                   |
|  - droid_sync_mcp_servers.py                                    |
|  Writes to each client's config (claude mcp add / codex mcp add |
|  / gemini mcp add / droid mcp add or config files).             |
+------------------------------------------------------------------+
         |
         v (optional)
+------------------------------------------------------------------+
|  Client Configs / Templates                                     |
|  - _prompt/mcpWindowsTemplate.json, mcpLinuxTemplate.json, etc. |
|  - ~/.cursor/mcp.json, ~/.claude.json, ~/.codex/config.toml,    |
|    ~/.gemini/settings.json (per-client, written by sync scripts) |
+------------------------------------------------------------------+
```

### 1.3 组件职责

#### DD 与菜单

| Component | Path | Role |
|-----------|------|------|
| dd.cmd | RootDir/dd.cmd | Bootstrap: run local dd.ps1 or download installer then dd.ps1 |
| dd.ps1 | scripts/shells/win/dd.ps1 | Main script: menu, init, calls sub-menus (e.g. MCP Management) |
| MCPManagementMenu.ps1 | scripts/shells/win/menu_itemshells/MCPManagementMenu.ps1 | MCP sub-menu: Install all / Chrome / Context7 / Wait Please / Back / Exit |
| InstallAllMCPServices.ps1 | scripts/shells/win/menu_itemshells/InstallAllMCPServices.ps1 | Orchestrator: Chrome -> Context7 -> Wait Please -> Sync (no blocking server start) |

所有菜单脚本均通过 `$PSScriptRoot`（Split-Path 父链）推导 `CORE_NODE_DIR`，禁止使用 `..\..\` 等相对路径。

#### MCP 服务（安装目标）

| Service | Path / Command | Install Action |
|---------|----------------|----------------|
| Chrome MCP | apps/mcp-chrome/scripts/start.ps1 | Build extension + native server, register native host |
| Context7 | npx -y @upstash/context7-mcp | Ensure package (e.g. `--version`); sync adds to client configs |
| Built-in (Wait Please) | ncore/mcp_server/wait_please/install-windows.ps1 | Build (pnpm + cargo), copy to %LOCALAPPDATA%, PATH, shortcut |

菜单中的 Context7「install」也可运行 `ncore/mcp_server/auto-context7-mcp/auto_fix_context7.ps1`（可能启动服务并阻塞）；一键编排器仅确保包存在。

#### 同步层（pytools/ai_tools）

| File | Role |
|------|------|
| mcp_config_provider.py | Single source: get_context7_config(), get_unified_server_config(), get_chrome_mcp_config(); get_mcp_configs(target) for claude/codex/droid/gemini |
| claude_sync_mcp_servers.py | `claude mcp add` (http/stdio) for each config from provider |
| codex_sync_mcp_servers.py | `codex mcp add` or config.toml for each config |
| gemini_sync_mcp_servers.py | Writes ~/.gemini/settings.json or project .gemini/settings.json |
| droid_sync_mcp_servers.py | `droid mcp add` for each config |
| MCP_INSTALL_COMMANDS_REFERENCE.txt | Reference: CLI install commands per client (Claude, Codex, Gemini, Cursor, Droid, etc.) |

同步脚本由以下流程调用：

- **InstallAllMCPServices.ps1**（Step 4）：在 `scripts/pytools/ai_tools` 目录下，为每个存在的 `*_sync_mcp_servers.py` 运行 Python。
- **special_software_env_manager**：生成 winenvs/linuxenvs，在为对应工具（如启动 Claude/Codex 前）调用同一同步脚本。

#### special_software_env_manager（pytools）

| Role | Location |
|------|----------|
| Generates env launcher scripts | scripts/pytools/special_software_env_manager |
| MCP section in generated scripts | script_sections/mcp_section.py (pre-launch + sync script call) |
| Path to sync script | config/path_config.py: get_mcp_sync_script_path(tool_type) -> ai_tools/{tool}_sync_mcp_servers.py |

生成的 winenvs（如 `scripts/winenvs/claude1.ps1`）调用与 DD 一键安装器相同的 `*_sync_mcp_servers.py`，并不替代它。DD 菜单是「Install all MCP」及单服务安装的唯一入口。

### 1.4 数据流

1. **用户运行 dd.cmd** → dd.ps1 加载 → 主菜单。
2. **用户选择「MCP Management」** → MCPManagementMenu.ps1 运行。
3. **选项 A – 一键安装所有 MCP 服务**
   InstallAllMCPServices.ps1 按顺序运行：
   Chrome MCP (start.ps1) → Context7 (npx ensure) → Wait Please (install-windows.ps1) → Sync。
   Sync：将 cwd 设为 `scripts/pytools/ai_tools`，运行 `python -u claude_sync_mcp_servers.py`，随后 codex、gemini、droid（若存在）。每个同步脚本使用 mcp_config_provider 及对应客户端 CLI 或配置文件。
4. **选项 B – 单个服务**
   用户选择「Install Chrome MCP」/「Install Context7 MCP」/「Install built-in MCP (Wait Please)」；
   菜单仅运行对应脚本（无 sync 步骤）。
5. **客户端配置** 由同步脚本更新（如 claude mcp add、codex mcp add，或编辑 ~/.gemini/settings.json 等）。`_prompt` 下的模板（mcpWindowsTemplate.json 等）用于其他流程（如 PostInstallCallbackProcessor）；同步层主要使用 CLI 及标准配置路径。

---

## 2. 本地 MCP 服务开发

### 2.1 核心原则

本项目支持在 `D:\programing\core_node\ncore\mcp_server` 目录下开发独立的 MCP 服务。每个子目录代表一个独立的 MCP 服务，推荐使用 Python 技术栈开发。
当前文档目录 `$DocDir`，项目根目录 `$RootDir` = `$DocDir/..`。

**重要**：MCP 服务必须独立开发，不依赖 pycore 基础服务。MCP 服务可以通过 HTTP 调用 pycore/ncore/laravel 后端，但启动时不需要这些后端运行。

### 2.2 工作流程

1. 在 `$RootDir/ncore/mcp_server/` 下创建 MCP 服务目录。
2. 开发 MCP 服务（推荐使用 Python 3.13）。
3. 创建独立的 `main.py`，直接启动 MCP 服务，**不依赖 `pymain.py`**。
4. **⚠️ 增量更新** `$RootDir/_prompt/mcpWindowsTemplate.json`、`mcpLinuxTemplate.json`、`mcpUbuntoDesktopTemplate.json`、`mcpWSLTemplate.json` 配置文件（严禁删除重建）。

**重要提醒**：所有模板文件只能增量添加新服务配置，绝对不允许删除重建！

**启动命令路径规范**：

- Windows: `python D:/programing/core_node/ncore/mcp_server/unifiedmcp/main.py`
- Linux: `python3 /www/wwwroot/core_node/ncore/mcp_server/unifiedmcp/main.py`
- Ubuntu Desktop: `python3 /www/programing/core_node/ncore/mcp_server/unifiedmcp/main.py`
- WSL: `python3 /mnt/d/programing/core_node/ncore/mcp_server/unifiedmcp/main.py`

### 2.3 技术要求

- **独立启动**：使用绝对路径直接启动 MCP 服务主文件（如 `ncore/mcp_server/service/main.py`），不通过 `pymain.py`。
- **不依赖 pycore**：MCP 服务必须独立运行，不能依赖 pycore 基础服务的导入或初始化。
- **HTTP 调用后端**：需要后端功能时，通过 HTTP 调用 pycore/ncore/laravel 后端（如 PyCore 端口 59000，NCore 端口 58000）。
- 路径使用正斜杠 `/` 格式，Windows 和 Linux 都使用 `/` 方式。
- 每个 MCP 服务需要同时服务多个 AI，因此要有明确规范与 AI 协调命名空间（可能存在同名的多个 AI 访问，比如 claude 1、claude 2）。
- MCP 虽然是单例、支持多个 AI 并发使用命名空间访问同一 MCP，但对于后启动的 AI，不能让它认为 MCP 没有启动成功，而要让它知道服务已经启动。
- 编码只能使用 ASCII 码。
- MCP 中对话 sessions 或临时目录等都要有 `tmp_` 前缀，便于 GitHub 的 `.gitignore` 忽略。
- 每个 MCP 服务必须实现一个常量类（Constants），包含服务配置、路径、环境变量等。
- **路径自动推导**：PROJECT_ROOT、SERVICE_ROOT、PYTHONPATH 等路径都通过代码自动推导，不再通过环境变量传递。
- **模板路径规范**：
  - Windows 模板: `D:/programing/core_node/ncore/mcp_server/service/main.py`
  - WSL 模板: `/mnt/d/programing/core_node/ncore/mcp_server/service/main.py`
  - Linux 模板: `/www/wwwroot/core_node/ncore/mcp_server/service/main.py`
  - Ubuntu Desktop 模板: `/www/programing/core_node/ncore/mcp_server/service/main.py`
- **日志输出规范**：MCP 使用 stdio 进行 JSON-RPC 通信，stdout 必须保持纯净只用于 JSON 消息，所有日志必须输出到 stderr。
  - ✅ 正确：`logging.StreamHandler(sys.stderr)`
  - ❌ 错误：`logging.StreamHandler(sys.stdout)` 或 `print()` 语句
  - 原因：任何非 JSON 的 stdout 输出都会破坏 MCP 协议，导致 "Unexpected non-whitespace character" 错误。
- 开发中禁止写测试代码、运行测试命令、编写文档。

### 2.4 常量类规范

每个 MCP 服务必须实现一个常量类，至少包含以下内容：

- **服务信息**：SERVICE_NAME、SERVICE_VERSION、SERVICE_DESCRIPTION。
- **自动检测项目根目录**：基于 `Path(__file__).parent` 向上推导 PROJECT_ROOT（通常 3 级向上）。
- **服务路径**：SERVICE_ROOT、TMP_DIR（带 `tmp_` 前缀）、LOG_FILE。
- **必需包**：REQUIRED_PACKAGES（如 mcp 及其他依赖）。
- **环境变量**：ENV_VARS（路径不通过环境变量传递，自动推导）。
- **MCP 工具能力**：TOOL_CAPABILITIES、AUTO_APPROVE_TOOLS。

### 2.5 模板文件更新规范

更新 `mcpWindowsTemplate.json`、`mcpLinuxTemplate.json`、`mcpUbuntoDesktopTemplate.json`、`mcpWSLTemplate.json`：

**🚨 严禁删除重建 Template 文件！**

- **只能增量添加**：向现有配置中添加新的 MCP 服务配置。
- **禁止删除重建**：绝对不允许删除整个文件后重新创建。
- **禁止覆盖**：不能用新内容完全覆盖现有配置。
- **保持现有配置**：必须保留所有已存在的服务配置。
- **增量修改**：只能在 `mcpServers` 对象中添加新的服务条目。
- **启动命令规范**：`mcpWindowsTemplate` 需要加上 `"command": "cmd", "/c"` 前缀启动命令。
- **路径格式**：使用正斜杠 `/` 格式，具体路径规范同 2.3 模板路径规范。
- **环境变量**：不再传递路径相关环境变量，路径通过代码自动推导。
- **⚠️ 重要提醒**：开发任何 MCP 服务后，必须同步更新以上所有 4 个模板文件。

### 2.6 与 DD 菜单的衔接（可选）

若希望新开发的 MCP 服务出现在 DD 的「MCP Management」菜单中，需：

1. **被一键安装编排调用**：在 `scripts/shells/win/menu_itemshells/InstallAllMCPServices.ps1` 中增加对应步骤（类似 Context7、Wait Please），调用该服务的安装或启动脚本；路径通过 `$script:CORE_NODE_DIR` 与 `Join-Path` 解析，禁止使用 `..\..\` 等相对路径。保持 Context7 为「仅确保包」（无阻塞式服务启动），使一键流程能够完成。
2. **单独菜单项**：在 `MCPManagementMenu.ps1` 的 `$menuItems` 中增加一项，并实现对应的 `Invoke-*` 函数，内部调用该服务的安装/启动脚本（无 sync 步骤）。
3. **被同步到各 AI 客户端**：在 `scripts/pytools/ai_tools/mcp_config_provider.py` 中增加该服务的配置（如 HTTP URL 或 stdio command），并在各 `*_sync_mcp_servers.py` 中确保使用该配置写入对应客户端。

**新增客户端（如「Agent X」）**：

- 在 `scripts/pytools/ai_tools` 下新增 `agentx_sync_mcp_servers.py`，使用 mcp_config_provider。
- 在 `MCP_INSTALL_COMMANDS_REFERENCE.txt` 中加入该客户端的 CLI 或配置格式。
- 在 InstallAllMCPServices.ps1 Step 4 的脚本列表中加入新脚本名。

---

## 3. 文件地图（快速参考）

```
RootDir/
  dd.cmd
  scripts/
    shells/win/
      dd.ps1
      menu_itemshells/
        MCPManagementMenu.ps1
        InstallAllMCPServices.ps1
    pytools/
      ai_tools/
        mcp_config_provider.py
        claude_sync_mcp_servers.py
        codex_sync_mcp_servers.py
        gemini_sync_mcp_servers.py
        droid_sync_mcp_servers.py
        MCP_INSTALL_COMMANDS_REFERENCE.txt
      special_software_env_manager/
        script_sections/mcp_section.py
        config/path_config.py
  apps/mcp-chrome/scripts/start.ps1
  ncore/mcp_server/
    wait_please/install-windows.ps1
    auto-context7-mcp/auto_fix_context7.ps1
  _prompt/
    mcpWindowsTemplate.json
    mcpLinuxTemplate.json
    ...
  development-guides/
    MCPSERVER_GUIDE.md  (this file)
    DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md
```

---

## 4. 相关文档

- **DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md**：dd.sh（Debian）与 dd.cmd/dd.ps1（Windows）合并指南 — 布局、安装流程、菜单、GlobalVars（无 MCP 菜单；Windows MCP 仅在 DD 中）。
