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

# Framework Detection Module
# Provides framework detection functions for unified manager

# Generate pyStart command (for general Python apps with main.py)
get_py_start_command() {
    local app_path="$1"
    local main_py="$app_path/main.py"

    if [ -f "$main_py" ]; then
        echo "python \"$main_py\""
    fi
}

# Generate pycoreStart command (for pycore apps using pymain.py launcher)
get_pycore_start_command() {
    local app_path="$1"
    local app_name="$(basename "$app_path")"
    local pymain="$ROOT_DIR/pymain.py"
    local main_py="$app_path/main.py"
    local app_main_py="$app_path/${app_name}_main.py"

    # Check if app has main.py or {appname}_main.py
    if [ -f "$main_py" ] || [ -f "$app_main_py" ]; then
        if [ -f "$pymain" ]; then
            echo "python \"$pymain\" app=$app_name"
        fi
    fi
}

# Generate ncoreStart command
get_ncore_start_command() {
    local app_path="$1"
    local main_js="$app_path/main.js"

    if [ -f "$main_js" ]; then
        local app_name="$(basename "$app_path")"
        local root_main_js="$ROOT_DIR/main.js"
        echo "node \"$root_main_js\" app=$app_name"
    fi
}

# Generate flutterStart command
get_flutter_start_command() {
    local app_path="$1"
    local pubspec="$app_path/pubspec.yaml"

    if [ -f "$pubspec" ]; then
        echo "cd \"$app_path\" && flutter run"
    fi
}

# Generate laravelStart command
get_laravel_start_command() {
    local app_path="$1"
    local composer="$app_path/composer.json"
    local public_index="$app_path/public/index.php"

    if [ -f "$composer" ] && [ -f "$public_index" ]; then
        echo "cd \"$app_path\" && php artisan serve"
    fi
}

# Generate nuxtStart command
get_nuxt_start_command() {
    local app_path="$1"
    local nuxt_config="$app_path/nuxt.config.ts"
    local nuxt_config_js="$app_path/nuxt.config.js"

    if [ -f "$nuxt_config" ] || [ -f "$nuxt_config_js" ]; then
        echo "cd \"$app_path\" && pnpm run dev"
    fi
}

# Generate React Native start command
get_react_native_start_command() {
    local app_path="$1"
    local package_json="$app_path/package.json"
    local android_dir="$app_path/android"
    local ios_dir="$app_path/ios"

    if [ -f "$package_json" ] && ([ -d "$android_dir" ] || [ -d "$ios_dir" ]); then
        # Check if it's React Native by looking in package.json
        if grep -q "react-native" "$package_json" 2>/dev/null; then
            echo "cd \"$app_path\" && pnpm run android"
        fi
    fi
}

# Generate Vue.js start command
get_vue_start_command() {
    local app_path="$1"
    local package_json="$app_path/package.json"
    local vue_config="$app_path/vue.config.js"
    local vite_config="$app_path/vite.config.js"

    if [ -f "$package_json" ] && ([ -f "$vue_config" ] || [ -f "$vite_config" ] || grep -q "vue" "$package_json" 2>/dev/null); then
        # Don't detect Vue if it's Nuxt (Nuxt uses Vue but has different commands)
        if ! grep -q "nuxt" "$package_json" 2>/dev/null; then
            echo "cd \"$app_path\" && pnpm run dev"
        fi
    fi
}

# Generate React start command
get_react_start_command() {
    local app_path="$1"
    local package_json="$app_path/package.json"

    if [ -f "$package_json" ] && grep -q "react" "$package_json" 2>/dev/null; then
        # Exclude React Native and Nuxt
        if ! grep -q "react-native" "$package_json" 2>/dev/null && ! grep -q "nuxt" "$package_json" 2>/dev/null; then
            echo "cd \"$app_path\" && pnpm start"
        fi
    fi
}

# Generate Kotlin Multiplatform start command
get_kotlin_multiplatform_start_command() {
    local app_path="$1"
    local build_gradle="$app_path/build.gradle.kts"
    local build_gradle_groovy="$app_path/build.gradle"

    if [ -f "$build_gradle" ] || [ -f "$build_gradle_groovy" ]; then
        # Check if it contains kotlin multiplatform
        if ([ -f "$build_gradle" ] && grep -q "kotlin.*multiplatform" "$build_gradle" 2>/dev/null) ||
           ([ -f "$build_gradle_groovy" ] && grep -q "kotlin.*multiplatform" "$build_gradle_groovy" 2>/dev/null); then
            echo "cd \"$app_path\" && ./gradlew run"
        fi
    fi
}

# Generate phpStart command
get_php_start_command() {
    local app_path="$1"
    local index_php="$app_path/index.php"

    if [ -f "$index_php" ]; then
        echo "php -S localhost:8000 -t \"$app_path\""
    fi
}

# Generate Ncore/Pycore/Installer command (unified installer for both ncore and pycore)
get_unified_installer_command() {
    local app_path="$1"
    local app_type="$2"

    if [ "$app_type" = "ncoreApp" ]; then
        get_ncore_start_command "$app_path"
    elif [ "$app_type" = "pycoreApp" ]; then
        get_pycore_start_command "$app_path"
    fi
}

# Check native startup files
check_native_files() {
    local app_path="$1"
    local has_main_py=0
    local has_main_js=0
    local has_pubspec=0
    local has_composer=0
    local has_nuxt_config=0
    local has_index_php=0
    local has_package_json=0
    local has_gradle=0

    [ -f "$app_path/main.py" ] && has_main_py=1
    [ -f "$app_path/main.js" ] && has_main_js=1
    [ -f "$app_path/pubspec.yaml" ] && has_pubspec=1
    [ -f "$app_path/composer.json" ] && has_composer=1
    [ -f "$app_path/nuxt.config.ts" ] || [ -f "$app_path/nuxt.config.js" ] && has_nuxt_config=1
    [ -f "$app_path/index.php" ] && has_index_php=1
    [ -f "$app_path/package.json" ] && has_package_json=1
    [ -f "$app_path/build.gradle.kts" ] || [ -f "$app_path/build.gradle" ] && has_gradle=1

    echo "$has_main_py $has_main_js $has_pubspec $has_composer $has_nuxt_config $has_index_php $has_package_json $has_gradle"
}