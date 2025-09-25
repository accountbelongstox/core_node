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

# Unified Manager - Install All Dependencies
# Installs dependencies for all applications in the project

# Variables declaration
TYPE="all"
APPS=()
FORCE=false
PARALLEL=false
SKIP_ROOT=false
VERBOSE=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_PATH="$SCRIPT_DIR/linux/common/utils.sh"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
ROOT_PACKAGE_JSON="$PROJECT_ROOT/package.json"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            TYPE="$2"
            shift 2
            ;;
        --apps)
            IFS=',' read -ra APPS <<< "$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        --skip-root)
            SKIP_ROOT=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --type TYPE        Install apps of specific type (all, node, poly, python)"
            echo "  --apps APPS        Comma-separated list of specific apps to install"
            echo "  --force            Force reinstall dependencies"
            echo "  --parallel         Install dependencies in parallel"
            echo "  --skip-root        Skip root package.json installation"
            echo "  --verbose          Verbose output"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Source utilities
if [ ! -f "$UTILS_PATH" ]; then
    echo "[ERROR] Utilities not found: $UTILS_PATH"
    exit 1
fi

source "$UTILS_PATH"

# Function to install root dependencies
install_root_dependencies() {
    if [ "$SKIP_ROOT" = true ]; then
        write_info "Skipping root dependencies installation"
        return 0
    fi
    
    if [ ! -f "$ROOT_PACKAGE_JSON" ]; then
        write_warning "Root package.json not found, skipping root dependencies"
        return 0
    fi
    
    write_info "Installing root dependencies..."
    
    if ! test_command "npm"; then
        write_error "npm not found. Please install Node.js first."
        return 1
    fi
    
    local install_cmd="npm install"
    if [ "$VERBOSE" = true ]; then
        install_cmd="npm install --verbose"
    fi
    
    if invoke_in_directory "$PROJECT_ROOT" "$install_cmd"; then
        write_success "Root dependencies installed successfully"
        return 0
    else
        write_error "Failed to install root dependencies"
        return 1
    fi
}

# Function to install Node.js app dependencies
install_node_app_dependencies() {
    local app_config="$1"
    local app_name="$2"
    
    local app_path
    app_path=$(get_app_path "$app_name")
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    write_info "Installing dependencies for Node.js app: $app_name"
    
    # Node.js apps typically use root package.json
    if [ -f "$app_path/package.json" ]; then
        local install_cmd="npm install"
        if [ "$VERBOSE" = true ]; then
            install_cmd="npm install --verbose"
        fi
        
        if invoke_in_directory "$app_path" "$install_cmd"; then
            return 0
        else
            write_error "Failed to install dependencies for $app_name"
            return 1
        fi
    else
        write_info "$app_name uses root dependencies (no local package.json)"
        return 0
    fi
}

# Function to install Python app dependencies
install_python_app_dependencies() {
    local app_config="$1"
    local app_name="$2"
    
    local app_path
    app_path=$(get_app_path "$app_name")
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    write_info "Installing dependencies for Python app: $app_name"
    
    local requirements_file="$app_path/requirements.txt"
    if [ -f "$requirements_file" ]; then
        if ! test_command "python" && ! test_command "python3"; then
            write_error "Python not found. Please install Python first."
            return 1
        fi
        
        if ! test_command "pip" && ! test_command "pip3"; then
            write_error "pip not found. Please install pip first."
            return 1
        fi
        
        local python_cmd="python"
        local pip_cmd="pip"
        
        if test_command "python3"; then
            python_cmd="python3"
        fi
        
        if test_command "pip3"; then
            pip_cmd="pip3"
        fi
        
        local install_cmd="$pip_cmd install -r requirements.txt"
        if [ "$VERBOSE" = true ]; then
            install_cmd="$pip_cmd install -r requirements.txt --verbose"
        fi
        
        if invoke_in_directory "$app_path" "$install_cmd"; then
            return 0
        else
            write_error "Failed to install Python dependencies for $app_name"
            return 1
        fi
    else
        write_warning "No requirements.txt found for $app_name"
        return 0
    fi
}

