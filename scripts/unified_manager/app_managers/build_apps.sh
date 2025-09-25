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

# Unified Manager - Build Applications (Bash version)
# Builds one or multiple applications in the project

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
CLEAN=false
PRODUCTION=false
DEVELOPMENT=false
BUILD_TYPE="default"

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
        --clean)
            CLEAN=true
            shift
            ;;
        --production)
            PRODUCTION=true
            BUILD_TYPE="production"
            shift
            ;;
        --development)
            DEVELOPMENT=true
            BUILD_TYPE="development"
            shift
            ;;
        --build-type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --apps APP1 APP2 ...    Specific apps to build"
            echo "  --all                   Build all applications"
            echo "  --interactive           Interactive mode for app selection"
            echo "  --list                  List available apps"
            echo "  --verbose               Verbose output"
            echo "  --clean                 Clean build (remove existing build artifacts first)"
            echo "  --production            Production build"
            echo "  --development           Development build"
            echo "  --build-type TYPE       Build type (default, production, development)"
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

# Function to build a single application
build_single_application() {
    local app_path="$1"
    local app_name="$2"
    local build_mode="$3"
    local clean_build="$4"

    log_info "Building application: $app_name"
    log_info "  Path: $app_path"
    log_info "  Build Mode: $build_mode"

    local original_dir="$(pwd)"
    cd "$app_path" || return 1

    # Node.js applications (package.json)
    if [[ -f "package.json" ]]; then
        log_success "Detected Node.js application (package.json)"

        if [[ "$clean_build" == "true" ]]; then
            # Clean node_modules and build artifacts
            if [[ -d "node_modules" ]]; then
                log_info "Cleaning node_modules..."
                rm -rf node_modules
            fi
            if [[ -d "dist" ]]; then
                log_info "Cleaning dist directory..."
                rm -rf dist
            fi
            if [[ -d "build" ]]; then
                log_info "Cleaning build directory..."
                rm -rf build
            fi
        fi

        if ! command -v npm >/dev/null 2>&1; then
            log_error "npm not found. Please install Node.js first."
            cd "$original_dir"
            return 1
        fi

        # Install dependencies if needed
        if [[ ! -d "node_modules" ]]; then
            log_info "Installing dependencies..."
            npm install
            if [[ $? -ne 0 ]]; then
                log_error "Failed to install dependencies"
                cd "$original_dir"
                return 1
            fi
        fi

        # Determine build command
        local build_command="npm run build"

        # Check package.json for specific build scripts
        if command -v jq >/dev/null 2>&1; then
            case "$build_mode" in
                "production")
                    if jq -e '.scripts["build:prod"]' package.json >/dev/null 2>&1; then
                        build_command="npm run build:prod"
                    elif jq -e '.scripts["build:production"]' package.json >/dev/null 2>&1; then
                        build_command="npm run build:production"
                    fi
                    ;;
                "development")
                    if jq -e '.scripts["build:dev"]' package.json >/dev/null 2>&1; then
                        build_command="npm run build:dev"
                    elif jq -e '.scripts["build:development"]' package.json >/dev/null 2>&1; then
                        build_command="npm run build:development"
                    fi
                    ;;
            esac

            # Check if build script exists
            if ! jq -e '.scripts.build' package.json >/dev/null 2>&1 && \
               ! jq -e '.scripts["build:prod"]' package.json >/dev/null 2>&1 && \
               ! jq -e '.scripts["build:dev"]' package.json >/dev/null 2>&1; then
                log_warning "No build script found in package.json for $app_name"
                cd "$original_dir"
                return 1
            fi
        fi

        log_info "Running: $build_command"
        if [[ "$VERBOSE" == "true" ]]; then
            $build_command
        else
            $build_command >/dev/null 2>&1
        fi

        if [[ $? -eq 0 ]]; then
            log_success "Successfully built Node.js application: $app_name"
        else
            log_error "Failed to build Node.js application: $app_name"
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

        if [[ "$clean_build" == "true" ]]; then
            log_info "Running flutter clean..."
            flutter clean
        fi

        # Get dependencies
        log_info "Getting Flutter dependencies..."
        flutter pub get
        if [[ $? -ne 0 ]]; then
            log_error "Failed to get Flutter dependencies"
            cd "$original_dir"
            return 1
        fi

        # Determine build command
        local build_command
        case "$build_mode" in
            "production")
                build_command="flutter build apk --release"
                ;;
            "development")
                build_command="flutter build apk --debug"
                ;;
            *)
                build_command="flutter build apk"
                ;;
        esac

        log_info "Running: $build_command"
        $build_command

        if [[ $? -eq 0 ]]; then
            log_success "Successfully built Flutter application: $app_name"
        else
            log_error "Failed to build Flutter application: $app_name"
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

        if [[ "$clean_build" == "true" ]]; then
            log_info "Running cargo clean..."
            cargo clean
        fi

        # Determine build command
        local build_args=""
        case "$build_mode" in
            "production")
                build_args="--release"
                ;;
            "development")
                build_args=""
                ;;
            *)
                build_args=""
                ;;
        esac

        log_info "Running: cargo build $build_args"
        cargo build $build_args

        if [[ $? -eq 0 ]]; then
            log_success "Successfully built Rust application: $app_name"
        else
            log_error "Failed to build Rust application: $app_name"
            cd "$original_dir"
            return 1
        fi

    # Go applications (go.mod)
    elif [[ -f "go.mod" ]]; then
        log_success "Detected Go application (go.mod)"

        if ! command -v go >/dev/null 2>&1; then
            log_error "go not found. Please install Go first."
            cd "$original_dir"
            return 1
        fi

        if [[ "$clean_build" == "true" ]]; then
            log_info "Cleaning Go module cache..."
            go clean -modcache
        fi

        log_info "Running: go build"
        go build

        if [[ $? -eq 0 ]]; then
            log_success "Successfully built Go application: $app_name"
        else
            log_error "Failed to build Go application: $app_name"
            cd "$original_dir"
            return 1
        fi

    # Python applications (setup.py or pyproject.toml)
    elif [[ -f "setup.py" || -f "pyproject.toml" ]]; then
        log_success "Detected Python application"

        if ! command -v python >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
            log_error "python not found. Please install Python first."
            cd "$original_dir"
            return 1
        fi

        local python_cmd="python"
        if command -v python3 >/dev/null 2>&1; then
            python_cmd="python3"
        fi

        if [[ "$clean_build" == "true" ]]; then
            # Clean build artifacts
            if [[ -d "build" ]]; then
                log_info "Cleaning build directory..."
                rm -rf build
            fi
            if [[ -d "dist" ]]; then
                log_info "Cleaning dist directory..."
                rm -rf dist
            fi
            find . -name "*.egg-info" -type d -exec rm -rf {} + 2>/dev/null || true
        fi

        if [[ -f "pyproject.toml" ]]; then
            log_info "Building with pip (pyproject.toml)..."
            $python_cmd -m pip install -e .
        else
            log_info "Building with setup.py..."
            $python_cmd setup.py build
        fi

        if [[ $? -eq 0 ]]; then
            log_success "Successfully built Python application: $app_name"
        else
            log_error "Failed to build Python application: $app_name"
            cd "$original_dir"
            return 1
        fi

    else
        log_warning "No recognized build file found for $app_name"
        log_info "Supported files: package.json, pubspec.yaml, Cargo.toml, go.mod, setup.py, pyproject.toml"
        cd "$original_dir"
        return 1
    fi

    cd "$original_dir"
    return 0
}

