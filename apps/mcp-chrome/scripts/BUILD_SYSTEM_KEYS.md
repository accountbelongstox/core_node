# Cross-Platform Build System with Unified Variable Key Center

## Overview

This build system uses a unified architecture with **Python for cross-platform logic** and **Shell/PowerShell for command execution**, connected through a **centralized variable KEY system**.

## Key Features

✅ **Unified Variable KEY Center** - All variables defined in one place (`build_vars.py`)
✅ **Cross-Platform** - Works on Windows (PowerShell), Linux/macOS (Bash)
✅ **Prefix-Based** - All variables use `mcpchrome_` prefix to avoid conflicts
✅ **Type-Safe** - Python/PS1/SH all use constants instead of hardcoded strings
✅ **Auto-Generated** - KEY definitions automatically generated for each platform

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  build_vars.py (Single Source of Truth)                 │
│  - All variable KEYs defined here                       │
│  - Prefix: mcpchrome_                                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
       generate_var_keys.py
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
VarKeys.ps1  var_keys.sh  (Python uses build_vars.py directly)
    │            │            │
    ▼            ▼            ▼
start.ps1    start.sh   build_orchestrator.py
    │            │            │
    └────────────┴────────────┘
                 │
                 ▼
         Variable Files
    (C:\Users\XXX\.core_node\.build_global_vars\)
    or (/var/_core_node/_build_global_vars/)
```

## File Structure

```
scripts/
├── build_vars.py              # ⭐ Variable KEY center (source of truth)
├── generate_var_keys.py       # Auto-generate KEY files for PS1/SH
├── VarKeys.ps1                # 🔄 Auto-generated PowerShell KEYs
├── var_keys.sh                # 🔄 Auto-generated Bash KEYs
├── var_manager.py             # Python variable file I/O
├── VarManager.ps1             # PowerShell variable file I/O
├── var_manager.sh             # Bash variable file I/O
├── build_orchestrator.py      # Python logic (cross-platform differences)
├── start.ps1                  # Windows entry point
├── start.sh                   # Linux/macOS entry point
└── BUILD_SYSTEM_KEYS.md       # This file
```

## Variable KEY Usage

### Python (build_orchestrator.py)

```python
from build_vars import BuildVars
from var_manager import get_instance

vm = get_instance()

# Set variable using KEY constant
vm.set(BuildVars.PROJECT_ROOT, "/path/to/project")
vm.set(BuildVars.PLATFORM, "windows")

# Get variable using KEY constant
root = vm.get(BuildVars.PROJECT_ROOT)
```

### PowerShell (start.ps1)

```powershell
# Load KEY definitions
. .\VarKeys.ps1
Import-Module .\VarManager.ps1

# Set variable using KEY constant
Set-Var -Key ([VarKeys]::PROJECT_ROOT) -Value "C:\path\to\project"

# Get variable using KEY constant
$root = Get-Var -Key ([VarKeys]::PROJECT_ROOT)
$platform = Get-Var -Key ([VarKeys]::PLATFORM) -Default "windows"
```

### Bash (start.sh)

```bash
# Load KEY definitions
source ./var_keys.sh
source ./var_manager.sh

# Set variable using KEY constant
set_var "$VAR_KEY_PROJECT_ROOT" "/path/to/project"

# Get variable using KEY constant
root=$(get_var "$VAR_KEY_PROJECT_ROOT")
platform=$(get_var "$VAR_KEY_PLATFORM" || echo "linux")
```

## All Variable KEYs

### Basic Environment
| Constant | Key | Description |
|----------|-----|-------------|
| `PROJECT_ROOT` | `mcpchrome_project_root` | Project root directory |
| `PLATFORM` | `mcpchrome_platform` | Platform (windows/linux/darwin) |
| `VARS_DIR` | `mcpchrome_vars_dir` | Variable storage directory |

### Dependency Versions
| Constant | Key | Description |
|----------|-----|-------------|
| `NODE_VERSION` | `mcpchrome_node_version` | Node.js version |
| `PNPM_VERSION` | `mcpchrome_pnpm_version` | pnpm version |
| `NODE_INSTALLED` | `mcpchrome_node_installed` | Node.js installed flag |
| `PNPM_INSTALLED` | `mcpchrome_pnpm_installed` | pnpm installed flag |

### Path Variables
| Constant | Key | Description |
|----------|-----|-------------|
| `EXTENSION_PATH` | `mcpchrome_extension_path` | Extension output path |
| `NATIVE_PATH` | `mcpchrome_native_path` | Native Server path |
| `SHARED_PATH` | `mcpchrome_shared_path` | Shared package path |
| `MANIFEST_PATH` | `mcpchrome_manifest_path` | Native Messaging Host manifest path |
| `NODE_MODULES_EXISTS` | `mcpchrome_node_modules_exists` | node_modules exists flag |

### Build Commands
| Constant | Key | Description |
|----------|-----|-------------|
| `CMD_CHECK_DEPS` | `mcpchrome_cmd_check_deps` | Check dependencies command |
| `CMD_INSTALL` | `mcpchrome_cmd_install` | Install dependencies command |
| `CMD_BUILD_SHARED` | `mcpchrome_cmd_build_shared` | Build shared package command |
| `CMD_BUILD_NATIVE` | `mcpchrome_cmd_build_native` | Build native server command |
| `CMD_BUILD_EXTENSION` | `mcpchrome_cmd_build_extension` | Build extension command |
| `CMD_REGISTER` | `mcpchrome_cmd_register` | Register Native Messaging Host command |

### Status Flags
| Constant | Key | Description |
|----------|-----|-------------|
| `ERROR` | `mcpchrome_error` | Error message |
| `SHOULD_INSTALL` | `mcpchrome_should_install` | Should install dependencies flag |
| `BUILD_RETRY_MAX` | `mcpchrome_build_retry_max` | Build max retry count |

### UI Strings
| Constant | Key | Description |
|----------|-----|-------------|
| `UI_TITLE` | `mcpchrome_ui_title` | UI title |
| `UI_STEP_1` | `mcpchrome_ui_step_1` | Step 1 description |
| `UI_STEP_2` | `mcpchrome_ui_step_2` | Step 2 description |
| `UI_STEP_3` | `mcpchrome_ui_step_3` | Step 3 description |
| `UI_STEP_4` | `mcpchrome_ui_step_4` | Step 4 description |
| `UI_STEP_5` | `mcpchrome_ui_step_5` | Step 5 description |
| `UI_STEP_6` | `mcpchrome_ui_step_6` | Step 6 description |

## Adding New Variables

### Step 1: Define in build_vars.py

```python
class BuildVars:
    PREFIX = "mcpchrome_"

    # Add your new variable KEY here
    MY_NEW_VAR = f"{PREFIX}my_new_var"
