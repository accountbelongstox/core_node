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

# Framework Detection Module (Refactored)
# Uses core library for framework detection and command generation

# Source core library
source "$(dirname "${BASH_SOURCE[0]}")/../lib/core_lib.sh"

# Generate framework-specific startup commands using core library
get_startup_command() {
    local app_path="$1"
    local framework_type="$2"
    local app_name="$(basename "$app_path")"

    case "$framework_type" in
        "pyStart")
            echo "python \"$app_path/main.py\""
            ;;
        "Ncore/Pycore/Installer")
            if [[ -f "$ROOT_DIR/pymain.py" ]]; then
                echo "python \"$ROOT_DIR/pymain.py\" app=$app_name"
            elif [[ -f "$ROOT_DIR/main.js" ]]; then
                echo "node \"$ROOT_DIR/main.js\" app=$app_name"
            fi
            ;;
        "flutterStart")
            echo "cd \"$app_path\" && flutter run"
            ;;
        "laravelStart")
            echo "cd \"$app_path\" && php artisan serve"
            ;;
        "nuxtStart")
            echo "cd \"$app_path\" && pnpm run dev"
            ;;
        "reactNativeStart")
            echo "cd \"$app_path\" && pnpm run android"
            ;;
        "vueStart"|"reactStart")
            if grep -q '"start"' "$app_path/package.json" 2>/dev/null; then
                echo "cd \"$app_path\" && pnpm start"
            elif grep -q '"dev"' "$app_path/package.json" 2>/dev/null; then
                echo "cd \"$app_path\" && pnpm run dev"
            else
                echo "cd \"$app_path\" && pnpm start"
            fi
            ;;
        "kotlinMultiPlatformStart")
            echo "cd \"$app_path\" && ./gradlew run"
            ;;
        "phpStart")
            echo "php -S localhost:8000 -t \"$app_path\""
            ;;
        *)
            echo ""
            ;;
    esac
}

# Check for framework indicators (refactored using core library patterns)
check_framework_indicators() {
    local app_path="$1"

    # Use core library framework detection
    local detected_framework=$(detect_framework_type "$app_path")

    # Return indicators for compatibility with existing code
    local has_main_py=0
    local has_main_js=0
    local has_pubspec=0
    local has_composer=0
    local has_nuxt_config=0
    local has_index_php=0
    local has_package_json=0
    local has_gradle=0

    [[ -f "$app_path/main.py" ]] && has_main_py=1
    [[ -f "$app_path/main.js" ]] && has_main_js=1
    [[ -f "$app_path/pubspec.yaml" ]] && has_pubspec=1
    [[ -f "$app_path/composer.json" ]] && has_composer=1
    ([[ -f "$app_path/nuxt.config.ts" ]] || [[ -f "$app_path/nuxt.config.js" ]]) && has_nuxt_config=1
    [[ -f "$app_path/index.php" ]] && has_index_php=1
    [[ -f "$app_path/package.json" ]] && has_package_json=1
    ([[ -f "$app_path/build.gradle.kts" ]] || [[ -f "$app_path/build.gradle" ]]) && has_gradle=1

    echo "$has_main_py $has_main_js $has_pubspec $has_composer $has_nuxt_config $has_index_php $has_package_json $has_gradle"
}

# Legacy function wrappers for backward compatibility
get_py_start_command() {
    get_startup_command "$1" "pyStart"
}

get_pycore_start_command() {
    get_startup_command "$1" "Ncore/Pycore/Installer"
}

get_ncore_start_command() {
    get_startup_command "$1" "Ncore/Pycore/Installer"
}

get_flutter_start_command() {
    get_startup_command "$1" "flutterStart"
}

get_laravel_start_command() {
    get_startup_command "$1" "laravelStart"
}

get_nuxt_start_command() {
    get_startup_command "$1" "nuxtStart"
}

get_react_native_start_command() {
    get_startup_command "$1" "reactNativeStart"
}

get_vue_start_command() {
    get_startup_command "$1" "vueStart"
}

get_react_start_command() {
    get_startup_command "$1" "reactStart"
}

get_kotlin_multiplatform_start_command() {
    get_startup_command "$1" "kotlinMultiPlatformStart"
}

get_php_start_command() {
    get_startup_command "$1" "phpStart"
}

get_unified_installer_command() {
    local app_path="$1"
    local app_type="$2"
    get_startup_command "$app_path" "Ncore/Pycore/Installer"
}

# Legacy function for backward compatibility
check_native_files() {
    check_framework_indicators "$1"
}