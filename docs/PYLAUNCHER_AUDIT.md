# PyLauncher Architecture Audit

## Date: 2025-12-18

## Current Violations

### ❌ Violation 1: Sub-apps directly import NativeUIConfig + launch_native_app

**Should use**: `from pycore.pylauncher import launch_with_native_ui`
**Currently using**: `from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app`

#### Files violating architecture:

1. **pycore/callmodule/callmodule_main.py:33**
```python
❌ from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app, get_platform_adapter
```

2. **pyapps/matrix/matrix_main.py:24**
```python
❌ from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
```

3. **pyapps/okx_price_monitor/okx_price_monitor_main.py:21**
```python
❌ from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
```

---

## PyLauncher Export Analysis

### Current Exports (After Simplification):
```python
__all__ = [
    'launch_with_native_ui',  # Unified Native UI launcher
    'ServiceLauncher',        # Legacy backend services
    'LauncherConfig',         # Legacy configuration
]
```

### ServiceLauncher/LauncherConfig Usage:

#### Active Usage (Still needed):
1. **pycore_module_caller.py:33** - Legacy mode
   ```python
   from pycore.pylauncher import ServiceLauncher
   ```

2. **pycore/pyctl/mcpctl/mcp_backend_main.py:26** - Backend service launcher
   ```python
   from pycore.pylauncher import LauncherConfig, ServiceLauncher
   ```

3. **pycore/callmodule/config.py:13** - Callmodule configuration
   ```python
   from pycore.pylauncher import LauncherConfig
   ```

4. **pycore/callmodule/event_handlers.py:12** - Event handlers
   ```python
   from pycore.pylauncher import ServiceLauncher
   ```

#### Non-active Usage (Can ignore):
- `pycore/bak/platform/launcher.py` - Backup file
- `examples/platform_adapter_example.py` - Example file

---

## User Requirement

> pylauncher 不需要导出一大堆方法，明白？pylauncher 只需要导出一个统一方法，根据参数来启动。

### Interpretation:

**Option 1: Only export launch_with_native_ui (Strict)**
```python
__all__ = [
    'launch_with_native_ui',  # ONLY ONE method
]
```
- ✅ Meets user requirement literally
- ❌ Breaks: pycore_module_caller.py, mcpctl, callmodule/config.py

**Option 2: Keep ServiceLauncher/LauncherConfig as Internal (Pragmatic)**
```python
__all__ = [
    'launch_with_native_ui',  # Main public API
]

# Not exported, but can be imported if needed:
# from pycore.pylauncher.launcher import ServiceLauncher, LauncherConfig
```
- ✅ Main API is unified
- ✅ Doesn't break existing code
- ⚠️ Still allows internal imports

**Option 3: Two Unified Methods (Balanced)**
```python
__all__ = [
    'launch',  # Universal launcher (detects params, calls native_ui or service launcher)
]

def launch(**kwargs):
    """
    Universal launcher - automatically detects mode

    If frontend_enabled or UI params → launch_with_native_ui
    If only backend services → ServiceLauncher
    """
```
- ✅ Truly ONE method
- ✅ Backwards compatible
- ⚠️ More complex implementation

---

## Recommended Solution

### Phase 1: Simplify Exports (DONE)
```python
__all__ = [
    'launch_with_native_ui',  # Recommended for new code
    'ServiceLauncher',        # Internal use only (deprecated for public)
    'LauncherConfig',         # Internal use only (deprecated for public)
]
```

### Phase 2: Update Sub-apps to Use launch_with_native_ui

**Fix 3 violated files:**
1. ✅ callmodule_main.py → use launch_with_native_ui
2. ✅ matrix_main.py → use launch_with_native_ui
3. ✅ okx_price_monitor_main.py → use launch_with_native_ui

### Phase 3: Move ServiceLauncher/LauncherConfig to Internal

**Update internal files to import from submodule:**
```python
# Instead of:
from pycore.pylauncher import ServiceLauncher, LauncherConfig

# Use:
from pycore.pylauncher.launcher import ServiceLauncher, LauncherConfig
```

**Update these files:**
1. pycore_module_caller.py (legacy mode)
2. pycore/pyctl/mcpctl/mcp_backend_main.py (backend services)
3. pycore/callmodule/config.py (internal)
4. pycore/callmodule/event_handlers.py (internal)

**Then remove from __all__:**
```python
__all__ = [
    'launch_with_native_ui',  # ONLY ONE public method
]
```

---

## Summary

### Current State:
- ❌ 3 sub-apps bypass pylauncher (directly use native_ui)
- ⚠️ pylauncher exports 3 methods (should be 1)
- ⚠️ ServiceLauncher/LauncherConfig used in 4 active files

### Target State:
```
pylauncher (public)
  ├── launch_with_native_ui()  ← ONLY public API

pylauncher.launcher (internal)
  ├── ServiceLauncher          ← Internal use via submodule import
  └── LauncherConfig           ← Internal use via submodule import
```

### Migration Steps:
1. ✅ Create launch_with_native_ui() in pylauncher/native_launcher.py
2. ✅ Simplify pylauncher/__init__.py exports
3. ⏳ Update callmodule_main.py
4. ⏳ Update matrix_main.py
5. ⏳ Update okx_price_monitor_main.py
6. ⏳ Move ServiceLauncher/LauncherConfig to internal imports
7. ⏳ Remove ServiceLauncher/LauncherConfig from __all__

---

Date: 2025-12-18
Audited by: Claude Code
