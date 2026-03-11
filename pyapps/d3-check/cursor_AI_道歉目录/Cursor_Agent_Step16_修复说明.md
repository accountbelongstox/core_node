# Cursor Agent Step16 修复说明（修复文档）

**存放位置**：`pyapps/d3-check/cursor_AI_道歉目录`  
**主题**：Step16 扩展 Applications、Cursor Agent 安装方式与可执行文件名的修正与依据。

---

## 1. 问题与结论

### 1.1 ApplicationsList.xml / ApplicationsList.json 是否被调用

- **结论：安装流程未使用这两个文件。**
- Step16 仅在第 71 行 dot 了 `ApplicationsList.ps1`，使用的包列表来自该脚本内的 `$Global:APPLICATIONS_PACKAGES`、`$Global:BasePackages`、`$Global:COMMON_SOFTWARE_PACKAGES` 等哈希表。
- 仓库内仅以下位置引用 `ApplicationsList.xml`，用途均为 **git/备份 路径列表**，不参与安装逻辑：
  - `scripts/git/gitput_unified.ps1`
  - `scripts/git/gitput_unified.sh`
  - `scripts/git/gitput_unified_modules/config.py`
- 因此此前对 XML/JSON 的修改属于误改（乱写），已**恢复**为修改前状态（`InstallType=web`、`PackageId=https://cursor.com/install`），不再将其视为安装配置源。

### 1.2 可执行文件名：cursor-agent.exe 还是 agent.exe

- **结论：以官方文档为准，安装后运行命令为 `agent`，对应可执行文件为 `agent.exe`。**
- 依据：
  - https://cursor.com/install：安装命令为 `irm 'https://cursor.com/install?win32=true' | iex`（Windows PowerShell）。
  - https://cursor.com/docs/cli/overview：安装后 “Run interactive session” 写的是 **`agent`**，未出现 `cursor-agent.exe`。
- 因此将配置中的主可执行文件名由 `cursor-agent.exe` 改为 **`agent.exe`**，与官方文档一致。

---

## 2. 实际修改（仅动 Step16 真实使用的源）

**唯一被 Step16 安装流程读取的配置源**：`scripts/shells/win/win_common/ApplicationsList.ps1`。

在该文件中 CursorAgent 条目已做如下修正：

1. **Exec**：由 `cursor-agent.exe` 改为 **`agent.exe`**（与官方 “run `agent`” 一致）。
2. **AdditionalKeywords**：改为 `@("agent", "cursor", "cursor-agent")`，以官方主命令 `agent` 优先用于检测。
3. **注释**：注明 Step16 的安装配置仅来自本 .ps1，**ApplicationsList.xml / ApplicationsList.json 不被安装流程读取**，避免后续再对 XML/JSON 做无效修改。

其他逻辑保持不变：`InstallType = "powershell"`，`PowerShellCommand = "irm 'https://cursor.com/install?win32=true' | iex"`，与官方安装方式一致。

---

## 3. 修复文档总结

| 项 | 说明 |
|----|------|
| XML/JSON 是否参与安装 | 否；已恢复原状，不再当安装源使用。 |
| 真实安装配置源 | 仅 `ApplicationsList.ps1`（Step16 第 71 行 dot 该脚本）。 |
| 官方安装后命令 | `agent`（见 cursor.com/docs/cli/overview）。 |
| 主可执行文件名 | `agent.exe`（已写入 ApplicationsList.ps1）。 |

以上内容为本次修复的完整说明，供后续查阅与维护使用。

---

## 4. 为何幂等修复运行后 agent 仍报 MODULE_NOT_FOUND（Access denied）

### 4.1 现象

- 日志中可见：`[CURSORAGENT] Agent runtime missing or corrupt (no index.js under cursor-agent\versions); will re-run install.` 以及 `Installing Cursor agent CLI...`，说明**幂等修复逻辑已执行**。
- 随后报错：`Agent CLI install failed: Access to the path 'merkle-tree-napi.win32-x64-msvc.node' is denied.`
- 再运行 agent 时出现：`Error: Cannot find module '...\cursor-agent\versions\2026.02.13-41ac335\index.js'`（MODULE_NOT_FOUND）。

### 4.2 原因

- **幂等修复有执行**：检测到 runtime 缺失后会调用官方安装脚本（`irm ... | iex`）。
- **安装脚本执行失败**：官方脚本在写入 `merkle-tree-napi.win32-x64-msvc.node`（或同目录下文件）时被系统拒绝访问（文件被占用或当前进程无足够权限），导致 `cursor-agent\versions\<version>\` 下仍缺少或损坏，index.js 不可用。
- 因此不是“没有做幂等修复”，而是“修复时的安装因权限/占用失败”，agent 仍处于损坏状态。

### 4.3 代码侧已做处理

- 在 **CursorAgentPostInstallProcessor.ps1** 中，当安装失败且异常信息包含 `denied` 或 `Access to the path` 时，会多打一行提示：关闭 Cursor/agent 后**以管理员身份**运行：  
  `irm 'https://cursor.com/install?win32=true' | iex`  
 以便用户按提示自行完成修复。

### 4.4 用户侧建议

1. **关闭所有 Cursor 窗口与 agent 进程**，避免目标目录被占用。
2. **以管理员身份打开 PowerShell**，执行：  
   `irm 'https://cursor.com/install?win32=true' | iex`  
3. 若仍报 Access denied，检查杀软/安全软件是否拦截写入 `%LOCALAPPDATA%\cursor-agent`，临时排除或允许后再执行上述命令。
