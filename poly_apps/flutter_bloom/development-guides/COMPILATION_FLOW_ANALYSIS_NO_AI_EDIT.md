# Flutter Bloom Compilation Flow - Code Analysis

> **Based on Code Analysis**: This document describes the actual compilation flow as implemented in the codebase, not theoretical specifications.

## Overview

Flutter Bloom uses a **two-phase hybrid build system** with Python orchestrating the build preparation and PowerShell executing the final compilation.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    START (start.ps1)                         │
│  - Entry point validation                                    │
│  - Environment setup                                         │
│  - PowerShell module loading                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────────┐
│              PYTHON ORCHESTRATOR (main.py)                   │
│  - FlutterBloomLauncher initialization                       │
│  - App selection and action routing                          │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        v                         v
   ┌────────┐              ┌──────────────┐
   │ DEBUG  │              │ BUILD/RELEASE│
   │  MODE  │              │     MODE     │
   └────┬───┘              └──────┬───────┘
        │                         │
        v                         v
   Platform                  ModernFlutterBuildSystem
   Debugger                  (20-step pipeline)
        │                         │
        v                         v
   flutter run              flutter build
```

## Execution Flow

### Phase 1: Initialization

**File**: `scripts/start.ps1` (lines 16-48)

```powershell
# 1. Locate script directory and Flutter Bloom root
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FLUTTER_BLOOM_ROOT = Split-Path -Parent $SCRIPT_DIR

# 2. Declare variables
$BUILD_SCRIPTS_DIR = Join-Path $SCRIPT_DIR "build_scripts"
$MAIN_PY = Join-Path $BUILD_SCRIPTS_DIR "main.py"

# 3. Import PowerShell modules
. $globalVarPath
. $commonUtilPath
. $logManagerPath
. $bcommonPath
```

### Phase 2: Python Launcher

**File**: `scripts/build_scripts/main.py` (lines 14-62)

```python
def main():
    # 1. Switch to origin directory
    dir_manager = DirectoryManager()
    dir_manager.switch_to_origin_dir()

    # 2. Run launcher (app selection + routing)
    launcher = FlutterBloomLauncher()
    result = launcher.run()

    # 3. Extract results
    exit_code = result["exit_code"]
    mode = result["mode"]
    selection_data = result["selection_data"]

    # 4. Route based on mode
    if mode == "build":
        build_system = ModernFlutterBuildSystem()
        build_result = build_system.run()
```

**Key Decision Point**: The launcher determines whether to execute debug mode (handled by platform debuggers) or build mode (handled by build system).

### Phase 3: App Selection

**File**: `scripts/build_scripts/core/flutter_launcher.py` (lines 142-180)

```python
def run(self):
    # 1. Print directory information
    self.dir_manager.print_status()

    # 2. Initialize environment
    if not self.initialize_environment():
        return error_result

    # 3. Select app (interactive menu)
    selection_result = self.select_app()

    # 4. Save selection variables
    self.save_selection_variables(selection_data)

    # 5. Route and save script
    routing_result = self.route_and_save_script(selection_data)

    # 6. Return mode (debug or build)
    return {
        "exit_code": 0,
        "mode": routing_result["mode"],
        "selection_data": selection_data
    }
```

**Variables Saved** (lines 58-63):
- `KEY_SELECTED_APP` - Selected app name
- `KEY_SELECTED_ACTION` - Action (debug/build/release)
- `KEY_SELECTED_PLATFORM` - Target platform
- `KEY_SELECTED_ENTRY_FILE` - Entry file path
- `KEY_APP_INDEX` - App index
- `KEY_DEBUG_PORT` - Debug port

### Phase 4A: Debug Mode (if action == "debug")

**File**: `scripts/build_scripts/core/flutter_launcher.py` (lines 86-113)

```python
if action.lower() == "debug":
    platform_scripts = {
        "web": "startDebugByWeb.ps1",
        "android": "startDebugByPhone.ps1",
        "ios": "startDebugByIOS.ps1",
        "windows": "startDebugByWindows.ps1"
    }

    # Save script path to variables
    unified_vars.set_file_variable(KEY_SCRIPT_PATH, script_path)
    unified_vars.set_file_variable(KEY_DEBUG_SCRIPT_PATH, script_path)
