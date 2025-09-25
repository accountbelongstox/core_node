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

# Unified Manager - Build Applications
# Builds one or multiple applications in the project

# Variables declaration
APPS=()
TYPE=""
ALL=false
PRODUCTION=false
CLEAN=false
PARALLEL=false
LIST=false
VERBOSE=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_PATH="$SCRIPT_DIR/linux/common/utils.sh"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --apps)
            IFS=',' read -ra APPS <<< "$2"
            shift 2
            ;;
        --type)
            TYPE="$2"
            shift 2
            ;;
        --all)
            ALL=true
            shift
            ;;
        --production)
            PRODUCTION=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --parallel)
            PARALLEL=true
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
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --apps APPS        Comma-separated list of apps to build (app:subapp format)"
            echo "  --type TYPE        Build apps of specific type (frontend, backend, mobile)"
            echo "  --all              Build all buildable apps"
            echo "  --production       Production build"
            echo "  --clean            Clean before build"
            echo "  --parallel         Build in parallel"
            echo "  --list             List buildable apps"
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

# Function to list buildable applications
show_buildable_apps() {
    write_info "Buildable Applications:"
    
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    local buildable_found=false
    
    # Group by category
    for category in "frontend" "backend" "mobile" "automation"; do
        local category_apps=()
        
        # Get main apps
        while read -r app_name; do
            local app_config
            app_config=$(echo "$registry" | jq -r ".apps.\"$app_name\"")
            local app_category
            app_category=$(echo "$app_config" | jq -r '.category')
            local build_cmd
            build_cmd=$(echo "$app_config" | jq -r '.build_cmd')
            
            if [ "$app_category" = "$category" ] && [ "$build_cmd" != "null" ] && [ -n "$build_cmd" ]; then
                local description
                description=$(echo "$app_config" | jq -r '.description')
                category_apps+=("$app_name|main|$build_cmd|$description")
                buildable_found=true
            fi
            
            # Check sub-apps
            local sub_apps
            sub_apps=$(echo "$app_config" | jq -r '.sub_apps // empty | keys[]')
            while read -r sub_app; do
                if [ -n "$sub_app" ]; then
                    local sub_config
                    sub_config=$(echo "$app_config" | jq -r ".sub_apps.\"$sub_app\"")
                    local sub_build_cmd
                    sub_build_cmd=$(echo "$sub_config" | jq -r '.build_cmd')
                    
                    if [ "$sub_build_cmd" != "null" ] && [ -n "$sub_build_cmd" ]; then
                        local sub_description
                        sub_description=$(echo "$sub_config" | jq -r '.description')
                        category_apps+=("$app_name:$sub_app|sub|$sub_build_cmd|$sub_description")
                        buildable_found=true
                    fi
                fi
            done <<< "$sub_apps"
            
        done <<< "$(echo "$registry" | jq -r '.apps | keys[]')"
        
        # Display category if it has apps
        if [ ${#category_apps[@]} -gt 0 ]; then
            echo "  ${category^^}:"
            for app_info in "${category_apps[@]}"; do
                IFS='|' read -r name type build_cmd description <<< "$app_info"
                echo "    $name"
                echo "      Build: $build_cmd"
                echo "      Description: $description"
                echo ""
            done
        fi
    done
    
    if [ "$buildable_found" = false ]; then
        write_warning "No buildable applications found"
    fi
}

# Function to clean application build artifacts
clear_app_build_artifacts() {
    local app_name="$1"
    local sub_app="$2"
    
    local app_path
    app_path=$(get_app_path "$app_name")
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    local app_spec="$app_name"
    if [ -n "$sub_app" ]; then
        app_spec="$app_name:$sub_app"
    fi
    
    write_info "Cleaning build artifacts for $app_spec"
    
    # Common build directories to clean
    local build_dirs=("dist" "build" ".output" "public/build" "target" "__pycache__")
    
    for dir in "${build_dirs[@]}"; do
        local full_path="$app_path/$dir"
        if [ -d "$full_path" ]; then
            if rm -rf "$full_path" 2>/dev/null; then
                write_info "  Removed: $dir"
            else
                write_warning "  Failed to remove: $dir"
            fi
        fi
    done
    
    # Remove Python cache files
    find "$app_path" -name "*.pyc" -delete 2>/dev/null || true
    find "$app_path" -name "*.pyo" -delete 2>/dev/null || true
    find "$app_path" -name "*.egg-info" -type d -exec rm -rf {} + 2>/dev/null || true
    
    return 0
}

# Function to build a single application
build_single_app() {
    local app_spec="$1"
    
    # Parse app specification
    local parsed
    parsed=$(parse_app_spec "$app_spec")
    local app_name="${parsed%|*}"
    local sub_app="${parsed#*|}"
    
    if [ "$sub_app" = "" ]; then
        sub_app=""
    fi
    
    write_info "Building application: $app_spec"
    
    # Get app configuration
    local app_config
    app_config=$(get_app_config "$app_name" "$sub_app")
    if [ $? -ne 0 ]; then
        write_error "Failed to get configuration for $app_spec"
        return 1
    fi
    
    # Check if app exists
    if ! test_app_exists "$app_name" "$sub_app"; then
        write_error "Application not found: $app_spec"
        return 1
    fi
    
    # Get build command
    local build_cmd
    build_cmd=$(echo "$app_config" | jq -r '.build_cmd')
    if [ "$build_cmd" = "null" ] || [ -z "$build_cmd" ]; then
        write_warning "No build command specified for $app_spec, skipping"
        return 0
    fi
    
    # Get app path
    local app_path
    app_path=$(get_app_path "$app_name")
    if [ $? -ne 0 ]; then
        write_error "Failed to get path for $app_name"
        return 1
    fi
    
    # Check dependencies
    if ! check_app_dependencies "$app_config"; then
        write_error "Missing dependencies for $app_spec"
        return 1
    fi
    
    # Clean if requested
    if [ "$CLEAN" = true ]; then
        clear_app_build_artifacts "$app_name" "$sub_app"
    fi
    
    # Display build information
    local app_type
    app_type=$(echo "$app_config" | jq -r '.type')
    local app_category
    app_category=$(echo "$app_config" | jq -r '.category')
    
    write_info "  Type: $app_type"
    write_info "  Category: $app_category"
    write_info "  Path: $app_path"
    write_info "  Build Command: $build_cmd"
    
    # Modify build command for production if needed
    local final_build_cmd="$build_cmd"
    if [ "$PRODUCTION" = true ]; then
        # Add production flags for common build tools
        if [[ "$build_cmd" == *"npm run build"* ]]; then
            final_build_cmd="${build_cmd/npm run build/npm run build --production}"
        elif [[ "$build_cmd" == *"yarn build"* ]]; then
            final_build_cmd="${build_cmd/yarn build/yarn build --mode production}"
        elif [[ "$build_cmd" == *"flutter build"* ]]; then
            final_build_cmd="${build_cmd/flutter build/flutter build --release}"
        fi
        
        # Set NODE_ENV for Node.js applications
        if [ "$app_type" = "poly" ] && [[ "$build_cmd" == *"npm"* || "$build_cmd" == *"yarn"* || "$build_cmd" == *"pnpm"* ]]; then
            export NODE_ENV="production"
        fi
    fi
    
    if [ "$VERBOSE" = true ]; then
        write_info "  Final Command: $final_build_cmd"
    fi
    
    local build_start_time
    build_start_time=$(date +%s)
    
    # Execute build command
    cd "$app_path" || return 1
    
    if [ "$VERBOSE" = true ]; then
        eval "$final_build_cmd"
    else
        eval "$final_build_cmd" >/dev/null 2>&1
    fi
    
    local exit_code=$?
    
    # Reset environment variables
    if [ "$PRODUCTION" = true ] && [ "$NODE_ENV" = "production" ]; then
        unset NODE_ENV
    fi
    
    local build_end_time
    build_end_time=$(date +%s)
    local build_duration=$((build_end_time - build_start_time))
    
    if [ $exit_code -eq 0 ]; then
        write_success "Built $app_spec successfully (took ${build_duration}s)"
        return 0
    else
        write_error "Failed to build $app_spec (exit code: $exit_code)"
        return 1
    fi
}

# Function to get apps to build based on filters
get_apps_to_build() {
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    if [ ${#APPS[@]} -gt 0 ]; then
        # Build specific apps
        printf '%s\n' "${APPS[@]}"
    elif [ "$ALL" = true ]; then
        # Build all buildable apps
        echo "$registry" | jq -r '
            .apps | to_entries[] | 
            (if .value.build_cmd then .key else empty end),
            (if .value.sub_apps then 
                (.value.sub_apps | to_entries[] | 
                 if .value.build_cmd then "\(.key):\(.key)" else empty end)
            else empty end)
        ' | sed "s/^/$(echo "$registry" | jq -r '.apps | keys[]' | head -1)/" 2>/dev/null || echo "$registry" | jq -r '
            .apps | to_entries[] | 
            (if .value.build_cmd then .key else empty end),
            (if .value.sub_apps then 
                (.value.sub_apps | to_entries[] | 
                 select(.value.build_cmd) | "\(.key):\(.key)")
            else empty end)
        '
    elif [ -n "$TYPE" ]; then
        # Build apps by category
        echo "$registry" | jq -r --arg type "$TYPE" '
            .apps | to_entries[] | 
            select(.value.category == $type) |
            (if .value.build_cmd then .key else empty end),
            (if .value.sub_apps then 
                (.value.sub_apps | to_entries[] | 
                 select(.value.build_cmd) | "\(.key):\(.key)")
            else empty end)
        '
    fi
}

# Function to build multiple applications
build_multiple_apps() {
    local app_specs=("$@")
    
    write_info "Building ${#app_specs[@]} applications..."
    
    local successful_builds=()
    local failed_builds=()
    local total_start_time
    total_start_time=$(date +%s)
    
    # Sequential building (parallel implementation would be more complex)
    for app_spec in "${app_specs[@]}"; do
        if build_single_app "$app_spec"; then
            successful_builds+=("$app_spec")
        else
            failed_builds+=("$app_spec")
        fi
    done
    
    local total_end_time
    total_end_time=$(date +%s)
    local total_duration=$((total_end_time - total_start_time))
    
    # Report results
    write_info "Build completed in ${total_duration}s"
    write_success "Successfully built: ${#successful_builds[@]} apps"
    if [ ${#successful_builds[@]} -gt 0 ]; then
        write_info "  - ${successful_builds[*]}"
    fi
    
    if [ ${#failed_builds[@]} -gt 0 ]; then
        write_error "Failed to build: ${#failed_builds[@]} apps"
        write_error "  - ${failed_builds[*]}"
        return 1
    fi
    
    return 0
}

# Main execution function
start_building() {
    if [ "$LIST" = true ]; then
        show_buildable_apps
        return 0
    fi
    
    write_info "Starting build process..."
    write_info "Production mode: $PRODUCTION"
    write_info "Clean before build: $CLEAN"
    write_info "Parallel execution: $PARALLEL"
    
    # Get apps to build
    local apps_to_build
    apps_to_build=($(get_apps_to_build))
    if [ ${#apps_to_build[@]} -eq 0 ]; then
        write_warning "No applications found to build"
        return 0
    fi
    
    write_info "Building ${#apps_to_build[@]} applications: ${apps_to_build[*]}"
    
    build_multiple_apps "${apps_to_build[@]}"
}

# Main execution
if ! start_building; then
    exit 1
fi

write_success "All builds completed successfully!"
exit 0
