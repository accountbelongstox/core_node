# OpenClaw 错乱目录与配置说明

## 一、实地扫描结果（本机）

- **USERPROFILE**: `C:\Users\mpc`
- **USERNAME**: `mpc`
- **配置目录**: `C:\Users\mpc\.openclaw\`（存在）
- **配置文件**: `C:\Users\mpc\.openclaw\openclaw.json`（已读取）
- **工作区配置**: `agents.defaults.workspace` = `C:\\Users\\mpc\\.openclaw\\workspace`（已是**绝对路径**）
- **工作区目录**: `C:\Users\mpc\.openclaw\workspace` 存在（当前为空或仅部分文件）

结论：配置里的工作区和用户名解析（`C:\Users\mpc`）是正确的；错乱路径 `C:\Windows\system32\docs\reference\templates\AGENTS.md` 不是由“配置里 workspace 写错”导致。

---

## 二、配置键名（文档依据）

官方 [Configuration Reference](https://docs.openclaw.ai/gateway/configuration-reference) 使用以下键名（不是 `agent.xxx` 单数）：

| 用途 | 正确键名 | 示例 |
|------|----------|------|
| 默认工作区 | `agents.defaults.workspace` | `"C:\\Users\\mpc\\.openclaw\\workspace"` |
| 跳过 bootstrap 生成 | `agents.defaults.skipBootstrap` | `true` |
| 单 agent 工作区（多 agent 时） | `agents.list[].workspace` | 每个 agent 可单独指定 |

说明：文档里 Agent workspace 页提到的 `agent: { workspace, skipBootstrap }` 与配置参考中的 `agents.defaults.*` 对应；实际生效的是 **`agents.defaults.workspace`** 和 **`agents.defaults.skipBootstrap`**。

---

## 三、为什么 `.openclaw` / 用户名“没解析对”会变成 system32

报错路径是 **`C:\Windows\system32\docs\reference\templates\AGENTS.md`**，说明：

- 解析“模板根目录”时用的**基准目录** = **当前进程的当前工作目录（cwd）**。
- 当 **Gateway 进程的 cwd = `C:\Windows\system32`** 时，`docs/reference/templates` 就会落在 system32 下。

常见原因（与文档一致）：

1. **Gateway 以 Windows 服务 / 计划任务 / 后台方式启动**  
   服务默认“起始目录”往往是 `C:\Windows\system32`，cwd 即为 system32。
2. **启动时未设置“起始目录”**  
   快捷方式或脚本未设置“起始于/WorkingDirectory”，进程继承或退回到 system32。
3. **OpenClaw 内部实现**  
   模板路径若按“安装目录”解析，而安装目录又用 `process.cwd()` 做回退，则 cwd=system32 时就会得到 system32 下的路径。  
   文档未保证“模板一定相对 workspace 解析”，所以存在“相对 cwd 或安装目录”的实现可能。

因此：**不是“用户名”或“`.openclaw`”在配置里解析错**（你本机配置里已是 `C:\Users\mpc\.openclaw\workspace`），而是**运行 Gateway 的进程 cwd 错了**，或实现上用了 cwd 作为模板基准。

---

## 四、环境变量与“家目录”解析（文档）

[Environment variables](https://docs.openclaw.ai/help/environment) 说明：

| 变量 | 作用 |
|------|------|
| `OPENCLAW_HOME` | 覆盖内部使用的“家目录”（即 `~` 的展开基准）。用于 `~/.openclaw/`、agent 目录、sessions、credentials 等。 |
| `OPENCLAW_STATE_DIR` | 覆盖状态目录（默认 `~/.openclaw`）。 |
| `OPENCLAW_CONFIG_PATH` | 覆盖配置文件路径（默认 `~/.openclaw/openclaw.json`）。 |

**优先级**: `OPENCLAW_HOME` > `$HOME` > `USERPROFILE` > `os.homedir()`  

若 Gateway 以**系统服务/其他用户**运行，`USERPROFILE`/`HOME` 可能不是 `C:\Users\mpc`，导致 `~` 被解析到别的目录；若此时模板路径又依赖 cwd，就会出现 system32。

---

## 五、推荐修复（按优先级）

### 1. 启动 Gateway 时设置环境变量（推荐）

让“家目录”和状态目录固定为当前用户，不受运行方式影响：

- 在启动 Gateway 的脚本/任务/服务里设置：
  - `OPENCLAW_HOME=C:\Users\mpc`
  - 或 `OPENCLAW_STATE_DIR=C:\Users\mpc\.openclaw`
- 这样 `~/.openclaw` 会解析到 `C:\Users\mpc\.openclaw`，与当前配置一致。

### 2. 启动 Gateway 时设置“起始目录”

- **计划任务**：在任务属性 → “常规”/“操作”中，设置“起始于”为 `C:\Users\mpc` 或 OpenClaw 安装目录（不要留空或 system32）。
- **快捷方式**：属性 → “起始位置”设为 `C:\Users\mpc`。
- **脚本**：在启动 `openclaw`/node 前 `cd C:\Users\mpc`，或用 `Start-Process -WorkingDirectory C:\Users\mpc`。

这样即使有代码用 cwd 做模板基准，也不会再落到 system32。

### 3. 不需要自动生成引导文件时

在 `C:\Users\mpc\.openclaw\openclaw.json` 中增加（文档 [Configuration Reference](https://docs.openclaw.ai/gateway/configuration-reference)）：

```json
"agents": {
  "defaults": {
    "skipBootstrap": true,
    "workspace": "C:\\Users\\mpc\\.openclaw\\workspace"
  }
}
```

这样 OpenClaw 不会再去查找/生成 `docs/reference/templates` 下的模板，可避免因路径错乱导致的报错。

### 4. 保持工作区为绝对路径（你已满足）

当前配置已是：

```json
"agents": {
  "defaults": {
    "workspace": "C:\\Users\\mpc\\.openclaw\\workspace"
  }
}
```

无需再改；若改用项目目录，可设为 `D:\\programing\\core_node`（且该项目下已有 `docs/reference/templates/`）。

---

## 六、绳结：计划任务未设“起始于”（实地扫描结论）

### 6.1 本机 Gateway 启动方式

- **计划任务**：存在任务 `\OpenClaw Gateway`，触发器为“登录时”，运行用户 `mpc`，执行 `C:\Users\mpc\.openclaw\gateway.cmd`。
- **关键**：该任务的 **“起始于(Start In)”= 未设置**（schtasks 显示为 N/A，PowerShell `WorkingDirectory` 为空）。
- **Windows 行为**：任务未指定“起始于”时，子进程的**当前工作目录（cwd）** 为 **C:\Windows\system32**（[Task Scheduler 默认](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskservice)）。
- **gateway.cmd 内容**：仅设置 PATH/环境变量并执行 `node ...\index.js gateway --port 18777`，**未** 执行 `cd`；故 node 继承任务的 cwd = system32。
- **日志佐证**：当你从**终端**手动跑 Gateway 时，日志里 `workspaceDir`、canvas root、cron storePath 均为 `C:\Users\mpc\.openclaw\*`，且 `_meta.path` 指向 `D:\.dev_win10\node-v24.11.1\node_modules\openclaw-atom\dist\`，说明手动启动时 cwd/路径正常；**计划任务启动**的那次则 cwd=system32，触发 “Missing workspace template: …\\system32\\docs\\reference\\templates\\AGENTS.md”。

### 6.2 为何 ~/.openclaw 解析对、但模板路径错

- 配置路径、workspace 路径来自 **OPENCLAW_STATE_DIR / 配置里的绝对路径**，与 cwd 无关，故 `C:\Users\mpc\.openclaw\*` 正确。
- “docs/reference/templates” 在 OpenClaw 实现里若相对 **process.cwd()** 解析（例如打包模板或 workspace 根的回退），则计划任务下 cwd=system32 时就会得到 `C:\Windows\system32\docs\reference\templates\AGENTS.md`。

### 6.3 修复计划任务（治本）

为“OpenClaw Gateway”任务设置“起始于”为用户目录（或 .openclaw 目录），使进程 cwd 不再为 system32：

```powershell
# 查看当前任务
schtasks /query /tn "OpenClaw Gateway" /fo LIST /v | findstr /i "Start In"

