# Pycore Unified Utils Migration Guide

## Overview

The pycore library has been refactored to consolidate all device and ADB utilities into a unified structure. **The old modules have been removed** - you must update your imports.

## Architecture Changes

### Before (Removed)
```
pycore/
├── pydevice/          # ❌ REMOVED
├── pyadb/             # ❌ REMOVED
├── pyfoundations/
│   └── device/        # ❌ REMOVED
└── pyutils/
    ├── adb/           # ❌ REMOVED
    └── device/        # Was just re-exports
```

### After (Current - Unified)
```
pycore/
└── pyutils/
    ├── device/        # ✅ UNIFIED - All device & ADB functionality
    │   ├── device_info.py
    │   ├── server_params.py
    │   ├── android_device.py
    │   ├── scrcpy_device.py
    │   ├── adb_manager.py
    │   ├── adb_device.py
    │   └── adb_*.py
    ├── video_stream/  # Video streaming
    ├── control/       # Device control
    ├── mcp/           # MCP network discovery
    └── native_ui/     # Native UI frameworks
```

## Migration Paths

### Unified Import (Recommended)

**All device and ADB functionality is now in ONE place:**

```python
from pycore.pyutils.device import (
    # Device abstractions
    DeviceInfo, ServerParams, Resolution, VideoCodec,
    AndroidDevice, ScrcpyDevice,
    # ADB utilities
    ADBManager, ADBDevice,
    # Exceptions
    ADBException, DeviceNotFoundException
)
```

### Old Imports (All Removed)

❌ **All of these will fail with ModuleNotFoundError:**
```python
# DO NOT USE - All removed:
from pycore.pydevice import DeviceInfo              # ❌ REMOVED
from pycore.pyadb import ADBManager                 # ❌ REMOVED
from pycore.pyfoundations.device import DeviceInfo  # ❌ REMOVED
from pycore.pyutils.adb import ADBManager           # ❌ REMOVED
```

### New Import (Unified)

✅ **Use this single import path:**
```python
# ✅ CORRECT - Everything in one place:
from pycore.pyutils.device import (
    DeviceInfo, ADBManager, AndroidDevice, ScrcpyDevice
)
```

### Enhanced ADB Types (Optional)

**All enhanced types are also in pyutils.device:**
```python
from pycore.pyutils.device import (
    # Enhanced ADB types
    ADBDeviceState,
    ADBConnectionType,
    ADBExecuteResult,
    ADBDeviceProperties,
    ADBDeviceBattery,
    ADBForwardSpec,
    ADBCommands
)
```

## Module Status

### Active Module (Unified)

| Module | Status | Purpose |
|--------|--------|---------|
| `pycore.pyutils.device` | ✅ UNIFIED | All device & ADB functionality |
| `pycore.pyutils.video_stream` | ✅ ACTIVE | Video streaming |
| `pycore.pyutils.control` | ✅ ACTIVE | Device control |
| `pycore.pyutils.mcp` | ✅ ACTIVE | MCP network discovery |

### Removed Modules (All Consolidated)

| Module | Status | Replaced By |
|--------|--------|-------------|
| `pycore.pydevice` | ❌ REMOVED | `pycore.pyutils.device` |
| `pycore.pyadb` | ❌ REMOVED | `pycore.pyutils.device` |
| `pycore.pyfoundations.device` | ❌ REMOVED | `pycore.pyutils.device` |
| `pycore.pyutils.adb` | ❌ REMOVED | `pycore.pyutils.device` |

## Migration Examples

### Example 1: Matrix Application

**Before:**
```python
from pycore.pyadb import ADBManager
from pycore.pydevice import DeviceInfo, ServerParams

devices = ADBManager.list_devices()
params = ServerParams(max_size=720)
```

**After (Unified):**
```python
from pycore.pyutils.device import ADBManager, DeviceInfo, ServerParams

devices = ADBManager.list_devices()
params = ServerParams(max_size=720)
```

### Example 2: Device Service

**Before:**
```python
from pycore.pyadb import ADBManager, ADBDevice
from pycore.pydevice import DeviceInfo

class DeviceService:
    def list_devices(self):
        return ADBManager.list_devices()
```

**After (Unified):**
```python
from pycore.pyutils.device import ADBManager, ADBDevice, DeviceInfo

class DeviceService:
    def list_devices(self):
        return ADBManager.list_devices()
```

### Example 3: Using Enhanced Types

**Unified (All types in device module):**
```python
from pycore.pyutils.device import (
    ADBManager,
    ADBExecuteResult,
    ADBDeviceProperties
)

# Execute command with typed result
result: ADBExecuteResult = ADBManager.execute(
    serial="ABC123",
    args=["shell", "getprop"]
)

if result.success:
    print(f"Output: {result.stdout}")
```

## New Features

### 1. MCP Network Discovery

**New module for discovering MCP servers on local network:**

```python
from pycore.pyutils.mcp import MCPServerDiscovery

discovery = MCPServerDiscovery(debug=True)

# Quick discovery (local + gateway)
servers = discovery.find_servers_quick()

# Full discovery (entire network)
servers = discovery.find_servers_full()

for server in servers:
    print(f"Found MCP server: {server['host']}:{server['port']}")
```

### 2. Enhanced ADB Types

**Type-safe ADB operations:**

```python
from pycore.pyutils.adb import (
    ADBExecuteResult,
    ADBDeviceProperties,
    ADBDeviceBattery
)

# Type-safe command execution
result: ADBExecuteResult = ADBManager.execute(...)

# Device properties
props: ADBDeviceProperties = ADBManager.get_device_properties(serial)

# Battery information
battery: ADBDeviceBattery = ADBManager.get_battery_info(serial)
```

## Compatibility Timeline

| Version | Changes |
|---------|---------|
| 2.0.0 | Current - Deprecation warnings added |
| 2.5.0 | Planned - Warnings become more prominent |
| 3.0.0 | Planned - `pydevice` and `pyadb` removed |

## Checklist for Migration

- [ ] Update all `from pycore.pydevice` imports
- [ ] Update all `from pycore.pyadb` imports
- [ ] Test application with deprecation warnings enabled
- [ ] Update documentation and examples
- [ ] Consider using enhanced ADB types for better type safety
- [ ] Explore new MCP network discovery features

## Benefits of Migration

1. **Unified Structure**: All utilities in consistent location
2. **Better Type Safety**: Enhanced type definitions from pyadb
3. **Improved Maintainability**: Single source of truth
4. **New Features**: MCP discovery, enhanced ADB operations
5. **Future-Proof**: Aligned with long-term architecture

## Support

If you encounter issues during migration:

1. Check deprecation warnings for specific guidance
2. Refer to module docstrings for usage examples
3. Review test files for implementation patterns
4. Compatibility layers ensure gradual migration

## Summary

**TL;DR:**
- **ALL device and ADB functionality is now in ONE place: `pycore.pyutils.device`**
- Old imports (`pydevice`, `pyadb`, `pyfoundations.device`, `pyutils.adb`) are **REMOVED**
- Unified structure eliminates redundancy and confusion
- Single import path for all device/ADB needs