# Function to install Poly app dependencies
install_poly_app_dependencies() {
    local app_config="$1"
    local app_name="$2"
    
    local app_path
    app_path=$(get_app_path "$app_name")
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    write_info "Installing dependencies for Poly app: $app_name"
    
    local install_cmd
    install_cmd=$(echo "$app_config" | jq -r '.install_cmd')
    if [ "$install_cmd" = "null" ] || [ -z "$install_cmd" ]; then
        write_warning "No install command specified for $app_name"
        return 0
    fi
    
    # Determine package manager and check if it exists
    local package_manager
    package_manager=$(echo "$install_cmd" | awk '{print $1}')
    
    case "$package_manager" in
        "npm")
            if ! test_command "npm"; then
                write_error "npm not found. Please install Node.js first."
                return 1
            fi
            ;;
        "yarn")
            if ! test_command "yarn"; then
                write_error "yarn not found. Please install yarn first."
                return 1
            fi
            ;;
        "pnpm")
            if ! test_command "pnpm"; then
                write_error "pnpm not found. Please install pnpm first."
                return 1
            fi
            ;;
        "composer")
            if ! test_command "composer"; then
                write_error "composer not found. Please install Composer first."
                return 1
            fi
            ;;
        "flutter")
            if ! test_command "flutter"; then
                write_error "flutter not found. Please install Flutter first."
                return 1
            fi
            ;;
        *)
            write_warning "Unknown package manager: $package_manager"
            ;;
    esac
    
    if [ "$VERBOSE" = true ]; then
        write_info "Executing: $install_cmd"
    fi
    
    if invoke_in_directory "$app_path" "$install_cmd"; then
        return 0
    else
        write_error "Failed to install dependencies for $app_name"
        return 1
    fi
}

# Function to install app dependencies
install_app_dependencies() {
    local app_name="$1"
    
    local app_config
    app_config=$(get_app_config "$app_name")
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    if ! test_app_exists "$app_name"; then
        write_error "Application directory not found: $app_name"
        return 1
    fi
    
    local app_type
    app_type=$(echo "$app_config" | jq -r '.type')
    
    local success=false
    case "$app_type" in
        "node")
            if install_node_app_dependencies "$app_config" "$app_name"; then
                success=true
            fi
            ;;
        "python")
            if install_python_app_dependencies "$app_config" "$app_name"; then
                success=true
            fi
            ;;
        "poly")
            if install_poly_app_dependencies "$app_config" "$app_name"; then
                success=true
            fi
            ;;
        *)
            write_warning "Unknown application type: $app_type for $app_name"
            success=true
            ;;
    esac
    
    if [ "$success" = true ]; then
        write_success "Dependencies installed successfully for $app_name"
        return 0
    else
        return 1
    fi
}

# Function to get apps to install based on filters
get_apps_to_install() {
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    if [ ${#APPS[@]} -gt 0 ]; then
        # Install specific apps
        printf '%s\n' "${APPS[@]}"
    else
        # Install based on type filter
        echo "$registry" | jq -r --arg type "$TYPE" '
            .apps | to_entries[] | 
            select($type == "all" or .value.type == $type) | 
            .key
        '
    fi
}

# Main installation function
start_installation() {
    write_info "Starting dependency installation..."
    write_info "Type filter: $TYPE"
    write_info "Force reinstall: $FORCE"
    write_info "Parallel execution: $PARALLEL"
    
    # Install root dependencies first
    if ! install_root_dependencies; then
        write_error "Failed to install root dependencies"
        return 1
    fi
    
    # Get apps to install
    local apps_to_install
    apps_to_install=($(get_apps_to_install))
    if [ ${#apps_to_install[@]} -eq 0 ]; then
        write_warning "No applications found to install"
        return 0
    fi
    
    write_info "Installing dependencies for ${#apps_to_install[@]} applications: ${apps_to_install[*]}"
    
    local failed_apps=()
    local successful_apps=()
    
    # Sequential installation (parallel implementation would be more complex)
    for app in "${apps_to_install[@]}"; do
        if install_app_dependencies "$app"; then
            successful_apps+=("$app")
        else
            failed_apps+=("$app")
        fi
    done
    
    # Report results
    write_info "Installation completed"
    write_success "Successfully installed: ${#successful_apps[@]} apps"
    if [ ${#successful_apps[@]} -gt 0 ]; then
        write_info "  - ${successful_apps[*]}"
    fi
    
    if [ ${#failed_apps[@]} -gt 0 ]; then
        write_error "Failed to install: ${#failed_apps[@]} apps"
        write_error "  - ${failed_apps[*]}"
        return 1
    fi
    
    return 0
}

# Main execution
if ! start_installation; then
    exit 1
fi

write_success "All dependencies installed successfully!"
exit 0
