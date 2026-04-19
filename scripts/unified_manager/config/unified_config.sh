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

# Central configuration hub: exports here are intentional for modules that source this file.
# Ordinary feature scripts should use local assignments and must not re-export project constants.

# Central Configuration for Unified App Manager
# This file contains all configuration constants and shared settings

# Version and metadata
export UNIFIED_MANAGER_VERSION="16.1.0"
export UNIFIED_MANAGER_NAME="dd.sh Unified App Manager"

# Base paths (will be set by main script)
export SCRIPT_PATH=""
export ROOT_DIR=""
export NCORE_APPS=""
export PYCORE_APPS=""
export POLY_APPS=""
export CACHE_DIR=""
export CACHE_FILE=""
export TEMP_SCRIPT_DIR=""

# Port allocation configuration
PORT_BASE=10000
PORT_RANGE=5000
PORT_AUTO_INCREMENT=true

# Service configuration
export SERVICE_USER="root"
export SERVICE_RESTART_POLICY="always"
export SERVICE_RESTART_SEC="5"
export SERVICE_CPU_LIMIT="50%"
export SERVICE_MEMORY_LIMIT="1G"

# Framework detection patterns
export FRAMEWORK_PATTERNS_REACT="package.json react"
export FRAMEWORK_PATTERNS_VUE="package.json vue"
export FRAMEWORK_PATTERNS_NUXT="nuxt.config.ts nuxt.config.js"
export FRAMEWORK_PATTERNS_LARAVEL="composer.json public/index.php"
export FRAMEWORK_PATTERNS_FLUTTER="pubspec.yaml"
export FRAMEWORK_PATTERNS_REACT_NATIVE="package.json android ios"
export FRAMEWORK_PATTERNS_KOTLIN="build.gradle.kts build.gradle"
export FRAMEWORK_PATTERNS_PHP="index.php"
export FRAMEWORK_PATTERNS_PYTHON="main.py"

# Script scanning configuration
export SCRIPT_FILES_TO_SCAN=("start.sh" "install.sh" "deploy.sh")

# Native startup types in priority order
export NATIVE_STARTUPS=(
    "Ncore/Pycore/Installer"
    "reactStart"
    "vueStart"
    "nuxtStart"
    "laravelStart"
    "flutterStart"
    "reactNativeStart"
    "kotlinMultiPlatformStart"
    "phpStart"
    "pyStart"
    "polyLauncher"
)

# Service naming patterns
export SERVICE_NAME_REACT="webapp"
export SERVICE_NAME_VUE="webapp"
export SERVICE_NAME_NUXT="nuxt"
export SERVICE_NAME_LARAVEL="laravel"
export SERVICE_NAME_FLUTTER="flutter"
export SERVICE_NAME_PHP="php"
export SERVICE_NAME_PYTHON="python"
export SERVICE_NAME_KOTLIN="kotlin"
export SERVICE_NAME_GENERIC="app"

# Debug mode detection patterns
export DEBUG_ENV_FILES=(".env" ".env.local" ".env.development")
export DEBUG_ENV_PATTERNS=("APP_ENV=local" "NODE_ENV=development" "APP_DEBUG=true")
export DEBUG_DIRS=("node_modules" "src" "lib" "components" "assets")
export DEBUG_WORKSPACE_PATTERNS=("poly_apps" "dev" "development")

# External script paths
export COMMON_SCRIPTS_DIR="/scripts/shells/linux/common"
export SERVICE_MANAGER_SCRIPT="debian_service_manager.sh"
export FIREWALL_MANAGER_SCRIPT="firewall_manager.sh"
export GVAR_COMMON_SCRIPT="gvar_common.sh"

# Color scheme for output
export COLOR_HEADER="\033[36m"
export COLOR_SUCCESS="\033[32m"
export COLOR_WARNING="\033[33m"
export COLOR_ERROR="\033[31m"
export COLOR_INFO="\033[90m"
export COLOR_HIGHLIGHT="\033[37m"
export COLOR_RESET="\033[0m"

# UI configuration
export MENU_HEADER_SEPARATOR="===================================="
export MENU_WIDTH=80
export MAX_APP_DISPLAY=50

# Initialize configuration with paths
init_unified_config() {
    local script_path="$1"

    # Set base paths
    export SCRIPT_PATH="$script_path"
    export ROOT_DIR="$(cd "$script_path/../.." && pwd)"
    export NCORE_APPS="$ROOT_DIR/apps"
    export PYCORE_APPS="$ROOT_DIR/pyapps"
    export POLY_APPS="$ROOT_DIR/poly_apps"

    # Set cache paths (will be set after sourcing gvar_common.sh)
    if [ -n "$CORE_NODE_DATA_DIR" ]; then
        export CACHE_DIR="$CORE_NODE_DATA_DIR/unified_manager"
        export CACHE_FILE="$CACHE_DIR/app_cache.json"
        export TEMP_SCRIPT_DIR="$CACHE_DIR/temp_scripts"
    fi

    # Ensure required directories exist
    mkdir -p "$CACHE_DIR" "$TEMP_SCRIPT_DIR" 2>/dev/null || true
}

# Get framework-specific service name prefix
get_service_name_prefix() {
    local framework_type="$1"

    case "$framework_type" in
        "reactStart"|"vueStart") echo "$SERVICE_NAME_REACT" ;;
        "nuxtStart") echo "$SERVICE_NAME_NUXT" ;;
        "laravelStart") echo "$SERVICE_NAME_LARAVEL" ;;
        "flutterStart") echo "$SERVICE_NAME_FLUTTER" ;;
        "phpStart") echo "$SERVICE_NAME_PHP" ;;
        "pyStart") echo "$SERVICE_NAME_PYTHON" ;;
        "kotlinMultiPlatformStart") echo "$SERVICE_NAME_KOTLIN" ;;
        *) echo "$SERVICE_NAME_GENERIC" ;;
    esac
}

# Get debug detection patterns for framework
get_debug_patterns() {
    local framework_type="$1"

    case "$framework_type" in
        "reactStart"|"vueStart"|"nuxtStart")
            echo "vite.config.js vite.config.ts package.json"
            ;;
        "laravelStart")
            echo ".env composer.json"
            ;;
        "flutterStart")
            echo "pubspec.yaml build"
            ;;
        *)
            echo "${DEBUG_ENV_FILES[*]}"
            ;;
    esac
}

# Validate configuration
validate_config() {
    local errors=0

    if [ ! -d "$ROOT_DIR" ]; then
        echo "${COLOR_ERROR}Error: ROOT_DIR not found: $ROOT_DIR${COLOR_RESET}" >&2
        ((errors++))
    fi

    if [ ! -d "$NCORE_APPS" ] && [ ! -d "$PYCORE_APPS" ] && [ ! -d "$POLY_APPS" ]; then
        echo "${COLOR_ERROR}Error: No app directories found${COLOR_RESET}" >&2
        ((errors++))
    fi

    if [ "$PORT_BASE" -lt 1024 ] || [ "$PORT_BASE" -gt 65000 ]; then
        echo "${COLOR_ERROR}Error: Invalid PORT_BASE: $PORT_BASE${COLOR_RESET}" >&2
        ((errors++))
    fi

    return $errors
}