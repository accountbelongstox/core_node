# Launcher Architecture Analysis

## Date: 2025-12-18

## Current Architecture Problem

### User Requirement
> 现在确保所有启动都是从 pycore/pylauncher 中组织，子app只负责组织参数传给 pycore/pylauncher

**Expected Architecture**:
```
Sub-app (callmodule, matrix, okx_price_monitor)
  ↓ (only pass config parameters)
pycore/pylauncher (unified launcher)
  ↓ (handle everything)
Launch logic (singleton, UI, RPC, etc.)
```

**Current Architecture (VIOLATED)**:
```
Sub-app (callmodule, matrix, okx_price_monitor)
  ↓ (directly import and call)
pycore/pyutils/native_ui/launch_native_app
  ↓ (bypass pylauncher)
Launch logic
```

---

## Architecture Violations

### Violation 1: callmodule_main.py 直接调用 launch_native_app

**File**: `/www/programing/core_node/pycore/callmodule/callmodule_main.py:33, 252`

**Current Code**:
```python
# Line 33
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app, get_platform_adapter

# Line 252
launch_native_app(config)
```

**Problem**:
- ❌ 直接导入 `launch_native_app` from `pycore.pyutils.native_ui`
- ❌ 跳过 `pycore/pylauncher` 层
- ❌ 子app承担了启动逻辑（创建 NativeUIConfig，调用 launch）

**Should be**:
```python
# Import from pylauncher
from pycore.pylauncher import launch_with_native_ui

# Pass config parameters to pylauncher
launch_with_native_ui(
    app_id=Config.APP_ID,
    app_name=Config.APP_DISPLAY_NAME,
    ...  # other parameters
)
```

---

### Violation 2: matrix_main.py 直接调用 launch_native_app

**File**: `/www/programing/core_node/pyapps/matrix/matrix_main.py:24, 356`

**Current Code**:
```python
# Line 24
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

# Line 356
launch_native_app(config)
```

**Problem**: Same as Violation 1

---

### Violation 3: okx_price_monitor_main.py 直接调用 launch_native_app

**File**: `/www/programing/core_node/pyapps/okx_price_monitor/okx_price_monitor_main.py:21, 185`

**Current Code**:
```python
# Line 21
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

# Line 185
launch_native_app(config)
```

**Problem**: Same as Violation 1

---

## Current pycore/pylauncher Structure

### Files in pycore/pylauncher:
```
pycore/pylauncher/
├── __init__.py
├── launcher.py         (ServiceLauncher - for backend services only)
└── singleton_detector.py
```

### launcher.py Capabilities:
- ✅ `ServiceLauncher` class - launches backend services (RPC v2, speech, heartbeat)
- ✅ Singleton detection with callbacks
- ❌ **NO Native UI support** - missing `launch_with_native_app()` function

### What's Missing:
```python
# pycore/pylauncher needs this:
def launch_with_native_ui(
    app_id: str,
    app_name: str,
    main_entry: Optional[Callable] = None,
    frontend_enabled: bool = False,
    frontend_app_dir: Optional[Path] = None,
    rpc_enabled: bool = False,
    rpc_port: int = 58100,
    rpc_routers: list = None,
    ...
) -> None:
    """
    Unified Native UI launcher for all apps

    Responsibility:
    - Singleton detection
    - Platform detection (desktop vs server mode)
    - Launch native_ui with config
    - Handle all startup logic
    """
    pass
```

---

## Two-Layer Architecture (Current)

### Layer 1: pycore/pylauncher (Service Layer)
**Purpose**: Backend service launcher (no UI)

**Components**:
- `ServiceLauncher` class
- `LauncherConfig` dataclass
- Singleton detection

**Usage** (Legacy mode):
```python
from pycore.pylauncher import ServiceLauncher, LauncherConfig

config = LauncherConfig(
    app_id="my_app",
    services={'rpc_v2': {'port': 58100}}
)
launcher = ServiceLauncher(config)
launcher.start()
```

### Layer 2: pycore/pyutils/native_ui (UI Layer)
**Purpose**: Native UI launcher (frontend + backend + PySide6)

**Components**:
- `NativeUIConfig` dataclass
- `launch_native_app()` function
- Platform adapter
- Frontend launcher
- PySide6 framework

