<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Flutter Multi-App Development Script System

## Overview
This document tracks the development of a comprehensive Flutter multi-app debug and build script system. The system allows for dynamic app switching, asset management, package ID customization, and automated build processes.

## Architecture Design

### Core Components
- **Entry Point**: `winStart.bat` -> `scripts/dev/startDevByWin.ps1`
- **Global Variables**: `scripts/dev/win_common/Gvar.ps1` 
- **Common Functions**: `scripts/dev/win_common/BCommon.ps1`
- **Helper Scripts**: `scripts/dev/py_helper/` and `scripts/dev/powershell_helper/`

### Directory Structure
```
$RootDir/
├── winStart.bat                           # Windows entry point
├── scripts/dev/                          # Development scripts directory ($DevScriptDir)
│   ├── startDevByWin.ps1                # Main PowerShell entry script
│   ├── build_option.ini                 # Build configuration per app
│   ├── original_config.ini              # Original app configuration backup
│   ├── win_common/                      # Windows common utilities
│   │   ├── Gvar.ps1                    # Global variables and constants
│   │   └── BCommon.ps1                 # Common PowerShell functions
│   ├── py_helper/                       # Python helper scripts
│   │   ├── gvar_common.py              # Python Gvar compatibility
│   │   ├── collect_package_ids.py      # b-1: Package ID collection
│   │   ├── replace_package_ids.py      # b-2: Package ID replacement  
│   │   ├── replace_app_names.py        # b-3: App name replacement
│   │   ├── process_images.py           # b-4: Image processing
│   │   ├── manage_pubspec.py           # b-5: Pubspec.yaml operations
│   │   └── cleanup_restore.py          # Cleanup and restore operations
│   └── powershell_helper/              # PowerShell helper scripts
│       ├── menu_system.ps1             # Interactive menu system
│       ├── backup_manager.ps1          # Backup and restore functions
│       └── build_executor.ps1          # Build execution functions
├── .build_dir/                         # External build directory ($BuildDir)
│   └── assets_{app-name}/              # App-specific external assets
└── poly_apps/flutter_bloom/
    ├── assets/.internal_{appname}/     # Internal app assets for platform replacement
    └── lib/apps/                       # Flutter apps directory
        ├── app_main/                   # Special app that can debug all apps
        └── app_{name}/                 # Individual Flutter apps
```
