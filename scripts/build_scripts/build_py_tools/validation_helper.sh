#!/usr/bin/env bash

# Validation Helper Functions
# Integrates Python validation modules with shell script execution
# Follows architecture: Python validates, Shell executes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

validate_project() {
    local PROJECT_PATH="$1"
    local PROJECT_TYPE="$2"
    local PROJECT_NAME="$3"

    echo ""
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}  PROJECT VALIDATION${COLOR_RESET}"
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo ""

    python3 "$SCRIPT_DIR/project_validator.py" "$PROJECT_PATH" "$PROJECT_TYPE" "$PROJECT_NAME"
    local VALIDATION_RESULT=$?

    if [ $VALIDATION_RESULT -ne 0 ]; then
        echo ""
        echo -e "${COLOR_RED}�?Project validation failed${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}Please fix the issues above before proceeding${COLOR_RESET}"
        return 1
    fi

    echo ""
    echo -e "${COLOR_GREEN}�?Project validation passed${COLOR_RESET}"
    return 0
}

check_and_install_dependencies() {
    local PROJECT_PATH="$1"
    local PROJECT_TYPE="$2"
    local PROJECT_NAME="$3"
    local AUTO_INSTALL="${4:-false}"

    echo ""
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}  DEPENDENCY CHECK${COLOR_RESET}"
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo ""

    # First validate the project to get validation info
    python3 "$SCRIPT_DIR/project_validator.py" "$PROJECT_PATH" "$PROJECT_TYPE" > /dev/null 2>&1

    # Get validation info from file variable
    local VALIDATION_JSON=$(get_global_var "POLY_APP_VALIDATION_${PROJECT_NAME^^}" "")

    if [ -z "$VALIDATION_JSON" ]; then
        echo -e "${COLOR_YELLOW}�?Could not read validation info, proceeding with basic checks${COLOR_RESET}"
        VALIDATION_JSON='{"info":{"package_manager":"npm","lock_files":[]}}'
    fi

    # Parse validation info to pass to dependency manager
    echo "$VALIDATION_JSON" > /tmp/poly_app_validation_temp.json

    # Run dependency check
    python3 "$SCRIPT_DIR/dependency_manager.py" "$PROJECT_PATH" "$PROJECT_TYPE" "$PROJECT_NAME"
    local DEPS_RESULT=$?

    if [ $DEPS_RESULT -ne 0 ]; then
        echo ""
        echo -e "${COLOR_YELLOW}�?Dependencies are missing or incomplete${COLOR_RESET}"

        # Try to get dependency status from file variable
        local DEPS_JSON=$(get_global_var "POLY_APP_DEPENDENCY_${PROJECT_NAME^^}" "")

        if [ -n "$DEPS_JSON" ]; then
            # Extract install command
            local INSTALL_CMD=$(echo "$DEPS_JSON" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('install_command', ''))" 2>/dev/null)

            if [ -n "$INSTALL_CMD" ]; then
                if [ "$AUTO_INSTALL" = "true" ]; then
                    echo ""
                    echo -e "${COLOR_CYAN}Auto-installing dependencies...${COLOR_RESET}"
                    echo -e "${COLOR_BLUE}Command: $INSTALL_CMD${COLOR_RESET}"
                    echo ""

                    cd "$PROJECT_PATH" || return 1
                    eval "$INSTALL_CMD"

                    if [ $? -eq 0 ]; then
                        echo ""
                        echo -e "${COLOR_GREEN}�?Dependencies installed successfully${COLOR_RESET}"
                        return 0
                    else
                        echo ""
                        echo -e "${COLOR_RED}�?Failed to install dependencies${COLOR_RESET}"
                        return 1
                    fi
                else
                    echo ""
                    echo -e "${COLOR_YELLOW}To install dependencies, run:${COLOR_RESET}"
                    echo -e "${COLOR_BLUE}  cd \"$PROJECT_PATH\"${COLOR_RESET}"
                    echo -e "${COLOR_BLUE}  $INSTALL_CMD${COLOR_RESET}"
                    echo ""
                    echo -e "${COLOR_YELLOW}Or pass AUTO_INSTALL=true to install automatically${COLOR_RESET}"
                    return 1
                fi
            fi
        fi

        return 1
    fi

    echo ""
    echo -e "${COLOR_GREEN}�?Dependencies are installed${COLOR_RESET}"
    return 0
}

validate_build_requirements() {
    local PROJECT_PATH="$1"
    local PROJECT_TYPE="$2"
    local PROJECT_NAME="$3"
    local ACTION="$4"

    echo ""
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}  BUILD REQUIREMENTS CHECK${COLOR_RESET}"
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo ""

    # Get validation info
    python3 "$SCRIPT_DIR/project_validator.py" "$PROJECT_PATH" "$PROJECT_TYPE" > /dev/null 2>&1

    # Run build requirements validation
    python3 "$SCRIPT_DIR/build_validator.py" "$PROJECT_PATH" "$PROJECT_TYPE" "$ACTION" "$PROJECT_NAME"
    local BUILD_REQ_RESULT=$?

    if [ $BUILD_REQ_RESULT -ne 0 ]; then
        echo ""
        echo -e "${COLOR_RED}�?Build requirements not met${COLOR_RESET}"
        return 1
    fi

    echo ""
    echo -e "${COLOR_GREEN}�?Build requirements satisfied${COLOR_RESET}"
    return 0
}

