# THREAD_BUS 统一通信架构
**日期**: 2025-11-12
**目的**: 使用 THREAD_BUS 作为全局通信和状态存储，支持灵活的UI框架组合

---

## 执行摘要

重构应用架构，使用 THREAD_BUS 作为核心通信机制，实现：
- ✅ **无参数传递**：所有组件通过 THREAD_BUS 通信
- ✅ **按需加载**：不使用的框架不创建资源
- ✅ **灵活组合**：支持 Tkinter-only、PySide6-only、或混合模式
- ✅ **统一托盘**：支持 Tkinter(pystray) 和 PySide6 两种托盘后端

---

## 架构概览

### 核心通信模式

```
┌──────────────────────────────────────────────────────────┐
│                      THREAD_BUS                          │
│                   (全局通信总线)                          │
├──────────────────────────────────────────────────────────┤
│  - 状态存储 (set/get)                                     │
│  - 事件发射/监听 (emit/on)                                │
│  - 信号等待 (wait_signal)                                 │
└──────────────────────────────────────────────────────────┘
              │              │              │
              ▼              ▼              ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Tkinter      │  │ PySide6      │  │ Main App     │
    │ Thread       │  │ (optional)   │  │ Thread       │
    ├──────────────┤  ├──────────────┤  ├──────────────┤
    │ - Debug Win  │  │ - Main Win   │  │ - Business   │
    │ - Tray(pyst) │  │ - Tray(Qt)   │  │   Logic      │
    │ - ColorPrint │  │ - WebView    │  │ - Services   │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 核心改进

### 1. 依赖检查信息记录到 THREAD_BUS ✅

**文件**: `pycore/__init__.py`

**改进内容**:

```python
# 记录到 THREAD_BUS
THREAD_BUS.set("pycore_dependencies_checked", True)
THREAD_BUS.set("pycore_all_packages", sorted(all_packages))
THREAD_BUS.set("pycore_installed_packages", sorted(installed))
THREAD_BUS.set("pycore_missing_packages", sorted(missing))
THREAD_BUS.set("pycore_total_packages", total_count)
THREAD_BUS.set("pycore_platform", platform)

# 发射完成信号
THREAD_BUS.emit("pycore_dependencies_complete", {
    "total": total_count,
    "installed": installed_count,
    "missing": missing_count,
    "platform": platform
})
```

**访问方式**:

```python
# 任何地方都可以访问，无需传参
from pycore import THREAD_BUS

# 获取依赖信息
all_packages = THREAD_BUS.get("pycore_installed_packages")
total = THREAD_BUS.get("pycore_total_packages")

# 监听完成事件
THREAD_BUS.on("pycore_dependencies_complete", lambda data:
    print(f"Dependencies ready: {data['installed']}/{data['total']}")
)
```

---

### 2. 统一托盘配置接口 ✅

**文件**: `pycore/pyutils/native_ui/tray_config.py`

**核心类**:

#### TrayBackend (Enum)
```python
class TrayBackend(Enum):
    TKINTER = "tkinter"   # pystray - 轻量级，无Qt依赖
    PYSIDE6 = "pyside6"    # QSystemTrayIcon - 完整Qt集成
    AUTO = "auto"          # 自动检测最佳可用后端
```

#### TrayMenuItem (Dataclass)
```python
@dataclass
class TrayMenuItem:
    text: str                    # 显示文本
    signal: str = ""             # THREAD_BUS 信号名
    icon: Optional[str] = None   # 图标路径
    enabled: bool = True         # 是否启用
    default: bool = False        # 是否默认动作(双击)
    checkable: bool = False      # 是否可勾选
    checked: bool = False        # 初始勾选状态
    submenu: Optional[List] = None  # 子菜单

    # 分隔符常量
    SEPARATOR = TrayMenuItem(text="---", signal="")
