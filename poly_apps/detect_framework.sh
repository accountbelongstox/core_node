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

# Poly Apps Framework Detector
# Detects framework type and generates appropriate startup commands

# Variable Declarations
APP_PATH="$1"
APP_NAME="$(basename "$APP_PATH")"

# Check if app path is provided
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
    echo "ERROR: Invalid app path provided"
    exit 1
fi

# Detection functions
detect_nuxt() {
    if [ -f "$APP_PATH/nuxt.config.ts" ] || [ -f "$APP_PATH/nuxt.config.js" ]; then
        return 0
    fi
    return 1
}

detect_laravel() {
    if [ -f "$APP_PATH/composer.json" ] && [ -f "$APP_PATH/public/index.php" ]; then
        return 0
    fi
    return 1
}

detect_flutter() {
    if [ -f "$APP_PATH/pubspec.yaml" ]; then
        return 0
    fi
    return 1
}

detect_react_native() {
    if [ -f "$APP_PATH/package.json" ] && ([ -d "$APP_PATH/android" ] || [ -d "$APP_PATH/ios" ]); then
        if grep -q "react-native" "$APP_PATH/package.json" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

detect_vue() {
    if [ -f "$APP_PATH/package.json" ]; then
        if [ -f "$APP_PATH/vue.config.js" ] || [ -f "$APP_PATH/vite.config.js" ] || grep -q "vue" "$APP_PATH/package.json" 2>/dev/null; then
            # Exclude if it's Nuxt (Nuxt uses Vue but has different commands)
            if ! grep -q "nuxt" "$APP_PATH/package.json" 2>/dev/null; then
                return 0
            fi
        fi
    fi
    return 1
}

detect_react() {
    if [ -f "$APP_PATH/package.json" ] && grep -q "react" "$APP_PATH/package.json" 2>/dev/null; then
        # Exclude React Native and Nuxt
        if ! grep -q "react-native" "$APP_PATH/package.json" 2>/dev/null && ! grep -q "nuxt" "$APP_PATH/package.json" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

detect_kotlin_multiplatform() {
    if [ -f "$APP_PATH/build.gradle.kts" ] || [ -f "$APP_PATH/build.gradle" ]; then
        if ([ -f "$APP_PATH/build.gradle.kts" ] && grep -q "kotlin.*multiplatform" "$APP_PATH/build.gradle.kts" 2>/dev/null) ||
           ([ -f "$APP_PATH/build.gradle" ] && grep -q "kotlin.*multiplatform" "$APP_PATH/build.gradle" 2>/dev/null); then
            return 0
        fi
    fi
    return 1
}

detect_php() {
    if [ -f "$APP_PATH/index.php" ] && [ ! -f "$APP_PATH/composer.json" ]; then
        return 0
    fi
    return 1
}

detect_python() {
    if [ -f "$APP_PATH/main.py" ]; then
        return 0
    fi
    return 1
}

# Detection priority order (first match wins)
if detect_nuxt; then
    echo "nuxt"
elif detect_laravel; then
    echo "laravel"
elif detect_flutter; then
    echo "flutter"
elif detect_react_native; then
    echo "react-native"
elif detect_vue; then
    echo "vue"
elif detect_react; then
    echo "react"
elif detect_kotlin_multiplatform; then
    echo "kotlin-multiplatform"
elif detect_php; then
    echo "php"
elif detect_python; then
    echo "python"
else
    echo "unknown"
fi