# Build System Architecture

## Overview

This build system follows a clean separation of concerns architecture where:
- **Python** handles all logic and preparation
- **Shell scripts** only execute commands (no logic)
- **File variables** exchange data between Python and Shell (no direct parameters)

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Entry Points                              │
│  start_new.ps1 (Windows)  |  start_new.sh (Linux)          │
└──────────────┬───────────────────────────────────┬──────────┘
               │                                   │
               ▼                                   ▼
┌──────────────────────────────────┐  ┌──────────────────────┐
│   Python Main Controller         │  │  Decides Platform    │
│   main_controller.py             │  │  Windows vs Linux    │
└──────────────┬───────────────────┘  └──────────────────────┘
               │
               │ 1. Initializes build_config.ini
               │ 2. Processes logic
               │ 3. Prepares commands
               │ 4. Writes to file variables
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│            File Variable System                               │
│  .build_vars/{PREFIX}_vars.json                              │
│  .build_vars/{PREFIX}_commands.json                          │
│  (Prefix prevents conflicts between multiple apps)           │
└──────────────┬───────────────────────────────────┬───────────┘
               │                                   │
               ▼                                   ▼
┌──────────────────────────────────┐  ┌──────────────────────┐
│   Windows Executor               │  │   Linux Executor     │
│   execute_commands_windows.ps1   │  │   execute_commands_  │
│                                  │  │   linux.sh           │
│   1. Reads variables             │  │   1. Reads variables │
│   2. Executes commands           │  │   2. Executes cmds   │
│   3. Runs pnpm/build/etc         │  │   3. Runs pnpm/build │
└──────────────────────────────────┘  └──────────────────────┘
```

## Design Principles

### 1. File Variable Exchange (No Direct Parameters)

**Variables use app-specific prefix** to prevent conflicts:
```python
# For project "cmg-corporate-portal"
PREFIX = "CMG_CORPORATE_PORTAL"

# Variables stored as:
CMG_CORPORATE_PORTAL_APP_NAME = "..."
CMG_CORPORATE_PORTAL_PACKAGE_ID = "..."
```

**File locations:**
```
.build_vars/
  └─ CMG_CORPORATE_PORTAL_vars.json      # Variables
  └─ CMG_CORPORATE_PORTAL_commands.json  # Command queue
```

### 2. Python Does NOT Execute Shell Commands

Python only:
- Reads/creates build_config.ini
- Processes logic
- Determines what commands to run
- Writes variables and command queue to files

Python does NOT:
- Execute pnpm commands
- Run build tools
- Execute any shell commands

### 3. Shell Scripts Execute Commands (No Logic)

Shell scripts only:
- Read file variables
- Execute commands from queue
- Run pnpm/npm/build tools

Shell scripts do NOT:
- Process logic
- Make decisions
- Parse configuration files

### 4. Platform-Specific Executors

**Windows:** `execute_commands_windows.ps1`
- Reads JSON with PowerShell
- Executes pnpm/npx/gradlew.bat

**Linux:** `execute_commands_linux.sh`
- Reads JSON with python3/jq
- Executes pnpm/npx/gradlew

## File Structure

```
scripts/
├── start_new.ps1                           # Windows entry point
├── start_new.sh                            # Linux entry point
└── build_scripts/
    ├── file_var_system.py                  # File variable handler
    ├── main_controller.py                  # Python main controller
    ├── init_build_config.py                # Config initialization
    ├── execute_commands_windows.ps1        # Windows executor
    └── execute_commands_linux.sh           # Linux executor
```

## Usage

### Windows
```powershell
cd scripts
.\start_new.ps1
```

### Linux
```bash
cd scripts
./start_new.sh
```

### Direct Action (Skip Menu)
```powershell
# Windows
.\start_new.ps1 install_capacitor

# Linux
./start_new.sh install_capacitor
```

Available actions:
- `install_capacitor`
- `dev_server`
- `build_web`
- `build_android`

## Command Queue Format

Commands are stored in JSON format:

```json
[
  {
    "command": "install_core_packages",
    "description": "Install Capacitor core packages",
    "working_dir": "/path/to/project"
  },
  {
    "command": "init_capacitor|App Name|com.package.id",
    "description": "Initialize Capacitor",
    "working_dir": "/path/to/project"
  }
]
```

Commands use pipe `|` delimiter for parameters.

## Variable Prefix System

Each project gets a unique prefix based on folder name:

| Folder Name           | Prefix                  |
|-----------------------|-------------------------|
| cmg-corporate-portal  | CMG_CORPORATE_PORTAL    |
| my-awesome-app        | MY_AWESOME_APP          |
| test_app_123          | TEST_APP_123            |

This prevents variable collisions when multiple projects use the same build system.

## Benefits

1. **Cross-platform compatibility**: Platform differences handled in executors
2. **Clean separation**: Logic in Python, execution in Shell
3. **Testable**: Python logic can be unit tested
4. **No conflicts**: Prefixed variables prevent multi-app issues
5. **Maintainable**: Each component has single responsibility
6. **Debuggable**: File variables can be inspected between steps

## Extending the System

### Adding a New Command

1. **In Python controller** (`main_controller.py`):
```python
self.var_system.add_command(
    "my_new_command",
    "Description of command",
    str(self.project_root)
)
```

2. **In Windows executor** (`execute_commands_windows.ps1`):
```powershell
switch ($cmd) {
    "my_new_command" {
        Execute-MyNewCommand -Vars $Vars
    }
}
```

3. **In Linux executor** (`execute_commands_linux.sh`):
```bash
case "$cmd" in
    my_new_command)
        execute_my_new_command
        ;;
esac
```

### Adding Variables

```python
# In Python
self.var_system.set_var("MY_VARIABLE", "value")

# In Windows PowerShell
$myValue = $vars["MY_VARIABLE"]

# In Linux Bash
# (Variables are auto-exported with VAR_ prefix)
echo $VAR_MY_VARIABLE
```
