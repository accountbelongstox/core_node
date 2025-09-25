#!/bin/bash

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For shell scripts: Use absolute paths and avoid relative paths like "../.."; instead resolve absolute paths using dirname and realpath.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Unified Manager - Install Dependencies (Bash version)
# Installs dependencies for one or multiple applications in the project

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_PATH="$(dirname "$SCRIPT_DIR")/common/utils.sh"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Default parameters
APPS=()
ALL=false
INTERACTIVE=false
LIST=false
VERBOSE=false
FORCE=false
CLEAN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --apps)
            shift
            while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
                APPS+=("$1")
                shift
            done
            ;;
        --all)
            ALL=true
            shift
            ;;
        --interactive)
            INTERACTIVE=true
            shift
            ;;
        --list)
            LIST=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --apps APP1 APP2 ...    Specific apps to install dependencies for"
            echo "  --all                   Install dependencies for all apps"
            echo "  --interactive           Interactive mode for app selection"
            echo "  --list                  List available apps"
            echo "  --verbose               Verbose output"
            echo "  --force                 Force reinstall dependencies"
            echo "  --clean                 Clean install (remove existing dependencies first)"
            echo "  -h, --help              Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Source utilities if available
if [[ -f "$UTILS_PATH" ]]; then
    source "$UTILS_PATH"
else
    echo "Warning: Utilities not found: $UTILS_PATH"
    # Basic logging functions
    log_info() { echo "[INFO] $*"; }
    log_success() { echo "[OK] $*"; }
    log_warning() { echo "[WARN] $*"; }
    log_error() { echo "[ERROR] $*"; }
fi