**Usage** (Current - VIOLATED):
```python
# Sub-app directly imports and uses (WRONG!)
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

config = NativeUIConfig(
    app_id="my_app",
    frontend_enabled=True,
    ...
)
launch_native_app(config)
```

---

## Desired Architecture (3-Layer)

### Layer 1: Sub-app (callmodule, matrix, okx_price_monitor)
**Responsibility**: **ONLY** organize config parameters

```python
# callmodule_main.py
def start(host='0.0.0.0', port=59000, debug=False):
    """Callmodule entry - ONLY organize parameters"""
    from pycore.pylauncher import launch_with_native_ui
    from pycore.callmodule.routers import all_routers

    # Organize parameters
    launch_with_native_ui(
        app_id="pycore_callmodule",
        app_name="Pycore Callmodule",
        frontend_app_dir=Path(__file__).parent.parent / "poly_apps" / "pycore-management",
        rpc_port=port,
        rpc_routers=all_routers,
        ...
    )
```

### Layer 2: pycore/pylauncher (Unified Launcher)
**Responsibility**: **ALL** startup logic

```python
# pycore/pylauncher/launcher.py or native_launcher.py
def launch_with_native_ui(...):
    """
    Unified Native UI launcher

    Handles:
    - Singleton detection
    - Platform detection (desktop vs server)
    - NativeUIConfig creation
    - launch_native_app() call
    - Error handling
    """
    # 1. Singleton detection
    detector = SingletonDetector(...)

    # 2. Platform detection
    adapter = get_platform_adapter()

    # 3. Create NativeUIConfig
    config = NativeUIConfig(...)

    # 4. Launch
    launch_native_app(config)
```

### Layer 3: pycore/pyutils/native_ui (UI Implementation)
**Responsibility**: **ONLY** implement Native UI logic (no change needed)

---

## Comparison Table

| Aspect | Current (VIOLATED) | Desired (CORRECT) |
|--------|-------------------|-------------------|
| **Sub-app imports** | `from pycore.pyutils.native_ui import launch_native_app` | `from pycore.pylauncher import launch_with_native_ui` |
| **Sub-app responsibility** | Create NativeUIConfig + Call launch_native_app | Pass parameters only |
| **pylauncher role** | Only ServiceLauncher (backend) | Unified launcher (backend + UI) |
| **Singleton detection** | In native_ui layer (launch_native_app.py) | In pylauncher layer |
| **Platform detection** | In sub-app (callmodule_main.py) | In pylauncher layer |
| **Config creation** | In sub-app | In pylauncher layer |

---

## Files Requiring Changes

### Phase 1: Add Native UI Launcher to pylauncher

**File**: `/www/programing/core_node/pycore/pylauncher/native_launcher.py` (NEW)

**Add**:
```python
def launch_with_native_ui(
    app_id: str,
    app_name: str,
    main_entry: Optional[Callable] = None,
    project_root: Optional[Path] = None,

    # Frontend config
    frontend_enabled: bool = False,
    frontend_framework: Optional[str] = None,
    frontend_app_dir: Optional[Path] = None,
    frontend_mode: str = "production",
    frontend_port: int = 0,  # 0 = auto

    # RPC config
    rpc_enabled: bool = False,
    rpc_port: int = 58100,
    rpc_host: str = "0.0.0.0",
    rpc_routers: Optional[list] = None,

    # UI config
    show_on_start: bool = True,
    show_debug_window: bool = True,
    enable_tray: bool = False,
    icon_path: Optional[str] = None,

    # Singleton config
    singleton: bool = True,
    singleton_port_start: int = 54000,
    singleton_port_range: int = 100,

    # Debug
    debug: bool = False,
) -> None:
    """
    Unified Native UI launcher - called by all sub-apps

    This is the ONLY entry point for Native UI apps.
    Sub-apps should NOT directly import launch_native_app.
    """
    # Implementation...
```

**Export** in `/www/programing/core_node/pycore/pylauncher/__init__.py`:
```python
from .native_launcher import launch_with_native_ui

__all__ = [
    'ServiceLauncher',
    'LauncherConfig',
    'launch_services',
    'launch_with_native_ui',  # NEW
]
```