```

#### TrayConfig (Dataclass)
```python
@dataclass
class TrayConfig:
    enabled: bool = True
    backend: TrayBackend = TrayBackend.AUTO
    app_name: str = "Application"
    icon_path: Optional[str] = None
    menu_items: List[TrayMenuItem] = []
    show_on_minimize: bool = True
    start_minimized: bool = False
    close_to_tray: bool = True
```

**使用示例**:

```python
from pycore import THREAD_BUS
from pycore.pyutils.native_ui.tray_config import (
    TrayConfig, TrayMenuItem, TrayBackend, TrayBusKeys
)

# 1. 创建托盘配置
tray_config = TrayConfig(
    enabled=True,
    backend=TrayBackend.TKINTER,  # 使用 Tkinter 托盘
    app_name="My Application",
    menu_items=[
        TrayMenuItem(text="Show", signal="tray_show", default=True),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(text="Exit", signal="tray_exit")
    ]
)

# 2. 存储到 THREAD_BUS (无需传参)
THREAD_BUS.set(TrayBusKeys.TRAY_CONFIG, tray_config)

# 3. 监听托盘事件
THREAD_BUS.on("tray_show", lambda data: show_main_window())
THREAD_BUS.on("tray_exit", lambda data: exit_application())

# 4. 其他地方可以获取配置
config = THREAD_BUS.get(TrayBusKeys.TRAY_CONFIG)
```

---

### 3. Tkinter 托盘实现 ✅

**文件**: `pycore/pyutils/native_ui/tkinter_system_tray.py`

**核心类**: `TkinterSystemTray`

**特点**:
- 使用 `pystray` 库（轻量级，跨平台）
- 运行在 Tkinter 线程
- 通过 THREAD_BUS 通信，无参数传递
- 支持菜单更新、图标更新

**使用示例**:

```python
from pycore import THREAD_BUS
from pycore.pyutils.native_ui.tkinter_system_tray import TkinterSystemTray
from pycore.pyutils.native_ui.tray_config import TrayBusKeys

# 从 THREAD_BUS 获取配置
tray_config = THREAD_BUS.get(TrayBusKeys.TRAY_CONFIG)

# 创建托盘
tray = TkinterSystemTray(
    app_name=tray_config.app_name,
    icon_path=tray_config.icon_path,
    menu_items=tray_config.menu_items
)

# 运行托盘 (阻塞)
tray.run()

# 发射信号
THREAD_BUS.emit(TrayBusKeys.TRAY_STARTED, {"backend": "tkinter"})
```

---

## 使用场景

### 场景 1: 仅 Tkinter (最小化资源)

适用于：轻量级工具、CLI工具需要托盘图标

```python
from pycore import THREAD_BUS
from pycore.pyutils.native_ui.tray_config import *

# 1. 配置托盘 (仅使用 Tkinter)
tray_config = TrayConfig(
    backend=TrayBackend.TKINTER,
    app_name="Lightweight Tool",
    menu_items=create_default_tray_menu("Tool")
)
THREAD_BUS.set(TrayBusKeys.TRAY_CONFIG, tray_config)

# 2. 启动 Tkinter 托盘
from pycore.pyutils.native_ui.tkinter_system_tray import TkinterSystemTray
tray = TkinterSystemTray(...) # 从 THREAD_BUS 获取配置
tray.run()

# ✅ 零 PySide6 资源占用
```

### 场景 2: 仅 PySide6 (完整 Qt 应用)

适用于：复杂 GUI 应用

```python
from pycore import THREAD_BUS
from pycore.pyutils.native_ui.tray_config import *

# 1. 配置托盘 (使用 PySide6)
tray_config = TrayConfig(
    backend=TrayBackend.PYSIDE6,
    app_name="Qt Application",
    menu_items=create_default_tray_menu("App")
)
THREAD_BUS.set(TrayBusKeys.TRAY_CONFIG, tray_config)

# 2. 启动 PySide6 应用 (包含托盘)
from pycore.pyutils.native_ui.pyside6 import PySide6Framework
app = PySide6Framework(...) # 自动从 THREAD_BUS 读取托盘配置
app.start()