# Function to get all buildable applications
get_buildable_applications() {
    local apps=()

    # Check regular apps directory
    local apps_path="$PROJECT_ROOT/apps"
    if [[ -d "$apps_path" ]]; then
        for dir in "$apps_path"/*; do
            if [[ -d "$dir" ]]; then
                local app_name="$(basename "$dir")"
                local has_build_file=false

                # Check for buildable files
                local build_files=("package.json" "pubspec.yaml" "Cargo.toml" "go.mod" "setup.py" "pyproject.toml")
                for file in "${build_files[@]}"; do
                    if [[ -f "$dir/$file" ]]; then
                        has_build_file=true
                        break
                    fi
                done

                if [[ "$has_build_file" == "true" ]]; then
                    apps+=("$app_name:$dir:app")
                fi
            fi
        done
    fi

    # Check poly apps directory
    local poly_apps_path="$PROJECT_ROOT/poly_apps"
    if [[ -d "$poly_apps_path" ]]; then
        for dir in "$poly_apps_path"/*; do
            if [[ -d "$dir" ]]; then
                local app_name="$(basename "$dir")"
                local has_build_file=false

                # Check for buildable files
                local build_files=("package.json" "pubspec.yaml" "Cargo.toml" "go.mod" "setup.py" "pyproject.toml")
                for file in "${build_files[@]}"; do
                    if [[ -f "$dir/$file" ]]; then
                        has_build_file=true
                        break
                    fi
                done

                if [[ "$has_build_file" == "true" ]]; then
                    apps+=("$app_name:$dir:poly-app")
                fi
            fi
        done
    fi

    printf '%s\n' "${apps[@]}"
}

# Function to show buildable applications
show_buildable_applications() {
    local apps
    mapfile -t apps < <(get_buildable_applications)

    if [[ ${#apps[@]} -eq 0 ]]; then
        log_warning "No buildable applications found"
        return
    fi

    log_info "Buildable Applications:"
    echo ""

    local i=1
    for app_info in "${apps[@]}"; do
        IFS=':' read -r app_name app_path app_type <<< "$app_info"
        local build_file=""

        # Detect build file
        local build_files=("package.json" "pubspec.yaml" "Cargo.toml" "go.mod" "setup.py" "pyproject.toml")
        for file in "${build_files[@]}"; do
            if [[ -f "$app_path/$file" ]]; then
                build_file="[$file]"
                break
            fi
        done

        if [[ -z "$build_file" ]]; then
            build_file="[Unknown]"
        fi

        echo "$i. $app_name ($app_type) $build_file"
        ((i++))
    done

    echo ""
}

# Function for interactive application selection
get_interactive_selection() {
    local apps
    mapfile -t apps < <(get_buildable_applications)

    if [[ ${#apps[@]} -eq 0 ]]; then
        log_warning "No buildable applications found"
        return
    fi

    show_buildable_applications
    log_info "Enter app numbers to build (space-separated), 'all' for all apps, or 'q' to quit:"
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

# Function to build multiple applications
build_multiple_applications() {
    local apps=("$@")
    local success_count=0
    local failed_count=0
    local failed_apps=()

    log_info "Building ${#apps[@]} applications..."
    echo ""

    for app_info in "${apps[@]}"; do
        IFS=':' read -r app_name app_path app_type <<< "$app_info"
        log_info "Processing: $app_name"

        if build_single_application "$app_path" "$app_name" "$BUILD_TYPE" "$CLEAN"; then
            ((success_count++))
        else
            ((failed_count++))
            failed_apps+=("$app_name")
        fi

        echo ""
    done

    # Summary
    log_info "Build Summary:"
    log_success "Successfully built: $success_count applications"

    if [[ $failed_count -gt 0 ]]; then
        log_error "Failed to build: $failed_count applications"
        log_error "Failed apps: ${failed_apps[*]}"
    fi
}

# Main function
main() {
    if [[ "$LIST" == "true" ]]; then
        show_buildable_applications
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
        # Build all applications
        mapfile -t apps_to_process < <(get_buildable_applications)
        if [[ ${#apps_to_process[@]} -eq 0 ]]; then
            log_warning "No buildable applications found"
            return 1
        fi
    elif [[ ${#APPS[@]} -gt 0 ]]; then
        # Specific applications
        local all_apps
        mapfile -t all_apps < <(get_buildable_applications)

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

    build_multiple_applications "${apps_to_process[@]}"
}

# Run main function
main "$@"