```

**Debug flow** exits Python and returns to PowerShell, which executes the platform-specific debug script.

### Phase 4B: Build Mode (if action == "build")

**File**: `scripts/build_scripts/core/modern_build_system.py` (lines 146-167)

```python
def run(self) -> Dict[str, Any]:
    # 1. Initialize system
    if not self.initialize():
        return error_result

    # 2. Determine build mode
    if self.context.mode == BuildMode.PROJECT_COPY:
        result = self._execute_project_copy_mode()
    elif self.context.mode == BuildMode.TEMP_BUILD:
        result = self._execute_temp_build_mode()
```

**Build Mode Determination** (lines 169-179):
```python
def _determine_build_mode(self) -> BuildMode:
    self.dir_manager.print_status()

    if self.dir_manager.is_in_temp:
        # Running in temporary directory
        return BuildMode.TEMP_BUILD
    else:
        # Running in project directory
        return BuildMode.PROJECT_COPY
```

## Build System Pipeline (20 Steps)

### Step 1: Project Copy

**File**: `scripts/build_scripts/controllers/step1_project_copy_controller.py`
**Execution**: `modern_build_system.py` lines 221-277

```python
def _execute_phase_project_copy(self) -> StepResult:
    # 1. Get app name from unified variables
    app_name = unified_vars.get_file_variable(KEY_SELECTED_APP_NAME, "")

    # 2. Determine Flutter project root
    flutter_project_root = self._determine_flutter_project_root()

    # 3. Execute Step 1
    step1_result = self._execute_step('step1',
                                     flutter_project_root,
                                     app_name)

    # 4. Switch to temp directory
    target_dir = step1_result.data['target_directory']
    self._switch_to_temp_directory(target_dir)
```

**Purpose**:
- Copy entire Flutter project to temporary build directory
- Preserve original source code
- Enable isolated builds without affecting source

**Temporary Directory Pattern**:
```
~/.core_node/.flutter_build/.build_dir/compile_factory_{app_name}_{timestamp}/
```

### Step 2: Asset Controller

**File**: `scripts/build_scripts/controllers/step2_asset_controller.py`
**Execution**: `modern_build_system.py` line 295

```python
step2_result = self._execute_step('step2',
                                 self.context.temp_build_root,
                                 self.context.app_name)

selected_images = step2_result.data.get('selected_images', {})
```

**Purpose**:
- Scan and catalog app-specific assets
- Identify icon and splash screen resources
- Select appropriate image variants based on:
  - App configuration
  - Platform requirements
  - Resolution/density specifications

**Output**: `selected_images` dictionary containing paths to selected assets

### Step 3: Platform Controller (Scanning)

**File**: `scripts/build_scripts/controllers/step3_platform_controller.py`
**Execution**: `modern_build_system.py` line 302

```python
step3_result = self._execute_step('step3',
                                 self.context.temp_build_root,
                                 selected_images)
```

**Purpose**:
- Scan platform directories (android/, ios/, web/, windows/)
- Identify platform-specific image locations
- Catalog existing icons and splash screens
- Prepare platform image mapping

**Platform Directories Scanned**:
- Android: `android/app/src/main/res/mipmap-*`, `drawable-*`
- iOS: `ios/Runner/Assets.xcassets/`
- Web: `web/icons/`, `web/favicon.png`
- Windows: `windows/runner/resources/`

### Step 4: Image Replacement

**File**: `scripts/build_scripts/controllers/step4_image_replacement_controller.py`
**Execution**: `modern_build_system.py` line 307

```python
step4_result = self._execute_step('step4',
                                 self.context.temp_build_root,
                                 selected_images)
```

**Purpose**:
- Replace platform-specific app icons
- Update splash screens
- Generate multiple densities/resolutions
- Apply image optimization/compression

**Operations**:
1. Parse platform image specifications (from Step 3)
2. Process selected images (from Step 2)
3. Generate required sizes/densities:
   - Android: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi
   - iOS: 1x, 2x, 3x scales
   - Web: Various favicon sizes
4. Copy/replace images in platform directories

### Step 5: Multiplatform Replacement

**File**: `scripts/build_scripts/controllers/step5_multiplatform_controller.py`
**Execution**: `modern_build_system.py` line 312

```python
step5_result = self._execute_step('step5',
                                 self.context.temp_build_root,
                                 self.context.app_name)