# 修改任务：设置“起始于”为 C:\Users\mpc\.openclaw（需用 /rl HIGHEST 若 UAC 要求）
schtasks /change /tn "OpenClaw Gateway" /ru mpc /rp "" /rl HIGHEST
# 注意：schtasks /change 不能直接改“起始于”。需删除后重建，或在“任务计划程序”GUI 里改。

# 推荐：用 GUI 修改
# 1. taskschd.msc → 任务计划程序库 → 选中 “OpenClaw Gateway”
# 2. 属性 → “常规”选项卡（确认用户为 mpc）
# 3. “操作”选项卡 → 编辑 “启动程序” 的那条
# 4. “起始于(可选)” 填：C:\Users\mpc\.openclaw  或  C:\Users\mpc
# 5. 确定并输入密码（若需要）
```

或用 PowerShell 删除后按“起始于”重建（保留原有触发器/操作）：

```powershell
$action = New-ScheduledTaskAction -Execute "C:\Users\mpc\.openclaw\gateway.cmd" -WorkingDirectory "C:\Users\mpc\.openclaw"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "mpc"
$principal = New-ScheduledTaskPrincipal -UserId "mpc" -LogonType Interactive
# 若已有任务，先 Export 备份再 Delete，再 Register 带 -Action $action 的（含 WorkingDirectory）
```

设置后重启一次任务或重新登录，再打开 Main Session 不应再出现 system32 模板路径。

### 6.4 可选：gateway.cmd 内显式 cd

在 `C:\Users\mpc\.openclaw\gateway.cmd` 开头增加一行，使无论谁调用 cwd 都固定：

```batch
@echo off
cd /d C:\Users\mpc\.openclaw
rem 下面保持原有 set 和 node 调用
```

这样即使用户未改计划任务“起始于”，进程 cwd 也是 `C:\Users\mpc\.openclaw`，不会落到 system32。

---

## 七、小结

| 项目 | 结论 |
|------|------|
| 配置键名 | 使用 **`agents.defaults.workspace`**、**`agents.defaults.skipBootstrap`**（不是 `agent.xxx`）。 |
| 当前用户名 / .openclaw | 本机配置目录与 workspace 均为 `C:\Users\mpc\.openclaw*`，解析正确。 |
| 错乱目录原因 | **计划任务 “OpenClaw Gateway” 未设“起始于”** → 任务启动时进程 cwd = **C:\Windows\system32** → 模板路径被解析为 `C:\Windows\system32\docs\reference\templates\AGENTS.md`。 |
| 建议修复 | **为计划任务设置“起始于”= `C:\Users\mpc\.openclaw`（或 `C:\Users\mpc`）**；或在 **gateway.cmd 开头加 `cd /d C:\Users\mpc\.openclaw`**。可选 **agents.defaults.skipBootstrap: true** 避免依赖模板。 |

文档引用：
- [Configuration Reference](https://docs.openclaw.ai/gateway/configuration-reference)（agents.defaults.workspace / skipBootstrap）
- [Environment variables](https://docs.openclaw.ai/help/environment)（OPENCLAW_HOME / OPENCLAW_STATE_DIR）
- [Agent workspace](https://docs.openclaw.ai/concepts/agent-workspace)
- [Gateway runbook](https://docs.openclaw.ai/gateway)（gateway 启动与端口）
- [Windows (WSL2)](https://docs.openclaw.ai/platforms/windows)（官方推荐 WSL2；本机为原生 Windows + 计划任务）
- **OpenClaw + Cursor CLI（技能桥接）**：[OPENCLAW_AGENT_CURSOR_CLI.md](OPENCLAW_AGENT_CURSOR_CLI.md)（Skills、ClawHub、cursor-agent、推荐步骤）

---

## 八、指定“项目”或默认工作目录（让 agent 用某个目录当主战场）

### 8.1 文档要点

- **Workspace = 唯一默认工作目录**  
  [Agent workspace](https://docs.openclaw.ai/concepts/agent-workspace)：*“The workspace is the agent's home. It is the **only** working directory used for **file tools** and for **workspace context**.”*  
  即：文件工具、工作区上下文都以 **workspace** 为基准；没有单独的“项目路径”，**workspace 就是默认“项目”目录**。

- **agents.defaults.repoRoot**  
  [Configuration Reference](https://docs.openclaw.ai/gateway/configuration-reference)：*“Optional repository root **shown in the system prompt's Runtime line**. If unset, OpenClaw auto-detects by walking upward from the workspace.”*  
  即：`repoRoot` 只影响系统提示里的 Runtime 显示，**不改变**文件工具的工作目录；真正决定“默认工作目录”的是 **workspace**。

### 8.2 做法一：把 workspace 设成你的代码库（推荐：agent 默认就操作这个项目）

让 agent 的“家”直接就是项目目录，例如 `D:\programing\core_node`：

1. 在 `C:\Users\mpc\.openclaw\openclaw.json` 里设置：
   ```json
   "agents": {
     "defaults": {
       "workspace": "D:\\programing\\core_node"
     }
   }
   ```
2. 保证该目录下有 OpenClaw 需要的引导文件（agent 每次会话会读）：  
   `AGENTS.md`、`SOUL.md`、`USER.md` 等放在 `D:\programing\core_node` 根目录（你已有 `docs/reference/templates/`，可把模板复制到根，或在该目录下建好这些文件）。
3. 可选：同时设 `repoRoot`，方便在 Runtime 里看到“当前仓库”提示：
   ```json
   "agents": {
     "defaults": {
       "workspace": "D:\\programing\\core_node",
       "repoRoot": "D:\\programing\\core_node"
     }
   }
   ```

这样 agent 的文件操作、相对路径都以 **core_node** 为根，自然就“有一个明确的项目”。

### 8.3 做法二：workspace 保持为 ~/.openclaw/workspace，在 AGENTS.md/TOOLS.md 里写明“项目”路径

- 不改配置，继续用 `C:\Users\mpc\.openclaw\workspace` 作为 workspace。
- 在 workspace 里的 **AGENTS.md** 或 **TOOLS.md** 里写清楚，例如：
  - *“默认代码项目目录：`D:\programing\core_node`。涉及代码、仓库时以该路径为根；文件操作若未指定路径，先确认是否指此项目。”*
- 这样 agent 仍以 `~/.openclaw/workspace` 为文件工具 cwd，但知道“项目”在 core_node，可用绝对路径或你约定的相对方式操作 core_node。适合“记忆/私人笔记在 workspace，代码在别处”的用法。

### 8.4 小结

| 目标 | 配置/做法 |
|------|-----------|
| 让 agent 默认工作目录 = 某个项目 | 把 **agents.defaults.workspace** 设为该项目路径（如 `D:\\programing\\core_node`），并在该目录下放好 AGENTS.md、SOUL.md、USER.md 等。 |
| 只在系统提示里显示“当前仓库” | 设置 **agents.defaults.repoRoot** 为仓库根路径（不改变文件工具 cwd）。 |
| 不改 workspace，只告诉 agent 项目在哪 | 在 workspace 的 AGENTS.md/TOOLS.md 里写明项目路径，让 agent 用绝对路径操作该目录。 |

文档：[Agent workspace](https://docs.openclaw.ai/concepts/agent-workspace)、[Configuration Reference - Agent defaults](https://docs.openclaw.ai/gateway/configuration-reference)（`agents.defaults.workspace`、`agents.defaults.repoRoot`）
