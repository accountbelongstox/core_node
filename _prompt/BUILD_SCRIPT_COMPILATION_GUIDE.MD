# Build Script Compilation Guide

## Overview

This document describes the build script system for Capacitor-based projects, including automatic project detection, configuration management, and Android build processes.

## Main Menu

The script `poly_apps\cmg-corporate-portal\scripts\start.ps1` automatically detects the project and prompts Y/n for confirmation or manual selection, then displays the main menu:

1. Install Capacitor (automatically backup package.json once, skip if backup exists)
2. Development Server (debug)
3. Build for Web
4. Build for Android

## Build Process

When building, the script:
- Automatically reads `poly_apps\cmg-corporate-portal\build_config.ini` from the project directory
- Automatically processes and replaces content to `android/` directory
- **Recursive scanning**: Automatically scans recursively, not directly specifying file names
- **Image replacement**: When replacing images, automatically scale source images proportionally based on target image size
- **App name replacement**: Finds all possible locations to replace app names
- **Fallback logic**: If not specified in `build_config.ini`, automatically finds `logo.png` and `splash.png` in `poly_apps\cmg-corporate-portal\assets` as app icon and splash screen
- If images are not found, prompt but continue compilation

## Key Improvements

### 1. Automatic Project Type Detection
- Automatically identifies React, Vue, Vite, Next.js, Nuxt.js
- Displays detection results and provides Y/n confirmation option

### 2. New Interactive Main Menu
1. Install Capacitor (automatically backup package.json)
2. Development Server (debug)
3. Build for Web
4. Build for Android
Q. Quit

### 3. build_config.ini Parser
- Automatically reads and parses INI configuration file
- Supports all configuration sections: [app_info], [package_settings], [resources], etc.

### 4. Intelligent File Replacement System
- **Recursive scanning**: Automatically scans all related files in android/ directory (.xml, .gradle, .kt, .java, .json, .properties)
- **App name replacement**: Replaces application name and package name in all possible locations
- **No hardcoded filenames**: Automatically discovers files that need modification through recursive search

### 5. Image Processing Features
- **Proportional scaling**: Automatically scales source images proportionally based on target image dimensions
- **Centering**: Scaled images are automatically centered
- **High-quality rendering**: Uses HighQualityBicubic interpolation algorithm
- **Recursive target image search**: Automatically finds all ic_launcher*.png and splash*.png files

### 6. Image Resource Fallback Logic

Priority order:
1. Path specified in build_config.ini
2. assets/logo.png and assets/splash.png
3. If neither exists, display warning but continue compilation

### 7. package.json Automatic Backup
- Automatically backup when installing Capacitor for the first time
- Skip if backup already exists to avoid duplicate backups

## Core Functionality

### Install Capacitor (Option 1)
1. Automatically backup package.json (if no backup exists)
2. Install Capacitor core package and Android/iOS platforms
3. Initialize Capacitor configuration
4. Add Android platform

### Build for Android (Option 4)

Execution flow:
1. Check if Android platform is installed
2. Parse build_config.ini configuration
3. Prepare replacement mapping (app name, package name)
4. Find icons and splash screens (by priority)
5. Recursive replacement: Scan all Android files and replace text
6. Proportionally scale and replace icons: Automatically find all target icon files
7. Proportionally scale and replace splash screens: Automatically find all splash screen files
8. Build Web resources
9. Sync Capacitor
10. Build Android APK (Debug version)

## Usage Instructions

Run script:
```powershell
cd poly_apps/cmg-corporate-portal/scripts
.\start.ps1
```

The script will:
1. Display detected project type (React + Vite)
2. Ask if detection result should be used (default Y)
3. Display main menu for operation selection

## Configuration File

Ensure `build_config.ini` contains necessary configuration:
- app_name: Internal application name
- display_name_chinese/english: Display names
- default_package_id: Application package name (e.g., com.ddsj.cmg.club)
- icon_file/splash_screen_file: Icon and splash screen paths (optional)

All variables are declared at the beginning of the script, following PowerShell best practices, and use absolute paths instead of relative paths.

## Initialization

