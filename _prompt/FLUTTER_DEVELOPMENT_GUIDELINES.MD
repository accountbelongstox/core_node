# Flutter Development Guidelines

## Overview

Read this project's development specifications:
- `D:\programing\core_node\DEVELOPMENT_GUIDE_THIS_FILE_NO_AI_EDIT.md`
- `D:\programing\core_node\poly_apps\flutter_bloom\development-guides\FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md`

## Tasks

### 1. Fix Provider App Example

View Poly Flutter's example app. Fix `provider_app_example.dart`.

### 2. Unified App Manager Integration

From `D:\programing\core_node\scripts\unified_manager`, started from `dd.sh`'s **Unified App Manager**:

When [deploy], write current `start` same as `deploy`, will also call service add, update, start, restart, add app to system service. Also have menus to view service, restart service, etc.

### 3. Deploy Script Integration

Copy `D:\programing\core_node\poly_apps\laravel_main\scripts\deploy.sh` to `start.sh`, make `start.sh` have all functions of `deploy`.

### 4. Update Development Guidelines

Analyze latest code:
- `D:\programing\core_node\scripts\unified_manager\PROJECT_UNIFIED_MANAGEMENT_ANALYSIS.md`
- `D:\programing\core_node\scripts\unified_manager\README.md`

Update old specifications and create new specification:
`/www/wwwroot/core_node/scripts/unified_manager/UNIFIED_MANAGER_DEVELOPMENT_GUIDELINES.md`

Also merge `WINDOWS_SCRIPT_EXECUTION_FIX.md` into it.

**Windows and Linux Unique Solution**:
- Windows background execution: Use explorer to execute new startup corresponding script
- Linux: Use background service

**Note**: What is updated here is architecture development specifications. Do not add usage guides, code examples, and other logic. The most important thing is to explain the logical meaning of the framework and required technical implementation specifications.

