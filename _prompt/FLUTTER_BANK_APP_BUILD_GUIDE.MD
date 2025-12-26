# Flutter Bank App Build Guide

## Overview

This document describes the build process for Flutter Bloom apps, specifically focusing on the bank app build workflow.

## Build Menu System

When calling compilation from `poly_apps/flutter_bloom/scripts/start.ps1`, the system:

1. First reads the compilation configuration file in the corresponding APP's subdirectory (e.g., `poly_apps/flutter_bloom/lib/apps/app_bank`)
2. Uses file variable exchange to get the current sub-app to compile and the platform to compile
3. Begins preparing resource replacement

## Refactoring Tasks

The entire codebase needs to be refactored, but do not break existing debug logic, only modify compilation logic.

**Involved Directories**:
- `poly_apps/flutter_bloom/scripts/flutter_icons_view`
- `poly_apps/flutter_bloom/scripts/build_scripts`
- `poly_apps/flutter_bloom/scripts/flutter_icon_reduction`
- `poly_apps/flutter_bloom/scripts/dev`

**Development Progress Writeback**: `poly_apps/flutter_bloom/scripts/build_result.md`

## Task 1: Sub-APP Compilation Configuration

Each sub-app needs a compilation JSON configuration containing:
- App name (whether to generate randomly)
- appId/PackageId (whether to generate randomly)
- Whether to use external resource directory

Update specification: `poly_apps/flutter_bloom/docs/DevSricptDebugBuild.md`

## Task 2: Secure Compilation Directory

Copy `poly_apps/flutter_bloom` to build temporary directory (e.g., `~/.build_dir/compile_factory`), rename to `~/.build_dir/{app_name_to_compile}+{timestamp}` (or use project-relative build directory).

Create common scripts, define compilation temporary directory and other variables, then switch working directory to the app directory to be compiled.

## Task 3: Static Resource Rules

Refer to specification `poly_apps/flutter_bloom/development-guides/FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md` to understand static resource placement rules for sub-APPs.

## Task 4: Resource Replacement

Use each sub-app's defined icons (icon, ic_icon, notification icon, splash screen, background image) to replace compilation resources in `android`, `web`, `windows`, `macos`.

**Replacement Principles**:
- Prioritize external resources
- First copy small icons, splash screens, background images
- Then copy resources specified in `pubspec.yaml`
- Do not infer replacements - first find images in target directories, then replace with sub-app's predefined resources

**Image Processing**:
- Create a map database with recommended image types and sizes for each folder
- Scale images proportionally based on target size
- Skip 1px x 1px placeholder images
- Backup replaced images to temporary directory
- Output HTML showing replacement information

## Task 5: Web Visualization

Use special utility class to listen on a web port and display all image information scanned from `android/web/windows/macos` to view final replacement results.

Check: `poly_apps/flutter_bloom/scripts/flutter_icons_view` for path definitions.

## Task 6: Compilation Confirmation

While opening web to view replacement information, the main compilation process command line prompts Y. After confirming replacement information, enter Y to start compilation. After compilation completes, open apk or target directory using explorer.

