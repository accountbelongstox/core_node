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

# Central Configuration for Unified App Manager
# This file contains all configuration constants and shared settings

# Version and metadata
UNIFIED_MANAGER_VERSION="16.1.0"
UNIFIED_MANAGER_NAME="dd.sh Unified App Manager"

# Base paths (will be set by main script)
SCRIPT_PATH=""
ROOT_DIR=""
NCORE_APPS=""
PYCORE_APPS=""
POLY_APPS=""
CACHE_DIR=""
CACHE_FILE=""
TEMP_SCRIPT_DIR=""

# Port allocation configuration
PORT_BASE=10000
PORT_RANGE=5000
PORT_AUTO_INCREMENT=true

# Service configuration
SERVICE_USER="root"
SERVICE_RESTART_POLICY="always"
SERVICE_RESTART_SEC="5"
SERVICE_CPU_LIMIT="50%"
SERVICE_MEMORY_LIMIT="1G"

# Framework detection patterns
FRAMEWORK_PATTERNS_REACT="package.json react"
FRAMEWORK_PATTERNS_VUE="package.json vue"
FRAMEWORK_PATTERNS_NUXT="nuxt.config.ts nuxt.config.js"
FRAMEWORK_PATTERNS_LARAVEL="composer.json public/index.php"
FRAMEWORK_PATTERNS_FLUTTER="pubspec.yaml"
FRAMEWORK_PATTERNS_REACT_NATIVE="package.json android ios"
FRAMEWORK_PATTERNS_KOTLIN="build.gradle.kts build.gradle"
FRAMEWORK_PATTERNS_PHP="index.php"
FRAMEWORK_PATTERNS_PYTHON="main.py"

# Script scanning configuration
SCRIPT_FILES_TO_SCAN=("start.sh" "install.sh" "deploy.sh")

# Native startup types in priority order
NATIVE_STARTUPS=(
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
SERVICE_NAME_REACT="webapp"
SERVICE_NAME_VUE="webapp"
SERVICE_NAME_NUXT="nuxt"
SERVICE_NAME_LARAVEL="laravel"
SERVICE_NAME_FLUTTER="flutter"
SERVICE_NAME_PHP="php"
SERVICE_NAME_PYTHON="python"
SERVICE_NAME_KOTLIN="kotlin"
SERVICE_NAME_GENERIC="app"

# Debug mode detection patterns
DEBUG_ENV_FILES=(".env" ".env.local" ".env.development")
DEBUG_ENV_PATTERNS=("APP_ENV=local" "NODE_ENV=development" "APP_DEBUG=true")
DEBUG_DIRS=("node_modules" "src" "lib" "components" "assets")
DEBUG_WORKSPACE_PATTERNS=("poly_apps" "dev" "development")

# External script paths
COMMON_SCRIPTS_DIR="/scripts/shells/linux/common"
SERVICE_MANAGER_SCRIPT="debian_service_manager.sh"
FIREWALL_MANAGER_SCRIPT="firewall_manager.sh"
GVAR_COMMON_SCRIPT="gvar_common.sh"

# Color scheme for output
COLOR_HEADER="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARNING="\033[33m"
COLOR_ERROR="\033[31m"
COLOR_INFO="\033[90m"
COLOR_HIGHLIGHT="\033[37m"
COLOR_RESET="\033[0m"

# UI configuration
MENU_HEADER_SEPARATOR="===================================="
MENU_WIDTH=80
MAX_APP_DISPLAY=50

# Initialize configuration with paths
init_unified_config() {
    local script_path="$1"

    # Set base paths
SCRIPT_PATH="$script_path"
ROOT_DIR="$(cd "$script_path/../.." && pwd)"
NCORE_APPS="$ROOT_DIR/apps"
PYCORE_APPS="$ROOT_DIR/pyapps"
POLY_APPS="$ROOT_DIR/poly_apps"

    # Set cache paths (will be set after sourcing gvar_common.sh)
    if [ -n "$CORE_NODE_DATA_DIR" ]; then
CACHE_DIR="$CORE_NODE_DATA_DIR/unified_manager"
CACHE_FILE="$CACHE_DIR/app_cache.json"
TEMP_SCRIPT_DIR="$CACHE_DIR/temp_scripts"
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