# Function to install dependencies for a single application
install_app_dependencies() {
    local app_path="$1"
    local app_name="$2"

    log_info "Installing dependencies for: $app_name"
    log_info "  Path: $app_path"

    local original_dir="$(pwd)"
    cd "$app_path" || return 1

    # Node.js applications (package.json)
    if [[ -f "package.json" ]]; then
        log_success "Detected Node.js application (package.json)"

        if [[ "$CLEAN" == "true" && -d "node_modules" ]]; then
            log_info "Cleaning existing node_modules..."
            rm -rf node_modules
        fi

        if [[ "$CLEAN" == "true" && -f "package-lock.json" ]]; then
            log_info "Removing package-lock.json for clean install..."
            rm -f package-lock.json
        fi

        if ! command -v npm >/dev/null 2>&1; then
            log_error "npm not found. Please install Node.js first."
            cd "$original_dir"
            return 1
        fi

        log_info "Running npm install..."
        if [[ "$VERBOSE" == "true" ]]; then
            npm install --verbose
        else
            npm install
        fi

        if [[ $? -eq 0 ]]; then
            log_success "Successfully installed Node.js dependencies for $app_name"
        else
            log_error "Failed to install Node.js dependencies for $app_name"
            cd "$original_dir"
            return 1
        fi

    # Python applications (requirements.txt)
    elif [[ -f "requirements.txt" ]]; then
        log_success "Detected Python application (requirements.txt)"

        if ! command -v pip >/dev/null 2>&1; then
            log_error "pip not found. Please install Python first."
            cd "$original_dir"
            return 1
        fi

        log_info "Running pip install..."
        if [[ "$FORCE" == "true" ]]; then
            pip install -r requirements.txt --force-reinstall
        else
            pip install -r requirements.txt
        fi

        if [[ $? -eq 0 ]]; then
            log_success "Successfully installed Python dependencies for $app_name"
        else
            log_error "Failed to install Python dependencies for $app_name"
            cd "$original_dir"
            return 1
        fi

    # Python applications (pyproject.toml)
    elif [[ -f "pyproject.toml" ]]; then
        log_success "Detected Python application (pyproject.toml)"

        if ! command -v pip >/dev/null 2>&1; then
            log_error "pip not found. Please install Python first."
            cd "$original_dir"
            return 1
        fi

        log_info "Running pip install (editable)..."
        pip install -e .

        if [[ $? -eq 0 ]]; then
            log_success "Successfully installed Python dependencies for $app_name"
        else
            log_error "Failed to install Python dependencies for $app_name"
            cd "$original_dir"
            return 1
        fi

    # PHP applications (composer.json)
    elif [[ -f "composer.json" ]]; then
        log_success "Detected PHP application (composer.json)"

        if ! command -v composer >/dev/null 2>&1; then
            log_error "composer not found. Please install Composer first."
            cd "$original_dir"
            return 1
        fi

        if [[ "$CLEAN" == "true" && -d "vendor" ]]; then
            log_info "Cleaning existing vendor directory..."
            rm -rf vendor
        fi

        log_info "Running composer install..."
        if [[ "$VERBOSE" == "true" ]]; then
            composer install --verbose
        else
            composer install
        fi

        if [[ $? -eq 0 ]]; then
            log_success "Successfully installed PHP dependencies for $app_name"
        else
            log_error "Failed to install PHP dependencies for $app_name"
            cd "$original_dir"
            return 1
        fi

    # Flutter applications (pubspec.yaml)
    elif [[ -f "pubspec.yaml" ]]; then
        log_success "Detected Flutter application (pubspec.yaml)"

        if ! command -v flutter >/dev/null 2>&1; then
            log_error "flutter not found. Please install Flutter first."
            cd "$original_dir"
            return 1
        fi

        if [[ "$CLEAN" == "true" ]]; then
            log_info "Running flutter clean..."
            flutter clean
        fi

        log_info "Running flutter pub get..."
        flutter pub get

        if [[ $? -eq 0 ]]; then
            log_success "Successfully installed Flutter dependencies for $app_name"
        else
            log_error "Failed to install Flutter dependencies for $app_name"
            cd "$original_dir"
            return 1
        fi

    # Rust applications (Cargo.toml)
    elif [[ -f "Cargo.toml" ]]; then
        log_success "Detected Rust application (Cargo.toml)"

        if ! command -v cargo >/dev/null 2>&1; then
            log_error "cargo not found. Please install Rust first."
            cd "$original_dir"
            return 1
        fi

        if [[ "$CLEAN" == "true" && -d "target" ]]; then
            log_info "Cleaning existing target directory..."
            rm -rf target
        fi

        log_info "Running cargo build..."
        cargo build

        if [[ $? -eq 0 ]]; then
            log_success "Successfully built Rust dependencies for $app_name"
        else
            log_error "Failed to build Rust dependencies for $app_name"
            cd "$original_dir"
            return 1
        fi

    else
        log_warning "No recognized dependency file found for $app_name"
        log_info "Supported files: package.json, requirements.txt, pyproject.toml, composer.json, pubspec.yaml, Cargo.toml"
        cd "$original_dir"
        return 1
    fi

    cd "$original_dir"
    return 0
}

