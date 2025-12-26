# Frontend Management Scripts

## Overview

Write a ps1/shell script that locates `core_node/poly_apps` directory from current script location, then scans all subdirectories, calls Python auxiliary methods to automatically identify the frontend type of each subdirectory.

Supports react/react-native/nuxt/nexus/vue/vite and other projects. Then use a port range starting from 10000, automatically assign a port to each project under `/poly_apps`. Prevent multiple projects from sharing ports when starting, then save detection results to file variables. Then display menu by Python, according to different projects, the displayed menu is:

```
NuxtAppName1[Port1]  [Build/Debug/etc...|Web/Deploy2ServerANDsync laravel ]
ReactNativeAppName2[Port2]  [Build/Debug/etc...|Web/Android/Deploy2ServerANDsync laravel ]
```

Use up/down arrows to switch APP, use left arrow to toggle Build/Debug/etc... function area, use right arrow to toggle platform area Web/Android. Note: According to each framework, do not hardcode preset menus. Menu should be stored in cache, then record selection to file variables.

## Rules

1. **Prohibit parameter passing between shell scripts and Python**
2. **Use Key Center**: Use key center for all variable names instead of strings

## Directory Scanning

Scan directory `poly_apps/`

- Do not use exit code detection, do not use return information, all rely on direct output
- Do not allow pre-hardcoding of projects, use Python auxiliary scripts to scan

## Selection Process

After selection, according to function, return to shell to read data, switch working directory, start project. Common scripts placed in Python, shell only responsible for starting. Complete Windows and Linux shell scripts.

## Integration with dd.sh

In `dd.sh`'s "Unified App Manager", add menu for above functionality. Can directly start as system service and sync to Laravel reverse proxy.

## Architecture Design

### 1. Directory Structure

```
scripts/build_scripts/
├── poly_app_manager.sh              # Linux startup script
├── poly_app_manager.ps1             # Windows startup script  
├── build_py_tools/
│   ├── keys_center.py               # Key center (all variable name definitions)
│   ├── project_detector.py          # Project type automatic detector
│   ├── menu_system.py               # Interactive menu system
│   ├── file_var_handler.py          # File variable read/write processor
│   └── framework_configs.py         # Framework configuration (dynamically generate menu options)
```

### 2. Workflow

**Pre-work**: First understand how to integrate with Unified App Manager in dd.sh.

In `dd.sh`'s "Unified App Manager" menu, add:
5) Poly Apps Manager - Multi-project Manager
   - Interactive startup of all poly_apps projects
   - Automatic port allocation
   - Support deployment as system service

**Phase 1: Project Scanning (Python)**

1. Scan all subdirectories of `poly_apps/`
2. Detect project type:
   - React Native: Check if package.json has react-native dependency, find android/ios directories
   - Nuxt: Check nuxt.config.ts/js or nuxt dependency in package.json
   - Next.js: Check next.config.js or pages/app directory
   - React+Vite: Check vite.config.js + react
   - Vue+Vite: Check vite.config.js + vue
   - Flutter: Check pubspec.yaml
   - Laravel: Check composer.json + artisan
3. Automatically assign ports (starting from 10000, incrementing)
4. Write results to file variables (JSON format)

**Phase 2: Menu Display (Python)**

1. Read scan results
2. Dynamically generate menu items according to project type:
   - Nuxt: [Debug|Build|Generate] → [Web|Deploy+Reverse Proxy (based on Laravel Nginx management)]
   - React Native: [Debug|Build|Release] → [Android|iOS|Web|Deploy+Reverse Proxy (based on Laravel Nginx management)]
   - Flutter: [Debug|Build|Release] → [Android|iOS|Web|Linux]
   - React/Vue: [Dev|Build|Preview] → [Web|Deploy+Reverse Proxy (based on Laravel Nginx management)]
3. Use curses/blessed to implement arrow key navigation
4. Cache user's last selection (project index, function index, platform index)
5. After user presses Enter, write selection to file variables

**Phase 3: Project Startup (Shell)**

1. Shell reads file variables to get user selection
2. Switch to target project directory
3. Set environment variables (PORT, etc.)
4. Execute corresponding commands:
   - Debug mode: Start dev server
   - Build mode: Execute build
   - Deploy mode: Build + call Laravel command service

### 3. File Variable Design

**Storage Location**:
- Linux: Find gvar common var sh script to view
- Windows: Find GlobalVar script to view

**Variable Files**:
Use one filename one value, do not use JSON

### 4. Key Center Design

`keys_center.py`:
```python
class KeysCenter:
    # File variable keys
    KEY_SCAN_RESULTS = "scan_results"
    KEY_USER_SELECTION = "user_selection"
    KEY_MENU_CACHE = "menu_cache"
    KEY_PORT_ASSIGNMENTS = "port_assignments"

    # Project information keys
    KEY_PROJECT_NAME = "project_name"
    KEY_PROJECT_TYPE = "project_type"
    KEY_PROJECT_PATH = "project_path"
    KEY_PROJECT_PORT = "project_port"

    # Menu keys
    KEY_SELECTED_PROJECT_INDEX = "selected_project_index"
    KEY_SELECTED_ACTION_INDEX = "selected_action_index"
    KEY_SELECTED_PLATFORM_INDEX = "selected_platform_index"
```

### 5. Shell Script Flow

**Linux (poly_app_manager.sh)**:
1. Locate to core_node root directory
2. Call Python scan: `python3 build_py_tools/project_detector.py`
3. Call Python menu: `python3 build_py_tools/menu_system.py`
4. Read `user_selection.json`
5. Switch to project directory
6. Execute startup command according to selection

**Windows (poly_app_manager.ps1)**:
Same flow, using PowerShell syntax

### 6. Laravel Reverse Proxy Integration

When selecting "Deploy+Sync Laravel":
1. Build project
2. Call `php artisan servermanager:register <type> <name> --port=<port>`
3. Create systemd service
4. Configure Nginx reverse proxy

**Note**: [Build] | [Deploy+Laravel] Note that both modes can be deployed as service, just startup commands are different. If build mode, need to compile first. All this preprocessing work is completed by shell, Python (responsible for organizing variables), passed to shell through file system.

## Rules Compliance

1. **Python does not execute commands**: Return to shell for execution
2. **Laravel server manager**: Only responsible for refreshing Nginx reverse proxy files and creating service files

Comprehensively check if this is the specification.

Comprehensively check consistency again, ensure all commands will return to shell for execution. Then complete Windows-side call in `dd.ps1`. Now ensure minimal execution difference code in shell, Python provides comprehensive assistance.

## Thread Bus Integration

After frontend startup succeeds, trigger THREAD_BUS event. Frontend startup trigger is divided into:
- Debug mode: Frontend dev startup detection mechanism
- Production mode: After mounting static directory, start RPC v2 trigger

Comprehensively find uniformity, and all package references placed at file beginning, all code in English.