---

### Phase 2: Update Sub-apps to Use pylauncher

#### callmodule_main.py

**Change**:
```python
# Before (lines 33, 252):
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
launch_native_app(config)

# After:
from pycore.pylauncher import launch_with_native_ui
launch_with_native_ui(
    app_id=Config.APP_ID,
    app_name=Config.APP_DISPLAY_NAME,
    main_entry=callmodule_main_entry,
    project_root=PROJECT_ROOT,
    frontend_enabled=True,
    frontend_framework="vite",
    frontend_app_dir=frontend_app_dir,
    frontend_mode=Config.FRONTEND_MODE,
    rpc_enabled=True,
    rpc_port=port,
    rpc_routers=all_routers,
    show_on_start=IS_DESKTOP_MODE,
    enable_tray=adapter.can_use_tray(),
    icon_path=str(icon_path),
    singleton=True,
    singleton_port_start=54000,
    debug=debug,
)
```

#### matrix_main.py

**Change**:
```python
# Before (lines 24, 356):
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
launch_native_app(config)

# After:
from pycore.pylauncher import launch_with_native_ui
launch_with_native_ui(
    app_id=Config.APP_ID,
    app_name=Config.APP_DISPLAY_NAME,
    main_entry=matrix_main_entry,
    ...
)
```

#### okx_price_monitor_main.py

**Change**: Same pattern as above

---

### Phase 3: Update pycore_module_caller.py

**Change**:
```python
# Before (line 48):
def main_native_ui(host='0.0.0.0', port=59000, debug=False):
    start(host=host, port=port, debug=debug)  # calls callmodule_main.start()

# After:
def main_native_ui(host='0.0.0.0', port=59000, debug=False):
    # Direct call to pylauncher (no need to go through callmodule_main.start())
    from pycore.pylauncher import launch_with_native_ui
    launch_with_native_ui(
        app_id="pycore_callmodule",
        ...
    )
```

---

## Benefits of Unified Architecture

### Before (Violated)
- ❌ Sub-apps have too much responsibility
- ❌ Duplicate singleton detection logic
- ❌ Duplicate platform detection logic
- ❌ Inconsistent config creation
- ❌ Hard to maintain (changes needed in 3+ files)

### After (Correct)
- ✅ Sub-apps only organize parameters (single responsibility)
- ✅ Unified singleton detection in pylauncher
- ✅ Unified platform detection in pylauncher
- ✅ Consistent config creation in pylauncher
- ✅ Easy to maintain (changes in 1 file - pylauncher)
- ✅ Clear separation of concerns

---

## Migration Path

### Step 1: Create native_launcher.py
- Add `launch_with_native_ui()` function
- Move singleton detection logic from launch_native_app.py
- Move platform detection logic from sub-apps

### Step 2: Update callmodule_main.py
- Change imports
- Simplify start() to only pass parameters
- Remove NativeUIConfig creation

### Step 3: Update matrix_main.py
- Same as Step 2

### Step 4: Update okx_price_monitor_main.py
- Same as Step 2

### Step 5: Update pycore_module_caller.py (optional)
- Can directly call pylauncher instead of callmodule_main.start()

### Step 6: Deprecate direct launch_native_app usage
- Add deprecation warning in launch_native_app()
- Document that all apps should use pylauncher

---

## Summary

### Current Problems:
1. ❌ Sub-apps directly import `launch_native_app` from `pycore.pyutils.native_ui`
2. ❌ Sub-apps handle too much logic (config creation, platform detection)
3. ❌ Bypass `pycore/pylauncher` layer
4. ❌ Inconsistent architecture (violates user requirement)

### Required Fixes:
1. ✅ Create `launch_with_native_ui()` in `pycore/pylauncher`
2. ✅ Update 3 sub-apps (callmodule, matrix, okx_price_monitor)
3. ✅ Simplify sub-apps to only pass parameters
4. ✅ Move all startup logic to pylauncher layer

### Architecture Goal:
```
Sub-app → pycore/pylauncher → pycore/pyutils/native_ui
(params)   (startup logic)     (UI implementation)
```

---

Date: 2025-12-18
Analyzed by: Claude Code
Status: Ready for implementation