```

**Purpose**:
- Apply cross-platform configuration updates
- Ensure consistency across platforms
- Handle platform-agnostic replacements

**Operations**:
- Update shared configuration files
- Apply app-specific branding
- Synchronize version numbers
- Configure common settings

### Step 6: (Reserved/Skipped)

**Not implemented in current version**

### Step 7: Android Configuration

**File**: `scripts/build_scripts/controllers/step7_android_config_controller.py`
**Execution**: `modern_build_system.py` line 317

```python
step7_result = self._execute_step('step7',
                                 self.context.temp_build_root,
                                 self.context.app_name)
```

**Purpose**:
- Configure Android-specific build settings
- Update AndroidManifest.xml
- Configure build.gradle files
- Set package name and version

**Files Modified**:
- `android/app/build.gradle` - Build configuration
- `android/app/src/main/AndroidManifest.xml` - App manifest
- `android/gradle.properties` - Gradle properties
- `android/local.properties` - Local SDK paths

**Key Configurations**:
- Application ID (package name)
- Version code and version name
- Minimum SDK version
- Target SDK version
- Compile SDK version
- Kotlin version

### Step 8: Pubspec Controller

**File**: `scripts/build_scripts/controllers/step8_pubspec_controller.py`
**Execution**: `modern_build_system.py` line 322

```python
step8_result = self._execute_step('step8',
                                 self.context.temp_build_root,
                                 self.context.app_name)
```

**Purpose**:
- Update pubspec.yaml with app-specific settings
- Configure asset paths
- Manage dependencies
- Set app metadata

**Modifications**:
- App name
- Description
- Version
- Asset declarations
- Font configurations
- Dependency versions

### Steps 9-18: (Reserved)

**Not implemented in current version** - Available for future extensions

### Step 19: View Effects Controller

**File**: `scripts/build_scripts/controllers/step19_view_effects_controller.py`
**Execution**: `modern_build_system.py` line 327

```python
step19_result = self._execute_step('step19',
                                  self.context.temp_build_root,
                                  self.context.app_name)
```

**Purpose**:
- Apply UI/UX enhancements
- Configure view-layer effects
- Optimize rendering settings

**Operations**:
- Material Design theme adjustments
- Animation configurations
- Visual effect parameters

### Step 20: Compilation Controller

**File**: `scripts/build_scripts/controllers/step20_compilation_controller.py`
**Execution**: `modern_build_system.py` line 332

```python
step20_result = self._execute_step('step20',
                                  self.context.temp_build_root,
                                  self.context.app_name)
```

**Purpose**:
- Generate Flutter compilation commands
- Prepare build variables
- Create PowerShell execution scripts
- Transfer control to external compilation trigger

**Key Operations** (lines 47-86):

1. **Get Compilation Option**:
```python
compilation_option = unified_vars.get_file_variable(KEY_COMPILATION_OPTION, 'debug')
# Options: analyze, clean, debug, profile, release, test
```

2. **Get Build Information**:
```python
build_info = {
    'app_name': app_name,
    'temp_build_root': temp_build_root,
    'build_platform': platform,  # android, ios, web, windows
    'build_mode': mode,          # debug, release, profile
    'build_timestamp': timestamp,
    'project_root': origin_dir,
    'working_dir': working_dir
}
```

3. **Generate Flutter Commands** (lines 118-161):
```python
def _generate_compilation_commands(self, compilation_option, build_info):
    platform = build_info['build_platform']
    mode = build_info['build_mode']

    if compilation_option == 'clean':
        command = 'flutter clean'

    elif compilation_option == 'debug':
        command = f'flutter build {platform} --debug'

    elif compilation_option == 'profile':
        command = f'flutter build {platform} --profile'

    elif compilation_option == 'release':
        command = self._get_optimized_release_command(platform)
        # Adds: --release --obfuscate --split-debug-info

    elif compilation_option == 'test':
        command = 'flutter test'

    # Add entry file from user selection
    entry_file = unified_vars.get_file_variable(KEY_SELECTED_ENTRY_FILE, '')
    if entry_file:
        command += f" --target={entry_file}"
