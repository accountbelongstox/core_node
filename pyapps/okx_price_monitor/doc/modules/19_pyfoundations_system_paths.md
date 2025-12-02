# pyfoundations.system_paths - System Paths

## Overview

The `system_paths` module defines system-wide cache and data directories for core_node applications. It provides cross-platform path management for storing persistent data, cache, and configuration files.

## Module Location

```
pycore/pyfoundations/system_paths.py
```

## Platform-Specific Paths

**Windows:**
```
C:\Users\{username}\.core_node\
├── cache/          # Application cache files
├── config/         # Configuration files
├── data/           # Persistent data
├── logs/           # Log files
└── ui_state/       # UI state cache
```

**Linux:**
```
/var/_core_node/
├── cache/
├── config/
├── data/
├── logs/
└── ui_state/
```

## Core Components

### SystemPaths

Path provider class:

```python
from pycore.pyfoundations.system_paths import SystemPaths

paths = SystemPaths()

# Base directory
print(paths.base_dir)  # C:\Users\xxx\.core_node or /var/_core_node

# Subdirectories
print(paths.cache_dir)     # .../cache
print(paths.config_dir)    # .../config
print(paths.data_dir)      # .../data
print(paths.logs_dir)      # .../logs
print(paths.ui_state_dir)  # .../ui_state

# Ensure directories exist
paths.ensure_dirs()

# Get app-specific path
app_cache = paths.get_app_cache_dir("my_app")
# Returns: .../cache/my_app/

# Get file path
config_file = paths.get_config_file("settings.json")
# Returns: .../config/settings.json
```

### Path Functions

```python
from pycore.pyfoundations.system_paths import (
    get_base_dir,
    get_cache_dir,
    get_config_dir,
    get_data_dir,
    get_logs_dir,
    get_ui_state_dir,
    ensure_system_dirs
)

# Get directories
base = get_base_dir()
cache = get_cache_dir()
config = get_config_dir()
data = get_data_dir()
logs = get_logs_dir()
ui_state = get_ui_state_dir()

# Ensure all exist
ensure_system_dirs()
```

### App-Specific Paths

```python
from pycore.pyfoundations.system_paths import (
    get_app_cache_dir,
    get_app_data_dir,
    get_app_config_dir,
    get_app_log_file
)

# Cache for specific app
cache = get_app_cache_dir("my_app")
# .../cache/my_app/

# Data for specific app
data = get_app_data_dir("my_app")
# .../data/my_app/

# Config for specific app
config = get_app_config_dir("my_app")
# .../config/my_app/

# Log file for specific app
log = get_app_log_file("my_app")
# .../logs/my_app.log
```

## Usage Examples

### Initialize Paths

```python
from pycore.pyfoundations.system_paths import SystemPaths

# Create paths manager
paths = SystemPaths()

# Ensure all directories exist
paths.ensure_dirs()

# Store app data
import json
data_file = paths.get_app_data_dir("my_app") / "data.json"
data_file.parent.mkdir(parents=True, exist_ok=True)

with open(data_file, 'w') as f:
    json.dump({"key": "value"}, f)
```

### Platform Detection

```python
from pycore.pyfoundations.system_paths import (
    is_windows,
    is_linux,
    is_macos,
    get_platform
)

if is_windows():
    print("Running on Windows")
elif is_linux():
    print("Running on Linux")
elif is_macos():
    print("Running on macOS")

platform = get_platform()  # 'windows', 'linux', or 'macos'
```

### Temporary Files

```python
from pycore.pyfoundations.system_paths import get_temp_dir

temp = get_temp_dir()
# Creates temporary directory in cache/tmp/

# Auto-cleanup temp file
from pycore.pyfoundations.system_paths import temp_file

with temp_file(suffix=".json") as f:
    json.dump(data, f)
    # File auto-deleted after context
```

## Best Practices

1. **Use Provided Functions**: Don't hardcode paths
2. **Ensure Dirs Exist**: Call ensure_dirs() at startup
3. **Use App-Specific Dirs**: Isolate app data
4. **Clean Temp Files**: Use temp_file context manager

## Exports

```python
__all__ = [
    'SystemPaths',
    'get_base_dir',
    'get_cache_dir',
    'get_config_dir',
    'get_data_dir',
    'get_logs_dir',
    'get_ui_state_dir',
    'get_app_cache_dir',
    'get_app_data_dir',
    'get_app_config_dir',
    'get_app_log_file',
    'get_temp_dir',
    'temp_file',
    'ensure_system_dirs',
    'is_windows',
    'is_linux',
    'is_macos',
    'get_platform',
]
```





