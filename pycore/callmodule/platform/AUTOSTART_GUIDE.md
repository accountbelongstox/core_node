# Auto-Start Guide
# PyCore RPC Server - 开机自启动功能说明

## 📋 功能概述

托盘菜单 / 管理 API 集成**开机自启动**功能，一键启用/禁用 PyCore 随系统登录启动。

**更新日期**：2026-06-11
**状态**：✅ 已测试通过（Windows 实测：UI :15654 HTTP 200 + worker :59000）

> **关键设计（2026-06 修复）**：开机启动运行的是与手动启动**完全相同的入口**
> `pyservice.ps1 -NoInstall`（Linux：`pyservice.sh run --no-install`）——
> 即先启动统一仪表盘 UI dev server（`poly_apps/pycore_laravel_wordflow_ui`，Vite 实时调试，
> 默认 `:15654`，导出 `PYCORE_UI_URL=http://localhost:15654/pycore-manager`），
> 再启动 pycore worker。旧版启动脚本直接拉起裸 worker
> （`pythonw pycore_module_caller.py`），UI dev server 永远不会启动，
> PySide6 webview 因此出现 **ERR_CONNECTION_REFUSED**。

---

## 🎯 两层结构（Windows / Linux 同构）

| 层 | Windows | Linux |
|----|---------|-------|
| **固定启动脚本**（内容可再生） | `~/.core_node/data/autostart/PyCore_RPC_Server.ps1` | `~/.core_node/data/autostart/PyCore_RPC_Server.sh` |
| **系统启动入口**（指向固定脚本） | `.lnk` 快捷方式：优先 All-Users Startup（`%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs\Startup`），无权限则退回当前用户 Startup | `.desktop`：优先 `/etc/xdg/autostart`（需 root），退回 `~/.config/autostart` |

- 启动入口永远只指向**固定路径**的脚本；配置变化只需重写脚本内容，无需重建入口。
- 脚本内容在 **每次 `enable()`** 和 **每次服务启动**（`refresh_startup_launcher()`，
  在 `pycore_module_caller.py` main 中调用）时自动再生 —— 旧版本写出的
  “裸 worker” 脚本会在下一次手动运行服务时被自动升级（自愈），无需手动重新开关。
- `pyservice.ps1` / `pyservice.sh` 不存在时（如安装版布局）才回退为裸 worker 启动，
  此时 webview 使用旧版 `/web/subtitle` 页面。

### 生成的脚本内容（Windows，pyservice 模式）

```powershell
# PyCore RPC Server - auto-start launcher
# AUTO-GENERATED: regenerated on every enable() and on every service start
# (reflects current config).
$ErrorActionPreference = 'SilentlyContinue'
Set-Location -LiteralPath 'D:\programing\core_node'
& 'D:\programing\core_node\pyservice.ps1' -NoInstall
```

- `-NoInstall`：跳过沉重的先决安装步骤（开机要快；机器在启用自启动时已经装好）。
- 内联调用（`&` 而非 `Start-Process`）：隐藏的 PowerShell 保持为服务宿主，
  `pyservice.ps1` 的 `finally` 能随 worker 退出一并清理 UI dev server。

### 生成的脚本内容（Linux，pyservice 模式）

```bash
#!/usr/bin/env bash
cd "/path/to/core_node" 2>/dev/null
exec /usr/bin/env bash "/path/to/core_node/pyservice.sh" run --no-install
```

---

## 🖱️ 使用方法

### 方法 1：托盘菜单（推荐）

右键托盘图标 → 点击 "Auto-Start on Boot"（启用后显示 ✓）。

### 方法 2：管理 API / Python

```python
from pycore.callmodule.platform.startup_manager import (
    get_startup_manager, refresh_startup_launcher,
)

manager = get_startup_manager()        # 自动选择 Windows/Linux 实现
manager.is_enabled()                    # 是否已启用（入口文件是否存在）
manager.enable()                        # 再生脚本 + 创建启动入口
manager.disable()                       # 删除启动入口（固定脚本保留，无害）
manager.toggle()
manager.get_status()                    # 含 entry_point / entry_exists 等
refresh_startup_launcher()              # 自愈：已启用时就地重写固定脚本
```

`get_status()` 关键字段：

```python
{
    "enabled": bool,
    "scope": "all-users" | "current-user",
    "location": "...lnk / ...desktop",
    "script_path": "~/.core_node/data/autostart/PyCore_RPC_Server.ps1|.sh",
    "entry_point": ".../pyservice.ps1|.sh",   # 实际启动的入口
    "entry_exists": bool,
    "launcher_script": ".../pycore/pycore_module_caller.py",  # 回退目标
}
```

---

## 🧪 验证方法

1. 启用自启动（托盘或 API），确认入口文件存在（`get_status()["location"]`）。
2. 不重启即可模拟开机：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden `
     -File "$env:USERPROFILE\.core_node\data\autostart\PyCore_RPC_Server.ps1"
   ```

3. 等待约 1 分钟后检查：
   - `http://localhost:15654/pycore-manager` 返回 HTTP 200（UI dev server）；
   - `:59000` 在监听（worker / rpc_v2）；
   - 托盘图标出现，webview 加载 pycore-manager 界面而非连接错误页。

---

## 🔄 并发启动 / 接管一致性（2026-06-11）

开机自启实例与手动启动实例可能**并发**（自启实例加载第三方包慢，~30-60s）。
一致性规则（缺一会互踢/互拆 UI）：

1. **最新实例获胜**（`pylauncher/singleton_detector.py`）：单例 ALIVE 响应携带
   `started_at`（进程创建时间，psutil）。`shutdown_existing=True` 的检测方发现
   运行中的 PRIMARY **比自己新**时**主动让位**（`yielded_to_newer`），而不是踢掉它
   —— 否则"谁最后完成启动谁赢"会让迟到的开机实例反杀用户刚启动的新实例。
   旧版实例不带 `started_at`，视为更旧（照踢，向后兼容）。
2. **让位退出码 3**：worker 让位时以 `os._exit(3)` 退出；`pyservice.ps1`/`.sh`
   见到退出码 3 **跳过 UI server teardown**（幸存实例正在用它）。
3. **UI dev server 复用**：pyservice 启动 UI 前先探测
   `http://localhost:15654/pycore-manager` 是否 200 且含 `Nexus Dash` 标记
   （证明是 dashboard shell 而非残留的 legacy desktop-manager）——
   健康则直接复用（不杀、不重启、finally 不拆）；不健康才清端口重启。

## 🐛 故障排查

| 症状 | 排查 |
|------|------|
| webview ERR_CONNECTION_REFUSED | 固定脚本是否还是旧版“裸 worker”内容？手动跑一次服务（或 `refresh_startup_launcher()`）自愈后重启验证 |
| 新启动的实例反而退出 | 旧版代码的"后完成检测者踢人"问题；确认 singleton_detector 是否带 `started_at`/`yielded_to_newer`（见上节） |
| UI 未启动、worker 正常 | 登录会话 PATH 中是否有 `pnpm`（`Get-Command pnpm.cmd`）？`poly_apps/pycore_laravel_wordflow_ui/package.json` 是否存在？均无则 pyservice 自动回退旧版 `/web/subtitle` |
| 完全没启动 | 入口（.lnk/.desktop）是否存在；手动运行固定脚本看输出 |

---

**文档版本**：2.0（pyservice 全栈启动 + 自愈）
**最后更新**：2026-06-11