```

4. **Platform-Specific Commands**:
```python
# Android
flutter build apk --release --target=lib/apps/app_vipclub/main_app_vipclub.dart

# iOS
flutter build ios --release --target=lib/apps/app_vipclub/main_app_vipclub.dart

# Web
flutter build web --release --target=lib/apps/app_vipclub/main_app_vipclub.dart

# Windows
flutter build windows --release --target=lib/apps/app_vipclub/main_app_vipclub.dart
```

5. **Write Compilation Variables**:
```python
# Saved to unified variable system for PowerShell access
unified_vars.set_file_variable('COMPILATION_COMMAND', command)
unified_vars.set_file_variable('OUTPUT_PATH', output_path)
unified_vars.set_file_variable('BUILD_ROOT', build_root)
```

**Transfer Message** (lines 337-342):
```
============================================================
BUILD SYSTEM COMPLETED - TRANSFERRING TO COMPILATION TRIGGER
============================================================
Build preparation completed successfully.
Compilation will be handled by external PowerShell trigger.
============================================================
```

## Phase 5: PowerShell Compilation Execution

**File**: `scripts/start.ps1` (lines 84-117)

```powershell
# Read action from Python
$selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION

# Route based on action
if ($selectedAction.ToLower() -eq "debug") {
    Invoke-DebugMode
}
elseif ($selectedAction.ToLower() -eq "build" -or
        $selectedAction.ToLower() -eq "release") {
    Invoke-BuildMode
}
```

**Invoke-BuildMode** (from BCommon.ps1 or FlutterBuildExecutor.ps1):
```powershell
function Invoke-BuildMode {
    # 1. Read compilation command from variables
    $compilationCommand = Get-FileVariable -Name "COMPILATION_COMMAND"

    # 2. Navigate to build directory
    $buildRoot = Get-FileVariable -Name "BUILD_ROOT"
    Set-Location $buildRoot

    # 3. Execute flutter clean (if needed)
    flutter clean

    # 4. Execute flutter pub get
    flutter pub get

    # 5. Execute main compilation command
    Invoke-Expression $compilationCommand

    # 6. Handle build artifacts
    Copy-BuildArtifacts
}
```

## Variable System

### Cross-Language Communication

**Python → PowerShell** via file-based variable system:

**Location**: `~/.core_node/.flutter_build/.cache/flutter_bloom/`

**Key Variables**:

| Variable Name | Set By | Read By | Purpose |
|--------------|--------|---------|---------|
| KEY_SELECTED_APP | FlutterLauncher | Step1, PowerShell | App name |
| KEY_SELECTED_ACTION | FlutterLauncher | PowerShell | debug/build/release |
| KEY_SELECTED_PLATFORM | FlutterLauncher | Step20 | android/ios/web/windows |
| KEY_SELECTED_ENTRY_FILE | FlutterLauncher | Step20 | main_app_xxx.dart |
| KEY_COMPILATION_OPTION | Step20 | PowerShell | clean/debug/profile/release/test |
| COMPILATION_COMMAND | Step20 | PowerShell | Full flutter build command |
| BUILD_ROOT | Step20 | PowerShell | Temp build directory path |
| OUTPUT_PATH | Step20 | PowerShell | Build artifact location |

**Implementation** (`shared/data_exchange/unified_variable_system.py`):
```python
class UnifiedVariableSystem:
    def set_file_variable(self, key: str, value: str):
        """Write variable to file for cross-process access"""
        var_file = self.gvar_exchange_dir / key
        var_file.write_text(str(value), encoding='utf-8')

    def get_file_variable(self, key: str, default: str = "") -> str:
        """Read variable from file"""
        var_file = self.gvar_exchange_dir / key
        if var_file.exists():
            return var_file.read_text(encoding='utf-8').strip()
        return default
