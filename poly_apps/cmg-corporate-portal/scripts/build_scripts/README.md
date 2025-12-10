# Build Scripts - Capacitor/Android Build System

## Directory Structure

```
build_scripts/
├── main.py                          # Entry point - Start here
├── build_versions_config.json       # Version configuration (Capacitor 8, AGP 8.13, etc.)
│
├── core/                            # Core business logic
│   ├── __init__.py
│   └── build_controller.py          # Main controller (1600+ lines)
│       ├── BuildController class
│       ├── Capacitor upgrade detection & application
│       ├── Android manifest configuration
│       ├── Gradle version checking
│       └── Build preparation methods
│
├── managers/                        # Resource and configuration managers
│   ├── __init__.py
│   ├── capacitor_resource_manager.py  # Capacitor asset management
│   ├── resource_replacer.py           # Android resource replacement
│   └── resource_scanner.py            # Resource scanning & reporting
│
├── utils/                           # Utility modules
│   ├── __init__.py
│   ├── file_var_system_new.py       # File-based variable system (Python↔Shell)
│   ├── init_build_config.py         # Build configuration initialization
│   ├── key_center.py                # Central key definitions & version config
│   └── web_preview_server.py        # Web-based resource preview server
│
├── shell/                           # Shell execution scripts
│   ├── execute_commands_windows_new.ps1  # PowerShell execution script
│   └── execute_commands_linux_new.sh     # Bash execution script
│
└── docs/                            # Documentation
    ├── PRE_BUILD_CHECKLIST.md       # Frontend configuration checklist
    ├── BUILD_FLOW_CONFIRMED.md
    ├── CAPACITOR_INTEGRATION_COMPLETE.md
    └── ... (other documentation files)
```

## Entry Point

**File:** `main.py`

This is the main entry point. All external scripts should call this file.

**Usage:**
```bash
python main.py <project_root_path>
```

**Example:**
```bash
python main.py D:/programming/core_node/poly_apps/cmg-corporate-portal
```

**What it does:**
1. Validates project root path
2. Creates `BuildController` instance
3. Shows interactive menu
4. Executes selected action
5. Prepares file variables for shell script execution

## Architecture Principles

### 1. Separation of Concerns

