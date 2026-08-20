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

# Core Library for Unified App Manager
# Contains reusable functions and utilities

# Source configuration
if [ -f "$(dirname "${BASH_SOURCE[0]}")/../config/unified_config.sh" ]; then
    source "$(dirname "${BASH_SOURCE[0]}")/../config/unified_config.sh"
fi

# ============================================================================
# LOGGING AND OUTPUT FUNCTIONS
# ============================================================================

log_header() {
    local message="$1"
    echo -e "${COLOR_HEADER}=== $message ===${COLOR_RESET}"
}

log_success() {
    local message="$1"
    echo -e "${COLOR_SUCCESS}$message${COLOR_RESET}"
}

log_warning() {
    local message="$1"
    echo -e "${COLOR_WARNING}$message${COLOR_RESET}"
}

log_error() {
    local message="$1"
    echo -e "${COLOR_ERROR}$message${COLOR_RESET}"
}

log_info() {
    local message="$1"
    echo -e "${COLOR_INFO}$message${COLOR_RESET}"
}

log_highlight() {
    local message="$1"
    echo -e "${COLOR_HIGHLIGHT}$message${COLOR_RESET}"
}

# ============================================================================
# FRAMEWORK DETECTION FUNCTIONS
# ============================================================================

detect_framework_type() {
    local app_path="$1"

    # Check for Nuxt first (specific check before React/Vue)
    if [[ -f "$app_path/nuxt.config.ts" || -f "$app_path/nuxt.config.js" ]]; then
        echo "nuxtStart"
        return 0
    fi

    # Check for React Native (before React)
    if [[ -f "$app_path/package.json" && (-d "$app_path/android" || -d "$app_path/ios") ]]; then
        if grep -q "react-native" "$app_path/package.json" 2>/dev/null; then
            echo "reactNativeStart"
            return 0
        fi
    fi

    # Check for React
    if [[ -f "$app_path/package.json" ]] && grep -q "react" "$app_path/package.json" 2>/dev/null; then
        if ! grep -q "react-native\|nuxt" "$app_path/package.json" 2>/dev/null; then
            echo "reactStart"
            return 0
        fi
    fi

    # Check for Vue (after Nuxt check)
    if [[ -f "$app_path/package.json" ]] && grep -q "vue" "$app_path/package.json" 2>/dev/null; then
        if ! grep -q "nuxt" "$app_path/package.json" 2>/dev/null; then
            echo "vueStart"
            return 0
        fi
    fi

    # Check for Laravel
    if [[ -f "$app_path/composer.json" && -f "$app_path/public/index.php" ]]; then
        echo "laravelStart"
        return 0
    fi

    # Check for Flutter
    if [[ -f "$app_path/pubspec.yaml" ]]; then
        echo "flutterStart"
        return 0
    fi

    # Check for Kotlin Multiplatform
    if [[ -f "$app_path/build.gradle.kts" || -f "$app_path/build.gradle" ]]; then
        local gradle_file="$app_path/build.gradle.kts"
        [[ ! -f "$gradle_file" ]] && gradle_file="$app_path/build.gradle"

        if grep -q "kotlin.*multiplatform" "$gradle_file" 2>/dev/null; then
            echo "kotlinMultiPlatformStart"
            return 0
        fi
    fi

    # Check for PHP
    if [[ -f "$app_path/index.php" ]]; then
        echo "phpStart"
        return 0
    fi

    # Check for Python
    if [[ -f "$app_path/main.py" ]]; then
        echo "pyStart"
        return 0
    fi

    # Default fallback
    echo "polyLauncher"
}

# ============================================================================
# PORT MANAGEMENT FUNCTIONS
# ============================================================================

get_app_port() {
    local app_name="$1"
    local app_index="$2"

    if [ "$PORT_AUTO_INCREMENT" = "true" ] && [ -n "$app_index" ]; then
        # Use index-based allocation
        echo $((PORT_BASE + app_index))
    else
        # Use hash-based allocation for backward compatibility
        local hash=$(echo -n "$app_name" | md5sum | tr -d ' -' | cut -c1-8)
        local port_offset=$((0x$hash % PORT_RANGE))
        echo $((PORT_BASE + port_offset))
    fi
}

validate_port() {
    local port="$1"

    if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
        return 1
    fi

    return 0
}

check_port_available() {
    local port="$1"
    ! ss -tuln | grep -q ":$port "
}

# ============================================================================
# SERVICE MANAGEMENT FUNCTIONS
# ============================================================================

get_service_name() {
    local app_name="$1"
    local framework_type="$2"

    local prefix=$(get_service_name_prefix "$framework_type")
    echo "${prefix}-${app_name}"
}

check_service_exists() {
    local service_name="$1"
    systemctl list-unit-files "$service_name.service" >/dev/null 2>&1
}