```

## Build Artifacts

### Output Locations

**Android**:
```
build/app/outputs/flutter-apk/app-release.apk
build/app/outputs/bundle/release/app-release.aab
```

**iOS**:
```
build/ios/iphoneos/Runner.app
build/ios/archive/Runner.xcarchive
```

**Web**:
```
build/web/
  ├── index.html
  ├── main.dart.js
  ├── flutter_service_worker.js
  └── assets/
```

**Windows**:
```
build/windows/runner/Release/
  ├── app_name.exe
  ├── flutter_windows.dll
  └── data/
```

## Error Handling

### Build System Error Flow

```python
# modern_build_system.py lines 361-435
def _execute_step(self, step_key: str, *args) -> StepResult:
    step_start = datetime.now()

    try:
        # Execute step
        result = controller.execute(...)

        if result.get('success'):
            PrintHelper.success(f"{step_key} completed")
            return StepResult(step_key, True, result)
        else:
            error = result.get('error', 'Unknown error')
            PrintHelper.error(f"{step_key} failed: {error}")
            return StepResult(step_key, False, result, error)

    except Exception as e:
        error_msg = f"{step_key} exception: {e}"
        PrintHelper.error(error_msg)
        return StepResult(step_key, False, {}, error_msg)
```

**Error Propagation**:
1. Step failure → StepResult with success=False
2. StepResult checked in build system
3. Build system returns error result
4. Main.py exits with code 1
5. PowerShell detects failure and stops

## Performance Optimization

### Parallel Operations

**Current Implementation**: Sequential (synchronous execution)

**Optimization Opportunities**:
- Asset processing (Step 2) - Can parallelize image operations
- Platform scanning (Step 3) - Can scan platforms concurrently
- Image replacement (Step 4) - Can process platforms in parallel

### Caching Strategy

**Cache Locations**:
```
~/.core_node/.flutter_build/.cache/
  ├── flutter_bloom/           # Variable exchange
  ├── copy_flag_dir/           # Build flags
  └── image_compression_settings.txt
```

**Cached Data**:
- Selected images and compression modes
- Platform scan results
- Build configuration
- Previous build artifacts (for incremental builds)

## Summary Flow Diagram

```
START
  │
  ├─> [PowerShell Entry] start.ps1
  │     └─> Load modules, setup environment
  │
  ├─> [Python Orchestrator] main.py
  │     ├─> FlutterBloomLauncher.run()
  │     │     ├─> App selection (interactive menu)
  │     │     ├─> Action selection (debug/build)
  │     │     ├─> Platform selection
  │     │     └─> Save variables
  │     │
  │     └─> Route based on action
  │           ├─> Debug → Return to PowerShell → Platform debugger
  │           └─> Build → ModernFlutterBuildSystem.run()
  │
  ├─> [Build System] modern_build_system.py
  │     ├─> Determine mode (PROJECT_COPY or TEMP_BUILD)
  │     │
  │     ├─> Phase 1: Project Copy
  │     │     └─> Step 1: Copy to temp directory
  │     │
  │     ├─> Switch to temp directory
  │     │
  │     ├─> Phase 2-8: Asset & Platform Processing
  │     │     ├─> Step 2: Asset Controller
  │     │     ├─> Step 3: Platform Scanning
  │     │     ├─> Step 4: Image Replacement
  │     │     ├─> Step 5: Multiplatform
  │     │     ├─> Step 7: Android Config
  │     │     ├─> Step 8: Pubspec Controller
  │     │     ├─> Step 19: View Effects
  │     │     └─> Step 20: Compilation Preparation
  │     │           └─> Generate flutter build command
  │     │
  │     └─> Return success + variables
  │
  └─> [PowerShell Executor]
        ├─> Read compilation variables
        ├─> Navigate to build directory
        ├─> Execute: flutter clean (if needed)
        ├─> Execute: flutter pub get
        ├─> Execute: flutter build [platform] [options]
        └─> Copy build artifacts

END
```

---

**Last Updated**: 2025-11-02
**Based On**: Code analysis of Flutter Bloom build system v2.0
**Source Files Analyzed**:
- scripts/start.ps1
- scripts/build_scripts/main.py
- scripts/build_scripts/core/modern_build_system.py
- scripts/build_scripts/core/flutter_launcher.py
- scripts/build_scripts/controllers/*.py