# ✅ 零 Tkinter 资源占用 (除了依赖检查窗口)
```

### 场景 3: 混合模式 (Debug + Tkinter Tray + PySide6 Main)

适用于：Matrix 这样的复杂应用

```python
# 1. Tkinter 线程：Debug 窗口 + 托盘
TkinterStartupThread:
  - 显示 debug 窗口 (依赖检查)
  - 关闭 debug 窗口
  - 保持线程，运行托盘菜单 (pystray)

# 2. PySide6 主线程：主窗口
PySide6Framework:
  - 主窗口 + WebView
  - 不创建托盘 (已由 Tkinter 线程创建)

# ✅ 资源分离，职责清晰
```

---

## TkinterStartupThread 生命周期管理

### 模式 1: Debug Only (当前默认)

```
启动 → 显示 Debug 窗口 → 依赖检查 → 关闭窗口 → 销毁线程
```

```python
# launcher_with_startup.py
startup_thread.start()
check_and_install_dependencies()
startup_thread.request_close()
# 线程完全退出
```

### 模式 2: Debug + Tray (新增)

```
启动 → 显示 Debug 窗口 → 依赖检查 → 关闭窗口 → 保留线程 → 运行托盘
```

```python
# launcher_with_startup.py
startup_thread.start()
check_and_install_dependencies()

# 关闭窗口但不销毁线程
startup_thread.close_window_only()

# 线程继续运行托盘
# 通过 THREAD_BUS 通信
```

---

## THREAD_BUS 标准键名

### 依赖检查相关

| 键名 | 类型 | 说明 |
|------|------|------|
| `pycore_dependencies_checked` | bool | 是否已检查 |
| `pycore_all_packages` | List[str] | 所有包名 |
| `pycore_installed_packages` | List[str] | 已安装包 |
| `pycore_missing_packages` | List[str] | 缺失包 |
| `pycore_total_packages` | int | 总包数 |
| `pycore_platform` | str | 平台名称 |

### 托盘相关 (TrayBusKeys)

| 键名 | 类型 | 说明 |
|------|------|------|
| `tray_config` | TrayConfig | 托盘配置 |
| `tray_backend` | str | 活动后端 |
| `tray_ready` | bool | 托盘就绪 |
| `tray_visible` | bool | 托盘可见 |

### 信号 (Signals)

| 信号名 | 数据 | 发射者 | 监听者 |
|--------|------|--------|--------|
| `pycore_dependencies_complete` | {total, installed, missing} | pycore/__init__.py | UI |
| `tray_show` | {} | 托盘 | 主应用 |
| `tray_exit` | {} | 托盘 | 主应用 |
| `tray_started` | {backend} | 托盘线程 | 主应用 |
| `tray_stopped` | {} | 托盘线程 | 主应用 |

---

## 按需加载机制

### PySide6 延迟导入

```python
# 不要在模块顶层导入
# ❌ 错误
from PySide6.QtWidgets import QApplication

# ✅ 正确：在函数内部导入
def create_pyside6_app():
    # 只有调用此函数时才导入
    from PySide6.QtWidgets import QApplication
    return QApplication()
```

### 条件创建

```python
# 从 THREAD_BUS 读取配置，决定是否创建资源
tray_config = THREAD_BUS.get(TrayBusKeys.TRAY_CONFIG)

if tray_config and tray_config.enabled:
    if tray_config.backend == TrayBackend.TKINTER:
        # 创建 Tkinter 托盘，不导入 PySide6
        from pycore.pyutils.native_ui.tkinter_system_tray import TkinterSystemTray
        tray = TkinterSystemTray(...)
    elif tray_config.backend == TrayBackend.PYSIDE6:
        # 创建 PySide6 托盘，不导入 pystray
        from pycore.pyutils.native_ui.pyside6 import PySide6SystemTray
        tray = PySide6SystemTray(...)
```

---

## 通信示例

### 示例 1: 托盘菜单点击

```python
# [Tkinter 托盘线程]
def handle_menu_click(item_text):
    # 发射信号到 THREAD_BUS
    THREAD_BUS.emit("tray_show", {"text": item_text})