```

### Step 2: Regenerate KEY files

```bash
cd scripts
python generate_var_keys.py
```

This generates:
- `VarKeys.ps1` (PowerShell)
- `var_keys.sh` (Bash)
- `VAR_KEYS.md` (Documentation)

### Step 3: Use in build_orchestrator.py

```python
from build_vars import BuildVars

vm = get_instance()
vm.set(BuildVars.MY_NEW_VAR, "my_value")
```

### Step 4: Use in start.ps1

```powershell
$myValue = Get-Var -Key ([VarKeys]::MY_NEW_VAR)
```

### Step 5: Use in start.sh

```bash
my_value=$(get_var "$VAR_KEY_MY_NEW_VAR")
```

## Variable Storage Locations

### Windows
```
C:\Users\<username>\.core_node\.build_global_vars\
```

### Linux/macOS
```
/var/_core_node/_build_global_vars/  (preferred)
~/.core_node/.build_global_vars/     (fallback if no /var permission)
```

## Workflow

### 1. Python Processing Phase

```python
# build_orchestrator.py
- Detect platform
- Set environment variables
- Generate build commands
- Save to variable files
```

### 2. Shell Execution Phase

```bash
# start.ps1 / start.sh
- Read variables from files
- Execute build commands
- Display results
```

## Benefits

✅ **No String Duplication** - Variable keys defined once in `build_vars.py`
✅ **Type Safety** - Use constants instead of hardcoded strings
✅ **Maintainability** - Change key in one place, updates everywhere
✅ **Consistency** - Same keys across Python, PowerShell, and Bash
✅ **Auto-Generation** - Platform-specific files generated automatically
✅ **Prefix Protection** - `mcpchrome_` prefix avoids conflicts
✅ **Multi-Project** - Each project can have its own prefix

## Testing

### Test Variable System

```powershell
# Windows
.\scripts\test_var_system.ps1
```

```bash
# Linux/macOS (create similar test)
./scripts/test_var_system.sh
```

### Test Full Build

```powershell
# Windows
.\scripts\start.ps1
```

```bash
# Linux/macOS
./scripts/start.sh
```

## Debugging

### View All Variables

**PowerShell:**
```powershell
. .\scripts\VarKeys.ps1
Import-Module .\scripts\VarManager.ps1
Get-AllVars
```

**Bash:**
```bash
source ./scripts/var_keys.sh
source ./scripts/var_manager.sh
list_all_vars
```

**Python:**
```python
from var_manager import get_instance
vm = get_instance()
for key, value in vm.list_all().items():
    print(f"{key} = {value}")
```

### Clear All Variables

```powershell
Clear-AllVars  # PowerShell
```

```bash
clear_all_vars  # Bash
```

```python
vm.clear_all()  # Python
```

## Best Practices

1. **Always use KEY constants** - Never hardcode variable names
2. **Regenerate after changes** - Run `generate_var_keys.py` after modifying `build_vars.py`
3. **Commit generated files** - Include `VarKeys.ps1`, `var_keys.sh` in version control
4. **Use prefix** - All keys must start with `mcpchrome_`
5. **Document new keys** - Add comments in `build_vars.py`

## Troubleshooting

### Python script fails
Check `mcpchrome_error` variable:
```powershell
Get-Var -Key ([VarKeys]::ERROR)
```

### Variable not found
1. Ensure Python script ran successfully
2. Check variable directory exists
3. Verify KEY is defined in `build_vars.py`

### Path issues
All paths are absolute. Check:
```powershell
Get-Var -Key ([VarKeys]::PROJECT_ROOT)
Get-Var -Key ([VarKeys]::VARS_DIR)
```

## License

Part of the Chrome MCP Server project.