Before initialization, first initialize `build_config.ini`:
- If it exists, read and use valid items
- If it doesn't exist, automatically create one
- At minimum, have `poly_apps\cmg-corporate-portal\build_config.ini`
- Currently necessary information: app_name automatically generated as `app_{folder_name}`

## Script Architecture

**Note**: `start.ps1` and `start.sh` are only entry scripts, differences handled by Python, following these specifications:

1. **File Variable Exchange**: Python and shell use file variables to exchange variables, cannot directly pass parameters. File variables all have prefixes (to prevent variable confusion when other APPs use this script for compilation).

2. **Python Processing**: Python does not execute any shell commands. Instead, it processes differences and saves to file variables.

3. **Shell Execution**: After Python preprocessing, shell reads file variables to get final commands to run. All pnpm/compilation files are completed in shell. Windows/Linux respectively need to complete scripts that read file variables and organize commands with differences.

## Web Preview Service

Python implements a temporary HTTP web service. After replacing resources, Y/n to start a web server. Display information about all images in replaced Android, show images in web interface, full paths, and display in groups. Also display all package names (scanned from all matched files) and all app names. Use current code to modify and complete. Then press Y or exit the thread in web interface to continue compilation.

## Additional Requirements

- **App Names Display**: Recursive search after replacement, find files that may not have been replaced, using regex.

- **Language Handling**: Check `build_config.ini`, if a language is set, process accordingly. Call MCP to view official documentation, preset extension programs in Python.

- **strings.xml Processing**: Check `build_config.ini`, if a language is set, process accordingly. This creation should be automatically created by Python according to specifications, or if Capacitor supports preprocessing, should also preprocess, and automatically extend according to extended languages in `build_config.ini`.

- **No Exit Codes**: All code should not use exit codes or return value detection, only use file variable exchange. All variables stored in user home directory (Windows: `~/.core_node/.build_global_vars`, Linux: `/var/_core_node/_build_global_vars/`)

- **Version Alignment**: Check Python preprocessing script, check which package versions are not aligned. Call MCP to view current version information. View official documentation.

- **Capacitor Reset**: Check CapacitorJS official documentation for option to initialize latest Android. In `.\poly_apps\cmg-corporate-portal\scripts\start.ps1` option 1 "Install Capacitor (with automatic backup)", if already installed, prompt to reset y/N.

- **Status Bar and Safe Area**: Check CapacitorJS official documentation for Android status bar and safe area handling. In Python preprocessing compilation script, ensure configuration. Need to add code in preprocessing compilation py to ensure configuration, not directly modify files.

## Code Standards

- All code in English
- Do not write patch scripts, but automatically solve these problems from `.\poly_apps\cmg-corporate-portal\scripts\start.ps1`
- No longer prompt that defend prompt
- If all commands are fixed, it won't run to Users directory anymore. Check again.

## Version Management

- Use MCP to find all package and Capacitor, Gradle, and Java correspondences
- Find conflicts and unified configuration according to latest version
- Find call chain in script, upgrade all to latest
- Generate necessary Java environment (will be written by another AI upgrade script)
- Current preprocessing replacement uses Python, Python should not execute any command lines. Pass files back to shell for execution
- Note latest @capacitor/core 8.0.0 is already 8.0, do not specify version, but install latest version by pnpm
- Finally generate Java version requirements, and automatically use Python in preprocessing of this compilation script to process Gradle requirements
- All call MCP to verify latest version numbers
- Set a main version core, when main version does not exist or is below this value, all packages are reinstalled and added

## Capacitor Status Bar Configuration

According to CapacitorJS official recommendations:
1. AndroidManifest.xml - Add system window adaptation
2. index.html - Add Safe Area CSS classes
3. App.tsx - StatusBar initialization and style adjustments

These changes ensure:
- On Android devices, top elements are not blocked by status bar and battery icon
- Use official recommended methods to handle safe areas
- Compatible with different Android devices (including devices with notches)
- Also works normally in browsers (use minimum 24px spacing when safe-area is 0)

Write a complete compilation prompt, prompt all places that need attention before compilation, let frontend AI modify.