- **main.py**: Entry point (minimal code, delegates to controller)
- **core/build_controller.py**: Business logic (does NOT execute commands)
- **shell/execute_commands_*.{ps1,sh}**: Command execution (does NOT contain logic)
- **managers/**: Specialized resource management
- **utils/**: Reusable utility functions

### 2. Python ↔ Shell Communication

**File-Based Variable System** (`utils/file_var_system_new.py`):
- Python writes variables to individual files (with app prefix)
- Shell scripts read variables from files
- **NO** direct parameter passing
- **NO** exit code checking in shell
- **NO** output parsing in shell

**Example:**
```python
# Python side
var_system.set_var("APP_NAME", "MyApp")
var_system.add_command("build_android_apk", "Build Android APK", "/path/to/android")

# Shell side (PowerShell)
$appName = Get-VarValue -Key "APP_NAME" -Prefix $Prefix
# Execute command based on file variables
```

### 3. No Code in Main Entry

The `main.py` file contains minimal code:
- Argument validation
- Controller instantiation
- Action delegation

All business logic is in `core/build_controller.py`.

## Module Responsibilities

### core/build_controller.py

**BuildController class** - Main controller with ~1600 lines of business logic:

**Capacitor Upgrade:**
- `_detect_capacitor_upgrade_needed()` - Detect if upgrade needed
- `_prepare_capacitor_upgrade_files()` - Prepare file replacements
- `_apply_capacitor_upgrade()` - Apply upgrade plan

**Android Configuration:**
- `_ensure_android_manifest_config()` - Ensure manifest has safe area config
- `_configure_gradle_properties()` - Configure Gradle network settings
- `_check_gradle_version()` - Verify Gradle version
- `_auto_clean_gradle_cache()` - Clean Gradle cache to prevent JAR issues

**Build Preparation:**
- `prepare_capacitor_install()` - Prepare Capacitor installation
- `prepare_android_build()` - Prepare Android build
- `prepare_web_build()` - Prepare web build
- `prepare_dev_server()` - Prepare dev server

**Configuration:**
- `initialize_build_config()` - Initialize build configuration
- `update_package_json_with_capacitor()` - Update package.json

**UI:**
- `show_menu()` - Show interactive menu

### managers/capacitor_resource_manager.py

Handles Capacitor-specific asset generation:
- Icon preparation (1024x1024 PNG)
- Splash screen preparation (2732x2732 PNG)
- Integration with `@capacitor/assets` CLI

### managers/resource_replacer.py

Custom Android resource replacement:
- Replace app icons (mipmap directories)
- Replace splash screens (drawable directories)
- Update app names in strings.xml
- Multi-language support

### managers/resource_scanner.py

Scans and reports Android resources:
- Icon files (all densities)
- Splash screen files
- Organized by resource type
- Used for web preview

### utils/file_var_system_new.py

File-based variable system for Python↔Shell communication:
- Write variables to individual files with app prefix
- Read variables from files
- Command queue management
- Prevents variable collision between multiple apps

### utils/init_build_config.py

Build configuration initialization:
- Generate app name from folder name
- Generate package ID
- Generate display name (English/Chinese)
- Create/read `build_config.ini`
- Extract configuration info

### utils/key_center.py

Central key definitions and version configuration:
- Load `build_versions_config.json`
- Define all file variable keys
- Constants for fix methods
- Helper functions for configuration access

### utils/web_preview_server.py

Web-based resource preview:
- Flask server showing Android resources
- Live preview before build
- User confirmation interface
- Port 8899 by default

## Configuration Files

### build_versions_config.json

Central version configuration for Capacitor 8:

```json
{
  "capacitor": {
    "required_major_version": 8
  },
  "android_build_tools": {
    "agp_version": "8.13.0",
    "gradle_version": "8.14.3",
    "google_services_version": "4.4.4"
  },
  "android_sdk": {
    "compile_sdk": "36",
    "target_sdk": "36",
    "min_sdk": "24",
    "kotlin_version": "2.2.20"
  },
  "androidx_dependencies": {
    "androidxActivityVersion": "1.11.0",
    "androidxAppCompatVersion": "1.7.1",
    // ... more dependencies
  },
  "java_requirements": {
    "minimum_version": "17",
    "recommended_version": "21"
  }
}
```

**Official Sources:**
- https://capacitorjs.com/docs/updating/8-0
- https://capacitorjs.com/docs/updating/plugins/8-0
- https://developer.android.com/build/releases/gradle-plugin

## Shell Scripts

### shell/execute_commands_windows_new.ps1

PowerShell script for Windows:
- Reads file variables (NO parameters)
- Executes commands in order
- NO exit code checking
- NO output parsing
- Prompts user with [y/N] format (default No)

**Key Functions:**
- `Initialize-Capacitor` - Init Capacitor project
- `Remove-AndroidPlatform` - Remove Android folder
- `Build-AndroidAPK` - Build APK with ADB commands display

### shell/execute_commands_linux_new.sh

Bash script for Linux/Mac:
- Same architecture as PowerShell version
- Equivalent functions
- Cross-platform compatibility

## Usage Flow

1. **User runs start script:**
   ```bash
   # Windows
   .\poly_apps\cmg-corporate-portal\scripts\start.ps1

   # Linux/Mac
   ./poly_apps/cmg-corporate-portal/scripts/start.sh
   ```

2. **Start script calls main.py:**
   ```bash
   python build_scripts/main.py <project_root>
   ```

3. **main.py shows menu:**
   ```
   1. Install Capacitor
   2. Development Server
   3. Build for Web
   4. Build for Android
   Q. Quit
   ```

4. **User selects action → Python preprocessing:**
   - Validates configuration
   - Checks versions
   - Prepares file variables
   - Writes commands to execute

5. **Start script calls shell script:**
   ```powershell
   # Windows
   .\build_scripts\shell\execute_commands_windows_new.ps1 -Prefix <app_prefix>
   ```

6. **Shell script executes commands:**
   - Reads file variables
   - Executes commands in order
   - Displays results

## Important Notes

### For AI Developers

1. **Entry Point:** Always call `main.py`, never `main_controller.py` directly
2. **Imports:** Use relative imports from utils/managers when modifying code
3. **Architecture:** Keep Python logic separate from shell execution
4. **Variables:** Use file variable system, never direct parameters to shell
5. **Error Handling:** No exit code checking in shell scripts

### For Frontend Developers

See `docs/PRE_BUILD_CHECKLIST.md` for complete frontend configuration requirements:
- StatusBar plugin installation
- Safe area insets configuration
- Viewport meta tag
- CSS/Tailwind configuration
- Resource file requirements

## Maintenance

### Adding New Commands

1. **Python side** (`core/build_controller.py`):
   ```python
   self.var_system.add_command(
       "my_command",
       "Description of command",
       "/path/to/execute"
   )
   ```

2. **Shell side** (`shell/execute_commands_*.{ps1,sh}`):
   ```powershell
   "my_command" {
       $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
       # Execute command logic
       Write-Host "Command completed"
   }
   ```

### Modifying Version Configuration

Edit `build_versions_config.json`:
- Update versions
- Add new dependencies
- Verify against official Capacitor documentation

The `key_center.py` will automatically load and display configuration at startup.

## Documentation

All documentation moved to `docs/` directory:
- `PRE_BUILD_CHECKLIST.md` - **Start here for frontend setup**
- `BUILD_FLOW_CONFIRMED.md` - Confirmed build flow
- `CAPACITOR_INTEGRATION_COMPLETE.md` - Capacitor integration guide
- `GRADLE_CACHE_AUTO_FIX.md` - Gradle cache issues
- And more...

## License

Internal project - Not for public distribution

## Contact

For issues or questions, contact the build system maintainer.