validate_build_output() {
    local PROJECT_PATH="$1"
    local PROJECT_TYPE="$2"
    local PROJECT_NAME="$3"

    echo ""
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}  BUILD OUTPUT VALIDATION${COLOR_RESET}"
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo ""

    # This function will be called after build to verify output
    # For now, we'll do basic directory checks

    case "$PROJECT_TYPE" in
        "nuxt")
            if [ -d "$PROJECT_PATH/.output" ]; then
                if [ -f "$PROJECT_PATH/.output/server/index.mjs" ]; then
                    echo -e "${COLOR_GREEN}�?Nuxt build output validated${COLOR_RESET}"
                    return 0
                else
                    echo -e "${COLOR_RED}�?Missing critical file: .output/server/index.mjs${COLOR_RESET}"
                    return 1
                fi
            else
                echo -e "${COLOR_RED}�?Build output directory not found: .output${COLOR_RESET}"
                return 1
            fi
            ;;

        "react"|"vue"|"vite")
            # Check for dist, build, or .output/public
            if [ -d "$PROJECT_PATH/dist" ]; then
                if [ -f "$PROJECT_PATH/dist/index.html" ]; then
                    echo -e "${COLOR_GREEN}�?Build output validated: dist/index.html exists${COLOR_RESET}"
                    return 0
                else
                    echo -e "${COLOR_YELLOW}�?Build output found but missing index.html${COLOR_RESET}"
                    return 0  # May not be critical for all projects
                fi
            elif [ -d "$PROJECT_PATH/build" ]; then
                if [ -f "$PROJECT_PATH/build/index.html" ]; then
                    echo -e "${COLOR_GREEN}�?Build output validated: build/index.html exists${COLOR_RESET}"
                    return 0
                else
                    echo -e "${COLOR_YELLOW}�?Build output found but missing index.html${COLOR_RESET}"
                    return 0
                fi
            elif [ -d "$PROJECT_PATH/.output/public" ]; then
                echo -e "${COLOR_GREEN}�?Build output validated: .output/public exists${COLOR_RESET}"
                return 0
            else
                echo -e "${COLOR_RED}�?Build output directory not found (checked: dist/, build/, .output/public/)${COLOR_RESET}"
                return 1
            fi
            ;;

        *)
            echo -e "${COLOR_YELLOW}�?No validation rules for project type: $PROJECT_TYPE${COLOR_RESET}"
            return 0
            ;;
    esac
}

run_full_validation() {
    local PROJECT_PATH="$1"
    local PROJECT_TYPE="$2"
    local PROJECT_NAME="$3"
    local ACTION="$4"
    local AUTO_INSTALL="${5:-false}"

    echo ""
    echo -e "${COLOR_CYAN}╔═══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
    echo -e "${COLOR_CYAN}�?                   COMPREHENSIVE VALIDATION SYSTEM                        �?{COLOR_RESET}"
    echo -e "${COLOR_CYAN}╚═══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
    echo ""
    echo -e "${COLOR_BLUE}Project: $PROJECT_NAME${COLOR_RESET}"
    echo -e "${COLOR_BLUE}Type: $PROJECT_TYPE${COLOR_RESET}"
    echo -e "${COLOR_BLUE}Path: $PROJECT_PATH${COLOR_RESET}"
    echo -e "${COLOR_BLUE}Action: $ACTION${COLOR_RESET}"
    echo ""

    # Step 1: Validate project structure
    if ! validate_project "$PROJECT_PATH" "$PROJECT_TYPE" "$PROJECT_NAME"; then
        echo ""
        echo -e "${COLOR_RED}══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
        echo -e "${COLOR_RED}  VALIDATION FAILED: Project structure issues${COLOR_RESET}"
        echo -e "${COLOR_RED}══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
        return 1
    fi

    # Step 2: Check dependencies
    if ! check_and_install_dependencies "$PROJECT_PATH" "$PROJECT_TYPE" "$PROJECT_NAME" "$AUTO_INSTALL"; then
        echo ""
        echo -e "${COLOR_RED}══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
        echo -e "${COLOR_RED}  VALIDATION FAILED: Dependency issues${COLOR_RESET}"
        echo -e "${COLOR_RED}══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
        return 1
    fi

    # Step 3: Validate build requirements (only for build/generate actions)
    if [[ "$ACTION" == "build" || "$ACTION" == "generate" ]]; then
        if ! validate_build_requirements "$PROJECT_PATH" "$PROJECT_TYPE" "$PROJECT_NAME" "$ACTION"; then
            echo ""
            echo -e "${COLOR_RED}══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
            echo -e "${COLOR_RED}  VALIDATION FAILED: Build requirements not met${COLOR_RESET}"
            echo -e "${COLOR_RED}══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
            return 1
        fi
    fi

    echo ""
    echo -e "${COLOR_GREEN}╔═══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
    echo -e "${COLOR_GREEN}�?                   �?ALL VALIDATIONS PASSED                               �?{COLOR_RESET}"
    echo -e "${COLOR_GREEN}╚═══════════════════════════════════════════════════════════════════════════�?{COLOR_RESET}"
    echo ""

    return 0
}

# Export functions for use in other scripts
export -f validate_project
export -f check_and_install_dependencies
export -f validate_build_requirements
export -f validate_build_output
export -f run_full_validation
