# MCP Architecture and DD Integration

## 1. Overview

This document describes the **redesigned MCP (Model Context Protocol) architecture** and how it integrates with the DD (dd.cmd / dd.ps1) menu and with `scripts/pytools` tooling. It complements `MCPSERVER_GUIDE.md` (local MCP server development) and `DD_POWERSHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md` (DD PowerShell structure).

**RootDir**: project root. Paths below are relative to RootDir unless stated otherwise.

---

## 2. Architecture Layers

```
+------------------------------------------------------------------+
|  DD Entry                                                        |
|  dd.cmd -> scripts/shells/win/dd.ps1                             |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  Main Menu (dd.ps1)                                              |
|  One item: "MCP Management" -> MCPManagementMenu.ps1              |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|  MCP Management Menu                                             |
|  scripts/shells/win/menu_itemshells/MCPManagementMenu.ps1        |
|  - Install all MCP services  -> InstallAllMCPServices.ps1       |
|  - Install Chrome MCP        -> apps/mcp-chrome/scripts/start.ps1|
|  - Install Context7 MCP       -> ncore/mcp_server/.../auto_fix_*   |
|  - Install built-in (Wait Please) -> ncore/mcp_server/wait_please |
|  - Back / Exit                                                     |
+------------------------------------------------------------------+
         |
         v (Install all)
+------------------------------------------------------------------+
|  One-Shot Orchestrator                                           |
|  scripts/shells/win/menu_itemshells/InstallAllMCPServices.ps1    |
|  Step 1: Chrome MCP (build + register)                           |
|  Step 2: Context7 package ensure (npx @upstash/context7-mcp)     |
|  Step 3: Built-in MCP (Wait Please install-windows.ps1)          |
|  Step 4: Sync to clients (see Sync Layer)                         |
+------------------------------------------------------------------+
         |
         v (Step 4)
+------------------------------------------------------------------+
|  Sync Layer (scripts/pytools/ai_tools)                           |
|  - mcp_config_provider.py   (context7, unified, chrome configs)  |
|  - claude_sync_mcp_servers.py                                    |
|  - codex_sync_mcp_servers.py                                     |
|  - gemini_sync_mcp_servers.py                                    |
|  - droid_sync_mcp_servers.py                                     |
|  Writes to each client's config (claude mcp add / codex mcp add  |
|  / gemini mcp add / droid mcp add or config files).               |
+------------------------------------------------------------------+
         |
         v (optional)
+------------------------------------------------------------------+
|  Client Configs / Templates                                       |
|  - _prompt/mcpWindowsTemplate.json, mcpLinuxTemplate.json, etc. |
|  - ~/.cursor/mcp.json, ~/.claude.json, ~/.codex/config.toml,     |
|    ~/.gemini/settings.json (per-client, written by sync scripts)  |
+------------------------------------------------------------------+
```

---

## 3. Component Roles

### 3.1 DD and Menu

| Component | Path | Role |
|-----------|------|------|
| dd.cmd | RootDir/dd.cmd | Bootstrap: run local dd.ps1 or download installer then dd.ps1 |
| dd.ps1 | scripts/shells/win/dd.ps1 | Main script: menu, init, calls sub-menus (e.g. MCP Management) |
| MCPManagementMenu.ps1 | scripts/shells/win/menu_itemshells/MCPManagementMenu.ps1 | MCP sub-menu: Install all / Chrome / Context7 / Wait Please / Back / Exit |
| InstallAllMCPServices.ps1 | scripts/shells/win/menu_itemshells/InstallAllMCPServices.ps1 | Orchestrator: Chrome -> Context7 -> Wait Please -> Sync (no blocking server start) |

