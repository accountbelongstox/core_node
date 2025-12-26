# Flutter Bloom Build System Development Guide

> **Merged from**: `build_by_flutter.txt`, `bloom-flutterbuildv2.txt`, `bloom-flutterbuildv3.txt`, `flutter_bloombuild.txt`
> **Last Updated**: 2025-01-XX

## Table of Contents
1. [Menu System and File Variable Exchange](#menu-system-and-file-variable-exchange)
2. [Build Task Overview](#build-task-overview)
3. [Detailed Task Instructions](#detailed-task-instructions)
4. [Architecture Design](#architecture-design)
5. [Improvements and Optimizations](#improvements-and-optimizations)

---

## Menu System and File Variable Exchange

### Menu Interaction Flow

In `start.ps1`, call `get flutter apps` to get a dynamic apps table containing indexes, then print:

```
[INFO] Flutter Bloom App Selection
===================================

Available Flutter Apps:
- * 50
     0. app_main (Main Entry Point) [Debug/Android]
     1. app_achat [Debug/Android]
 ->  2. app_bank [Debug/Web]
     3. app_example [Debug/Android]
     4. app_wuy [Debug/Android]

Controls:
  Up/Down arrows: Navigate apps
  Left arrow: Toggle Debug/Build mode
  Right arrow: Toggle platform (Web/Android/Windows/All)
  Enter: Select app
```

### File Variable Exchange Mechanism

Store each APP's corresponding behavior and platform in real-time based on menu toggles. Note that each platform should be stored separately as file variables, but there is only one current APP.

**File Variable Locations**:
- `D:\programing\core_node\poly_apps\flutter_bloom\scripts\dev_debug\main.ps1` - Read file variables to determine which debug to run
- `startDebugByIOSweb` - Read file variables again, and call `get flutter apps` to get index mapping table, then derive entry file

**Key Variables**:
- `KEY_SELECTED_APP`: Selected APP name
- `KEY_SELECTED_ACTION`: Debug/Build mode
- `KEY_SELECTED_PLATFORM`: Web/Android/Windows/All
- `KEY_SELECTED_ENTRY_FILE`: Entry file path
- `KEY_APP_INDEX`: APP index
- `KEY_DEBUG_PORT`: Debug port

---

## Build Task Overview

### Task Background

The entire codebase needs to be refactored, but do not break existing debug logic, only modify compilation logic.

**Involved Directories**:
- `D:\programing\core_node\poly_apps\flutter_bloom\scripts\flutter_icons_view`
- `D:\programing\core_node\poly_apps\flutter_bloom\scripts\build_scripts`
- `D:\programing\core_node\poly_apps\flutter_bloom\scripts\flutter_icon_reduction`
- `D:\programing\core_node\poly_apps\flutter_bloom\scripts\dev`

**Development Progress Writeback**: `D:\programing\core_node\poly_apps\flutter_bloom\scripts\build_result.md`

### Build Flow

When calling compilation in `start.ps1`:
1. First read the compilation configuration file in the corresponding APP's subdirectory (e.g., `lib/apps/app_bank`)
2. Use file variable exchange to get the current sub-app to compile and the platform to compile
3. Begin preparing resource replacement

---

## Detailed Task Instructions

### Task 1: Sub-APP Compilation Configuration

**Objective**: Configure a compilation JSON for each sub-app

**Configuration Content**:
- App name (whether to generate randomly)
- appId/PackageId (whether to generate randomly)
- Whether to use external resource directory

**External Resource Directory Description**:
- Some apps have proprietary content (such as images) that should not be placed in code
- Code needs placeholder resources for debugging
- Actual compilation will call static resources from external directory (fallback to resources in code if not found)
- External resource directory: `D:\programing\.build_dir\build_apps_static_resources`

**Resource Specifications**:
- Each sub-app must have at least one icon file
- Small icon (notification icon file)
- Splash screen (optional)
- Background image (optional)
- **Note**: The above images are not placed in `pubspec.yaml`, they are replaced during compilation
- Other resources are defined by `pubspec.yaml`

**Documentation Update**: 
- Update specification `D:\programing\core_node\poly_apps\flutter_bloom\docs\DevSricptDebugBuild.md`

### Task 2: Secure Compilation Directory

**Objective**: Copy project to temporary directory for compilation security

**Process**:
1. Copy `D:\programing\core_node\poly_apps\flutter_bloom` to `D:\programing\.build_dir\compile_factory`
2. Rename flutter_bloom to `D:\programing\.build_dir\{app_name_to_compile}+{timestamp}`
3. Create common scripts, define compilation temporary directory and other variables
4. Switch working directory to the app directory to be compiled

**pubspec.yaml Configuration**:
- Comment out other apps' static directories (prevent resources from being packaged)
- Remove other sub-APP static directories (except common ones)
- **Note**: All of these are done in the temporary compilation directory

### Task 3: Static Resource Rules

Refer to specification `D:\programing\core_node\poly_apps\flutter_bloom\development-guides\FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md` to understand static resource placement rules for sub-APPs.

### Task 4: Resource Replacement

**Objective**: Replace compilation resources using icons defined by each sub-app

**Resource Types to Replace**:
- icon
- ic_icon
- notification icon
- Splash screen
- Background image

**Replacement Platforms**: `android`, `web`, `windows`, `macos`

**Replacement Principles**:
1. Prioritize external resources
2. Copy small icons (notification icon files), splash screens, and background images first (if not specified, report error but compilation continues, continue using original resources)
3. Copy resources specified in `pubspec.yaml`

**Important**: Do not infer replacements. To avoid errors:
1. First find images in `android/web/windows/macos` (these files are pre-written and will not be wrong)
2. After finding images, use sub-app's predefined resources to replace
3. This ensures common resources are replaced with sub-APP's required content

**Image Processing Rules**:
1. Create a map database containing recommended image types and sizes for each folder
2. After finding images from `android/web/windows/macos`, use the folder where the image is located to get recommended image size from the map
3. Based on the recommended size, process static images defined in sub-app:
   - Crop if too large
   - Stretch if too small
   - Create a dedicated library for processing
4. If map recommended size is not found, use the original image size directly
5. **Skip**: Skip 1px x 1px placeholder images

**Backup and Visualization**:
- Backup replaced images to temporary directory (with namespace folder names)
- Output an HTML file showing image path information
- Visually see which images were replaced and compare original vs replaced images

**APP Identifier Replacement**:
- After copying temporary directory, use utility class to generate random APP name and APP package name
- Use dedicated search function to replace IDs and app package names in `android/web/windows/macos`
- **Note**: Only replace when found according to rules, do not write based on assumptions, as writing may cause configuration file errors

### Task 5: Web Visualization

Use special utility class to listen on a web port and display all image information scanned from `android/web/windows/macos` to view final replacement results.

**Display Content**:
- APP name
- APP ID
- All image information

**Check**: Verify that path definitions in `D:\programing\core_node\poly_apps\flutter_bloom\scripts\flutter_icons_view` are correct

### Task 6: Compilation Confirmation and Completion

1. While opening web to view replacement information, the main compilation process command line prompts Y
2. After confirming a series of replacement information, enter Y to start compilation
3. After compilation completes, open apk or target directory using explorer

---

## Architecture Design

### Directory Structure

```
build_scripts/
├── core/
│   ├── assets/          # Asset processing engine
│   ├── config/          # Configuration management
│   ├── constants/       # Constant provider
│   ├── gvar/            # Global variables and file variable exchange
│   ├── identifiers/     # APP identifier management
│   ├── project/         # Project security management
│   ├── pubspec/         # pubspec.yaml processing
│   ├── resources/       # Resource finder
│   └── web/             # Web visualization service
├── processors/          # Processors
│   ├── assets/          # Asset processor
│   ├── config/          # Configuration processor
│   └── project/         # Project processor
├── utils/               # Utility classes
└── legacy/              # Legacy code (for reference)
```

### Architecture Components

1. **Constant Provider**: Provides constants such as fixed directories
2. **String Processing Class**: Python auxiliary, processes strings
3. **Image Processing Library**: Python, handles image cropping and stretching
4. **Search Utility Class**: Searches for IDs, etc.
5. **Replacement Result Display**: Web-Python, visualizes replacement results
6. **Compilation Script Execution**: PowerShell main process (avoid executing flutter commands in py)

### Main Entry

- **Only one main.py** and one web view main entry
- No other entries needed, all organized by ps1 files

---

## Improvements and Optimizations

### v3 Improvements

1. **Configuration File Simplification**:
   - Sub-app configuration files do not need to specify `external_assets_path` (fixed directory, provided by constant provider file)
   - `build_platforms` also does not need to be specified (can be selected in `start.ps1` script using file variable exchange)

2. **File Variable Exchange**:
   - All subsequent code must use file variable exchange for important tasks
   - Check code first to ensure correct usage

3. **Architecture Adjustment**:
   - Constant provider
   - String processing class (Python auxiliary)
   - Image processing library (Python)
   - Search utility class (for IDs, etc.)
   - Final replacement result display (Web-Python)
   - Final compilation script execution main process (PowerShell, avoid executing flutter commands in py)

### Second Step Process

After successful copy:
1. Python returns exit to `build_main.ps1`
2. ps1 prompts whether to compile, Y to start
3. `build_main.ps1` automatically switches working directory to temporary directory
4. Continue executing `main.py`

**main.py Detection Logic**:
- Can detect if in temporary directory based on factory directory
- If detected, skip copy and proceed directly to second step

**Second Step Work**:
1. Set up a library to collect relevant information in temporary directory
2. Collect all image information in `assets\apps\appname` and then print
3. Identify app icon based on collected information:
   - Get app's extension directory from `flutter_global_var.py`
   - Extension directory: `D:\programing\.build_dir\build_apps_static_resources` (constant)
   - Check if `{extension_directory}\appname\` directory exists
   - If exists, list extension directory and `assets\apps\appname` as resource search directories
   - Extension directory has higher priority than `assets\apps\appname` directory
4. Find icons:
   - Search for logo folders in icons subdirectory starting from extension directory in resource directories
   - After finding an array, sort by `png,jpg,.webp`
   - Print results, display as menu, default select first, press Y to continue

**Notes**:
- Reuse previous menu library
- Skip non-existent directories directly, no need to error, but print information
- All paths should print absolute addresses, do not print relative addresses

---

## Code Refactoring Notes

### Legacy Code Handling

- `legacy` contains old code, can be copied if needed
- But note to modify library names, do not reference directly

### Directory Tree Adjustment

- Make major adjustments to code in directory tree
- Modify file names and adjust file hierarchy
- If code is needed, copy from `legacy`, but rename

---

## Common Issues

### Issue 1: App '' not found in Flutter apps index mapping

**Cause**: `selectedApp` is empty in file variable exchange

**Solution**: Ensure `start.ps1` menu correctly uses file variable exchange and correctly sets `KEY_SELECTED_APP`

### Issue 2: Path Definition Error

**Solution**: Check if path definitions in `flutter_icons_view` are correct, use absolute paths

---

## Related Documents

- `D:\programing\core_node\poly_apps\flutter_bloom\development-guides\FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md`
- `D:\programing\core_node\poly_apps\flutter_bloom\docs\DevSricptDebugBuild.md`
- `D:\programing\core_node\poly_apps\flutter_bloom\scripts\build_result.md`

