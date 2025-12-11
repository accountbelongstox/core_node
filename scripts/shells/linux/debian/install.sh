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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
SHELLS_DIR="$PARENT_DIR"

# Source gvar_common.sh from parent directory - use relative path
source "${PARENT_DIR}/common/gvar_common.sh"

selector_common_file="${SHELLS_DIR}/common/selector_common.sh"
INSTALL_SHELLS_DIR="${SCRIPT_CURRENT_DIR}/install_shells"
echo "INSTALL_SHELLS_DIR: $INSTALL_SHELLS_DIR"

# Function to read with timeout and default
read_with_timeout() {
    local prompt="$1"
    local default="$2"
    local timeout="$3"
    local reply

    # Read with timeout in background
    read -t "$timeout" -p "$prompt" reply &

    # Show countdown
    for ((i = timeout; i > 0; i--)); do
        printf "\r%s (auto-%s in %ds) " "$prompt" "$default" "$i"
        sleep 1
    done
    printf "\r%s (auto-%s)     \n" "$prompt" "$default"

    # Get the reply or use default
    if [ -z "$reply" ]; then
        reply="$default"
    fi

    echo "$reply"
}

# Function to find and sort installation scripts
get_installation_scripts() {
    local scripts=()
    if [ -d "$INSTALL_SHELLS_DIR" ]; then
        while IFS= read -r -d $'\0' file; do
            local filename=$(basename "$file")
            # Extract the leading number (1_ or 100_ format)
            if [[ $filename =~ ^([0-9]+)_ ]]; then
                local prefix=${BASH_REMATCH[1]}
                scripts+=("$prefix:$file")
            fi
        done < <(find "$INSTALL_SHELLS_DIR" -maxdepth 1 -name "*.sh" -print0)

        # Sort scripts by numeric prefix
        IFS=$'\n' sorted=($(sort -n -t: -k1 <<<"${scripts[*]}"))
        unset IFS

        # Extract just the file paths
        local result=()
        for item in "${sorted[@]}"; do
            result+=("${item#*:}")
        done
        echo "${result[@]}"
    else
        echo ""
    fi
}

# Function to execute installation scripts
execute_installation_scripts() {
    local scripts=($(get_installation_scripts))

    echo  "INSTALL_SHELLS_DIR : $INSTALL_SHELLS_DIR"
    if [ ${#scripts[@]} -eq 0 ]; then
        echo "No installation scripts found in $INSTALL_SHELLS_DIR"
        return
    fi

    echo "The following installation scripts will be executed in order:"
    for script in "${scripts[@]}"; do
        echo "  - $(basename "$script")"
    done
    echo

    for script in "${scripts[@]}"; do
        echo
        echo "Executing: $(basename "$script")"
        if [ ! -x "$script" ]; then
            chmod +x "$script"
        fi
        "$script" 
    done
}


# Main execution
echo "Core Node Installation Script"
echo
# Run selector to get configuration
"$selector_common_file"

# Get the selected mode after selector runs
INSTALL_MODE=$(get_var "INSTALL_MODE")
echo "Selected options:"
echo "  Installation mode: $INSTALL_MODE"
echo

# Note: Services (MySQL, Redis, PostgreSQL, Docker, Nginx) are always installed
# The START_* variables from selector_common.sh control whether to start them after installation
echo "Services will be installed, START_* variables control service startup..."


execute_installation_scripts

echo
echo "Installation completed successfully!"