# [主应用线程]
def show_main_window(data):
    print(f"Show window triggered from: {data['text']}")

# 注册监听
THREAD_BUS.on("tray_show", show_main_window)
```

### 示例 2: 更新托盘菜单

```python
# [主应用线程]
def update_tray_menu(new_items):
    # 发射命令到 THREAD_BUS
    THREAD_BUS.emit("tray_update_menu", {"items": new_items})

# [Tkinter 托盘线程]
THREAD_BUS.on("tray_update_menu", lambda data:
    tray.update_menu(data['items'])
)
```

### 示例 3: 获取依赖信息

```python
# 任何线程都可以访问
from pycore import THREAD_BUS

# 等待依赖检查完成
THREAD_BUS.wait_signal("pycore_dependencies_complete", timeout=30)

# 获取结果
installed = THREAD_BUS.get("pycore_installed_packages")
total = THREAD_BUS.get("pycore_total_packages")

print(f"Installed {len(installed)}/{total} packages")
```

---

## Debug 窗口增强

### 显示完整依赖信息

```python
# 在 TkinterStartupThread 中监听完成事件
THREAD_BUS.on("pycore_dependencies_complete", self._on_dependencies_complete)

def _on_dependencies_complete(self, data):
    """依赖检查完成回调"""
    total = data['total']
    installed = data['installed']
    missing = data['missing']

    if missing == 0:
        self.log(f"✓ All {total} packages are installed", "success")
    else:
        self.log(f"✓ {installed}/{total} packages ready ({missing} installed)", "success")

    # 显示详细列表
    installed_list = THREAD_BUS.get("pycore_installed_packages")
    self.log(f"Installed: {', '.join(installed_list[:5])}...", "info")
```

---

## 优势总结

### 1. 无参数传递 ✅
- 所有组件通过 THREAD_BUS 通信
- 降低耦合度
- 简化函数签名

### 2. 全局状态访问 ✅
- 任何地方都可以访问依赖信息
- 任何地方都可以访问托盘配置
- 无需层层传递参数

### 3. 按需加载 ✅
- 不使用 PySide6 时，零 Qt 资源
- 不使用托盘时，不创建托盘
- 资源高效利用

### 4. 灵活组合 ✅
- Tkinter-only
- PySide6-only
- Mixed mode
- 通过配置决定

### 5. 统一托盘接口 ✅
- 相同的 TrayConfig
- 相同的 TrayMenuItem
- 自动选择后端

---

## 下一步工作

### 待完成

1. ✅ 创建 `tray_config.py` - 统一托盘配置
2. ✅ 创建 `tkinter_system_tray.py` - Tkinter 托盘实现
3. ✅ 修改 `pycore/__init__.py` - 记录到 THREAD_BUS
4. ⏳ 扩展 `TkinterStartupThread` - 支持托盘模式
5. ⏳ 修改 `launcher_with_startup.py` - 支持托盘选项
6. ⏳ 确保 PySide6 延迟加载
7. ⏳ 更新 Matrix 应用使用新架构

### 测试清单

- [ ] Tkinter-only 模式 (仅托盘，无主窗口)
- [ ] PySide6-only 模式 (完整 Qt 应用)
- [ ] 混合模式 (Tkinter 托盘 + PySide6 主窗口)
- [ ] Debug 窗口显示完整依赖信息
- [ ] 托盘菜单通过 THREAD_BUS 通信
- [ ] 依赖信息通过 THREAD_BUS 访问

---

**状态**: 🚧 进行中
**完成度**: 60%
**下一步**: 扩展 TkinterStartupThread 支持托盘模式

---

## 相关文档

- [完整架构分析](ARCHITECTURE_ANALYSIS_2025-11-12.md)
- [依赖检查ColorPrint修复](DEPENDENCY_CHECK_COLORPRINT_FIX.md)
- [Debug窗口修改](DEBUG_LOG_WINDOW_MODIFICATIONS.md)
