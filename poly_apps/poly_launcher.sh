#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Unified Poly Apps Launcher
# Unified entry point for all poly_apps with automatic framework detection

# Variable Declarations
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_NAME="$1"
ACTION="${2:-start}"

# Check if app name is provided
if [ -z "$APP_NAME" ]; then
    echo "Usage: $0 <app_name> [action]"
    echo "Available actions: start, install, dev, build, clean"
    echo ""
    echo "Available apps:"
    for dir in "$SCRIPT_PATH"/*; do
        if [ -d "$dir" ] && [ "$(basename "$dir")" != "scripts" ]; then
            echo "  - $(basename "$dir")"
        fi
    done
    exit 1
fi

APP_PATH="$SCRIPT_PATH/$APP_NAME"

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: App '$APP_NAME' not found at: $APP_PATH"
    echo ""
    echo "Available apps:"
    for dir in "$SCRIPT_PATH"/*; do
        if [ -d "$dir" ] && [ "$(basename "$dir")" != "scripts" ]; then
            echo "  - $(basename "$dir")"
        fi
    done
    exit 1
fi

# Detect framework
DETECTOR_SCRIPT="$SCRIPT_PATH/detect_framework.sh"
if [ ! -f "$DETECTOR_SCRIPT" ]; then
    echo "ERROR: Framework detector script not found: $DETECTOR_SCRIPT"
    exit 1
fi

FRAMEWORK=$(bash "$DETECTOR_SCRIPT" "$APP_PATH")

echo "=== Poly Apps Unified Launcher ==="
echo "App Name: $APP_NAME"
echo "App Path: $APP_PATH"
echo "Framework: $FRAMEWORK"
echo "Action: $ACTION"
echo ""

# Framework-specific script mapping
FRAMEWORK_SCRIPT=""
UNIFIED_MANAGER_LAUNCHERS="$SCRIPT_PATH/../scripts/unified_manager/launchers"
case "$FRAMEWORK" in
    "nuxt")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/nuxt_launcher.sh"
        ;;
    "laravel")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/laravel_launcher.sh"
        ;;
    "flutter")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/flutter_launcher.sh"
        ;;
    "react-native")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/react_native_launcher.sh"
        ;;
    "vue")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/vue_launcher.sh"
        ;;
    "react")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/react_launcher.sh"
        ;;
    "kotlin-multiplatform")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/kotlin_multiplatform_launcher.sh"
        ;;
    "php")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/php_launcher.sh"
        ;;
    "python")
        FRAMEWORK_SCRIPT="$UNIFIED_MANAGER_LAUNCHERS/python_launcher.sh"
        ;;
    "unknown")
        echo "WARNING: Framework not detected for app '$APP_NAME'"
        echo ""
        echo "Please ensure your project has one of the following:"
        echo "  - nuxt.config.ts/js (Nuxt.js)"
        echo "  - composer.json + public/index.php (Laravel)"
        echo "  - pubspec.yaml (Flutter)"
        echo "  - package.json + android/ios dirs + react-native dependency (React Native)"
        echo "  - package.json + vue dependency (Vue.js)"
        echo "  - package.json + react dependency (React)"
        echo "  - build.gradle(.kts) + kotlin multiplatform (Kotlin Multiplatform)"
        echo "  - index.php (PHP)"
        echo "  - main.py (Python)"
        echo ""
        exit 1
        ;;
    *)
        echo "ERROR: Unknown framework detected: $FRAMEWORK"
        exit 1
        ;;
esac

# Check if framework script exists
if [ ! -f "$FRAMEWORK_SCRIPT" ]; then
    echo "ERROR: Framework script not found: $FRAMEWORK_SCRIPT"
    echo "Please create the framework-specific launcher script."
    exit 1
fi

# Execute framework-specific script
echo "Launching with framework-specific script: $FRAMEWORK_SCRIPT"
echo ""
bash "$FRAMEWORK_SCRIPT" "$APP_PATH" "$APP_NAME" "$ACTION"