stop_service_safe() {
    local service_name="$1"

    if systemctl is-active "$service_name" >/dev/null 2>&1; then
        log_info "Stopping $service_name..."
        sudo systemctl stop "$service_name" 2>/dev/null || true
    fi

    if systemctl is-enabled "$service_name" >/dev/null 2>&1; then
        log_info "Disabling $service_name..."
        sudo systemctl disable "$service_name" 2>/dev/null || true
    fi
}

# ============================================================================
# DEBUG MODE DETECTION FUNCTIONS
# ============================================================================

check_debug_indicators() {
    local app_path="$1"
    local framework_type="$2"

    # Check environment files
    for env_file in "${DEBUG_ENV_FILES[@]}"; do
        if [[ -f "$app_path/$env_file" ]]; then
            for pattern in "${DEBUG_ENV_PATTERNS[@]}"; do
                if grep -q "$pattern" "$app_path/$env_file" 2>/dev/null; then
                    echo "true"
                    return 0
                fi
            done
        fi
    done

    # Check framework-specific indicators
    case "$framework_type" in
        "reactStart"|"vueStart"|"nuxtStart")
            if [[ -f "$app_path/vite.config.js" || -f "$app_path/vite.config.ts" ]]; then
                echo "true"
                return 0
            fi
            ;;
        "laravelStart")
            if [[ -f "$app_path/.env" ]] && grep -q "APP_DEBUG=true\|APP_ENV=local" "$app_path/.env" 2>/dev/null; then
                echo "true"
                return 0
            fi
            ;;
        "flutterStart")
            if [[ -d "$app_path/build" ]] && find "$app_path/build" -name "*debug*" -type d 2>/dev/null | grep -q .; then
                echo "true"
                return 0
            fi
            ;;
    esac

    # Check development directories
    local found_indicators=0
    for dir in "${DEBUG_DIRS[@]}"; do
        [[ -d "$app_path/$dir" ]] && ((found_indicators++))
    done

    if [ $found_indicators -ge 3 ]; then
        echo "true"
        return 0
    fi

    # Check workspace path patterns
    for pattern in "${DEBUG_WORKSPACE_PATTERNS[@]}"; do
        if [[ "$app_path" == *"/$pattern/"* ]]; then
            echo "true"
            return 0
        fi
    done

    echo "false"
}

# ============================================================================
# EXTERNAL SCRIPT LOADING FUNCTIONS
# ============================================================================

load_common_scripts() {
    local common_dir="$ROOT_DIR$COMMON_SCRIPTS_DIR"

    # Load global variables
    local gvar_script="$common_dir/$GVAR_COMMON_SCRIPT"
    if [[ -f "$gvar_script" ]]; then
        source "$gvar_script"
        log_success "Global variables loaded"
    else
        log_warning "Global variables script not found: $gvar_script"
    fi

    # Load service manager
    local service_script="$common_dir/$SERVICE_MANAGER_SCRIPT"
    if [[ -f "$service_script" ]]; then
        source "$service_script"
        log_success "Service manager loaded"
        return 0
    else
        log_error "Service manager script not found: $service_script"
        return 1
    fi
}

load_firewall_manager() {
    local firewall_script="$ROOT_DIR$COMMON_SCRIPTS_DIR/$FIREWALL_MANAGER_SCRIPT"

    if [[ -f "$firewall_script" ]]; then
        source "$firewall_script"
        log_success "Firewall manager loaded"
        return 0
    else
        log_warning "Firewall manager not found: $firewall_script"
        return 1
    fi
}

# ============================================================================
# FILE AND PATH UTILITIES
# ============================================================================

ensure_directory() {
    local dir="$1"
    mkdir -p "$dir" 2>/dev/null || {
        log_error "Failed to create directory: $dir"
        return 1
    }
}

get_relative_path() {
    local from="$1"
    local to="$2"
    realpath --relative-to="$from" "$to" 2>/dev/null || echo "$to"
}

safe_source() {
    local script="$1"
    local description="${2:-script}"

    if [[ -f "$script" ]]; then
        source "$script"
        log_success "$description loaded: $(basename "$script")"
        return 0
    else
        log_error "$description not found: $script"
        return 1
    fi
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

validate_app_structure() {
    local app_path="$1"

    [[ -d "$app_path" ]] || return 1
    [[ -r "$app_path" ]] || return 1

    return 0
}

validate_framework_files() {
    local app_path="$1"
    local framework_type="$2"

    case "$framework_type" in
        "reactStart"|"vueStart")
            [[ -f "$app_path/package.json" ]] || return 1
            ;;
        "nuxtStart")
            [[ -f "$app_path/nuxt.config.ts" || -f "$app_path/nuxt.config.js" ]] || return 1
            ;;
        "laravelStart")
            [[ -f "$app_path/composer.json" && -f "$app_path/public/index.php" ]] || return 1
            ;;
        "flutterStart")
            [[ -f "$app_path/pubspec.yaml" ]] || return 1
            ;;
        "pyStart")
            [[ -f "$app_path/main.py" ]] || return 1
            ;;
        "phpStart")
            [[ -f "$app_path/index.php" ]] || return 1
            ;;
    esac

    return 0
}