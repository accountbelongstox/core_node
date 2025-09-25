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

# Unified Manager - Start Applications (Bash version)
# Starts one or multiple applications in the project

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_PATH="$SCRIPT_DIR/../common/utils.sh"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Default parameters
APPS=()
PRESET=""
BACKGROUND=false
SEQUENTIAL=false
LIST=false
VERBOSE=false
DELAY=2
INTERACTIVE=false

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
        --preset)
            PRESET="$2"
            shift 2
            ;;
        --background)
            BACKGROUND=true
            shift
            ;;
        --sequential)
            SEQUENTIAL=true
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
        --delay)
            DELAY="$2"
            shift 2
            ;;
        --interactive)
            INTERACTIVE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --apps APP1 APP2 ...    Specific apps to start"
            echo "  --preset PRESET         Preset configuration to start"
            echo "  --background            Start apps in background"
            echo "  --sequential            Start apps sequentially"
            echo "  --list                  List available apps and presets"
            echo "  --verbose               Verbose output"
            echo "  --delay SECONDS         Delay between starting apps"
            echo "  --interactive           Interactive mode"
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

# Function to show available apps and presets
show_available_options() {
    local registry_file="$SCRIPT_DIR/../app_registry.json"

    if [[ ! -f "$registry_file" ]]; then
        log_error "Application registry not found: $registry_file"
        return 1
    fi

    echo ""
    echo "=== Available Applications ==="
    echo ""

    # Parse JSON using basic tools (assuming jq is available or fallback)
    if command -v jq >/dev/null 2>&1; then
        # Using jq for JSON parsing
        jq -r '.apps | to_entries | sort_by(.value.id | tonumber) | .[] | "\(.value.id): \(.key) (\(.value.type)) \"\(.value.description)\""' "$registry_file"

        echo ""
        echo "=== Available Presets ==="
        echo ""

        jq -r '.presets | to_entries | sort_by(.value.id) | .[] | "\(.value.id): \(.key) \"\(.value.description)\" [\(.value.app_names | join(", "))]"' "$registry_file"
    else
        log_warning "jq not available, using basic parsing"
        # Basic fallback parsing
        grep -E '"[^"]*":\s*{' "$registry_file" | head -10
    fi

    echo ""
    echo "Applications are read directly from app_registry.json"
}

# Function to start a single application
start_single_app() {
    local app_spec="$1"
    local in_background="$2"

    log_info "Starting application: $app_spec"

    # For bash version, we'll use a simplified approach
    # This would need to be enhanced based on the actual app structure

    local app_path="$PROJECT_ROOT/apps/$app_spec"
    if [[ ! -d "$app_path" ]]; then
        app_path="$PROJECT_ROOT/poly_apps/$app_spec"
    fi

    if [[ ! -d "$app_path" ]]; then
        log_error "Application directory not found: $app_spec"
        return 1
    fi

    log_info "  Path: $app_path"

    # Look for start scripts
    local start_script=""
    if [[ -f "$app_path/start.sh" ]]; then
        start_script="$app_path/start.sh"
    elif [[ -f "$app_path/package.json" ]]; then
        # Node.js application
        start_script="npm start"
    elif [[ -f "$app_path/main.py" ]]; then
        # Python application
        start_script="python main.py"
    else
        log_warning "No start method found for $app_spec"
        return 1
    fi

    log_info "  Command: $start_script"

    cd "$app_path" || return 1

    if [[ "$in_background" == "true" ]]; then
        if [[ -f "$start_script" ]]; then
            nohup bash "$start_script" > "/tmp/${app_spec}.log" 2>&1 &
        else
            nohup $start_script > "/tmp/${app_spec}.log" 2>&1 &
        fi
        local pid=$!
        log_success "Started $app_spec in background (PID: $pid)"
    else
        if [[ -f "$start_script" ]]; then
            bash "$start_script"
        else
            $start_script
        fi
    fi

    cd - >/dev/null || return 1
}

# Function to start multiple applications
start_multiple_apps() {
    local apps=("$@")

    log_info "Starting ${#apps[@]} applications..."

    for app_spec in "${apps[@]}"; do
        start_single_app "$app_spec" "$BACKGROUND"

        if [[ "$DELAY" -gt 0 && "$app_spec" != "${apps[-1]}" ]]; then
            log_info "Waiting $DELAY seconds before starting next app..."
            sleep "$DELAY"
        fi
    done
}

# Function for interactive mode
interactive_mode() {
    echo "Starting Interactive Application Manager"
    echo "Commands: 'q'=quit, 'list'=show apps, or enter app names"
    echo ""

    while true; do
        show_available_options
        echo ""
        echo -n "Enter apps to start (space-separated) or 'q' to quit: "
        read -r selection

        case "$selection" in
            q|quit|exit)
                echo "Exiting..."
                break
                ;;
            list|l)
                continue
                ;;
            "")
                continue
                ;;
            *)
                IFS=' ' read -ra selected_apps <<< "$selection"
                start_multiple_apps "${selected_apps[@]}"
                ;;
        esac

        echo ""
    done
}

# Main execution
main() {
    if [[ "$LIST" == "true" ]]; then
        show_available_options
        return 0
    fi

    if [[ "$INTERACTIVE" == "true" || (${#APPS[@]} -eq 0 && -z "$PRESET") ]]; then
        interactive_mode
        return 0
    fi

    if [[ -n "$PRESET" ]]; then
        log_info "Starting preset: $PRESET"
        # This would need preset parsing from JSON
        log_warning "Preset functionality not fully implemented in bash version"
        return 1
    fi

    if [[ ${#APPS[@]} -gt 0 ]]; then
        start_multiple_apps "${APPS[@]}"
    fi
}

# Run main function
main "$@"