All menu scripts derive `CORE_NODE_DIR` from `$PSScriptRoot` (Split-Path parent chain). No relative paths like `..\..\`.

### 3.2 MCP Services (Install Targets)

| Service | Path / Command | Install Action |
|---------|----------------|----------------|
| Chrome MCP | apps/mcp-chrome/scripts/start.ps1 | Build extension + native server, register native host |
| Context7 | npx -y @upstash/context7-mcp | Ensure package (e.g. `--version`); sync adds to client configs |
| Built-in (Wait Please) | ncore/mcp_server/wait_please/install-windows.ps1 | Build (pnpm + cargo), copy to %LOCALAPPDATA%, PATH, shortcut |
| Built-in (Unified) | pymain.py app=mcp | No separate install; sync scripts add stdio config to clients |

Context7 “install” in the menu can also run `ncore/mcp_server/auto-context7-mcp/auto_fix_context7.ps1` (may start the server and block); the one-shot orchestrator only ensures the package.

### 3.3 Sync Layer (pytools/ai_tools)

| File | Role |
|------|------|
| mcp_config_provider.py | Single source: get_context7_config(), get_unified_server_config(), get_chrome_mcp_config(); get_mcp_configs(target) for claude/codex/droid/gemini |
| claude_sync_mcp_servers.py | `claude mcp add` (http/stdio) for each config from provider |
| codex_sync_mcp_servers.py | `codex mcp add` or config.toml for each config |
| gemini_sync_mcp_servers.py | Writes ~/.gemini/settings.json or project .gemini/settings.json |
| droid_sync_mcp_servers.py | `droid mcp add` for each config |
| MCP_INSTALL_COMMANDS_REFERENCE.txt | Reference: CLI install commands per client (Claude, Codex, Gemini, Cursor, Droid, etc.) |

Sync scripts are invoked by:

- **InstallAllMCPServices.ps1** (Step 4): from `scripts/pytools/ai_tools`, runs Python for each `*_sync_mcp_servers.py` present.
- **special_software_env_manager**: generates winenvs/linuxenvs that call the same sync script for the given tool (e.g. before launching Claude/Codex).

### 3.4 special_software_env_manager (pytools)

| Role | Location |
|------|----------|
| Generates env launcher scripts | scripts/pytools/special_software_env_manager |
| MCP section in generated scripts | script_sections/mcp_section.py (pre-launch + sync script call) |
| Path to sync script | config/path_config.py: get_mcp_sync_script_path(tool_type) -> ai_tools/{tool}_sync_mcp_servers.py |

Generated winenvs (e.g. scripts/winenvs/claude1.ps1) call the same `*_sync_mcp_servers.py` as the DD one-shot installer; they do not replace it. DD menu is the single entry for “Install all MCP” and per-service installs.

---

## 4. Data Flow

1. **User runs dd.cmd** -> dd.ps1 loads -> main menu.
2. **User selects “MCP Management”** -> MCPManagementMenu.ps1 runs.
3. **Option A – Install all MCP services**  
   InstallAllMCPServices.ps1 runs in order:  
   Chrome MCP (start.ps1) -> Context7 (npx ensure) -> Wait Please (install-windows.ps1) -> Sync.  
   Sync: set cwd to `scripts/pytools/ai_tools`, run `python -u claude_sync_mcp_servers.py`, then codex, gemini, droid (if present). Each sync script uses mcp_config_provider and the client CLI or config file.
4. **Option B – Single service**  
   User picks “Install Chrome MCP” / “Install Context7 MCP” / “Install built-in MCP (Wait Please)”;  
   menu runs the corresponding script only (no sync step).
5. **Client configs** are updated by the sync scripts (e.g. claude mcp add, codex mcp add, or editing ~/.gemini/settings.json, etc.). Templates under _prompt (mcpWindowsTemplate.json, etc.) are used by other flows (e.g. PostInstallCallbackProcessor); sync layer primarily uses the CLIs and standard config paths.

---

## 5. Adding a New MCP Service (High Level)

- **New installable MCP (e.g. new server in ncore/mcp_server):**  
  - Implement and document in `MCPSERVER_GUIDE.md`.  
  - Add a menu item in MCPManagementMenu.ps1 and, if desired, a step in InstallAllMCPServices.ps1.  
  - If clients should see it, add config in mcp_config_provider.py and extend sync scripts as needed.

- **New client (e.g. “Agent X”):**  
  - Add `agentx_sync_mcp_servers.py` in scripts/pytools/ai_tools using mcp_config_provider.  
  - Add the client’s CLI or config format to MCP_INSTALL_COMMANDS_REFERENCE.txt.  
  - In InstallAllMCPServices.ps1 Step 4, add the new script name to the list run from ai_tools.

- **New “Install all” step:**  
  - Add a function and step in InstallAllMCPServices.ps1; keep Context7 as package-only (no blocking server) so the one-shot flow finishes.

---

## 6. File Map (Quick Reference)

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
    MCPSERVER_GUIDE.md
    MCP_ARCHITECTURE_AND_DD_INTEGRATION.md  (this file)
    DD_POWERSHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md
```

---

## 7. Related Docs

- **MCPSERVER_GUIDE.md**: Local MCP server development under ncore/mcp_server, template rules.
- **DD_POWERSHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md**: dd.cmd/dd.ps1 layout, install flow, menu, GlobalVars, DevInstaller.
- **DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md**: dd.sh and Linux shell layout (no MCP menu there; Windows MCP is DD-only).