# Function to get all available applications
get_available_applications() {
    local apps=()

    # Check regular apps directory
    local apps_path="$PROJECT_ROOT/apps"
    if [[ -d "$apps_path" ]]; then
        for dir in "$apps_path"/*; do
            if [[ -d "$dir" ]]; then
                local app_name="$(basename "$dir")"
                apps+=("$app_name:$dir:app")
            fi
        done
    fi

    # Check poly apps directory
    local poly_apps_path="$PROJECT_ROOT/poly_apps"
    if [[ -d "$poly_apps_path" ]]; then
        for dir in "$poly_apps_path"/*; do
            if [[ -d "$dir" ]]; then
                local app_name="$(basename "$dir")"
                apps+=("$app_name:$dir:poly-app")
            fi
        done
    fi

    printf '%s\n' "${apps[@]}"
}

# Function to show available applications
show_available_applications() {
    local apps
    mapfile -t apps < <(get_available_applications)

    if [[ ${#apps[@]} -eq 0 ]]; then
        log_warning "No applications found"
        return
    fi

    log_info "Available Applications:"
    echo ""

    local i=1
    for app_info in "${apps[@]}"; do
        IFS=':' read -r app_name app_path app_type <<< "$app_info"
        local dep_file=""

        # Detect dependency file
        local dep_files=("package.json" "requirements.txt" "pyproject.toml" "composer.json" "pubspec.yaml" "Cargo.toml")
        for file in "${dep_files[@]}"; do
            if [[ -f "$app_path/$file" ]]; then
                dep_file="[$file]"
                break
            fi
        done

        if [[ -z "$dep_file" ]]; then
            dep_file="[No deps]"
        fi

        echo "$i. $app_name ($app_type) $dep_file"
        ((i++))
    done

    echo ""
}

# Function for interactive application selection
get_interactive_selection() {
    local apps
    mapfile -t apps < <(get_available_applications)

    if [[ ${#apps[@]} -eq 0 ]]; then
        log_warning "No applications found"
        return
    fi

    show_available_applications
    log_info "Enter app numbers to install dependencies (space-separated), 'all' for all apps, or 'q' to quit:"
    read -r selection

    if [[ -z "$selection" || "$selection" == "q" ]]; then
        return
    fi

    if [[ "$selection" == "all" ]]; then
        printf '%s\n' "${apps[@]}"
        return
    fi

    local selected_apps=()
    for num in $selection; do
        if [[ "$num" =~ ^[0-9]+$ ]]; then
            local index=$((num - 1))
            if [[ $index -ge 0 && $index -lt ${#apps[@]} ]]; then
                selected_apps+=("${apps[$index]}")
            else
                log_warning "Invalid app number: $num"
            fi
        else
            log_warning "Invalid input: $num"
        fi
    done

    printf '%s\n' "${selected_apps[@]}"
}

# Function to install dependencies for multiple applications
install_multiple_apps_dependencies() {
    local apps=("$@")
    local success_count=0
    local failed_count=0
    local failed_apps=()

    log_info "Installing dependencies for ${#apps[@]} applications..."
    echo ""

    for app_info in "${apps[@]}"; do
        IFS=':' read -r app_name app_path app_type <<< "$app_info"
        log_info "Processing: $app_name"

        if install_app_dependencies "$app_path" "$app_name"; then
            ((success_count++))
        else
            ((failed_count++))
            failed_apps+=("$app_name")
        fi

        echo ""
    done

    # Summary
    log_info "Installation Summary:"
    log_success "Successfully processed: $success_count applications"

    if [[ $failed_count -gt 0 ]]; then
        log_error "Failed to process: $failed_count applications"
        log_error "Failed apps: ${failed_apps[*]}"
    fi
}

# Main function
main() {
    if [[ "$LIST" == "true" ]]; then
        show_available_applications
        return 0
    fi

    local apps_to_process=()

    if [[ "$INTERACTIVE" == "true" || (${#APPS[@]} -eq 0 && "$ALL" != "true") ]]; then
        # Interactive mode
        mapfile -t apps_to_process < <(get_interactive_selection)
        if [[ ${#apps_to_process[@]} -eq 0 ]]; then
            log_info "No applications selected"
            return 0
        fi
    elif [[ "$ALL" == "true" ]]; then
        # Install for all applications
        mapfile -t apps_to_process < <(get_available_applications)
        if [[ ${#apps_to_process[@]} -eq 0 ]]; then
            log_warning "No applications found"
            return 1
        fi
    elif [[ ${#APPS[@]} -gt 0 ]]; then
        # Specific applications
        local all_apps
        mapfile -t all_apps < <(get_available_applications)

        for app_name in "${APPS[@]}"; do
            local found=false
            for app_info in "${all_apps[@]}"; do
                IFS=':' read -r name path type <<< "$app_info"
                if [[ "$name" == "$app_name" ]]; then
                    apps_to_process+=("$app_info")
                    found=true
                    break
                fi
            done

            if [[ "$found" != "true" ]]; then
                log_warning "Application not found: $app_name"
            fi
        done

        if [[ ${#apps_to_process[@]} -eq 0 ]]; then
            log_error "No valid applications found from input: ${APPS[*]}"
            return 1
        fi
    fi

    install_multiple_apps_dependencies "${apps_to_process[@]}"
}

# Run main function
main "$@"