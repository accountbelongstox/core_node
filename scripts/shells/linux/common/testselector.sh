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

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
source "$SCRIPT_DIR/gvar_common.sh"

# Test Scripts Selector (input-based: type a number or name fragment, first match runs)

# Global variables for script selection
TEST_SELECTOR_INPUT=""
TEST_SELECTOR_MATCHED_SCRIPT=""

# Get install_shells directory path
get_install_shells_dir() {
    local script_dir="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
    local shells_dir="$(dirname "$script_dir")"
    echo "$shells_dir/debian/install_shells"
}

# Get sorted list of install_shells scripts
get_install_scripts() {
    local install_shells_dir=$(get_install_shells_dir)
    local scripts=()
    
    if [ -d "$install_shells_dir" ]; then
        while IFS= read -r -d $'\0' file; do
            local filename=$(basename "$file")
            # Extract the leading number (1_ or 100_ format)
            if [[ $filename =~ ^([0-9]+)_ ]]; then
                local prefix=${BASH_REMATCH[1]}
                scripts+=("$prefix:$file")
            fi
        done < <(find "$install_shells_dir" -maxdepth 1 -name "*.sh" -print0)

        # Sort scripts by numeric prefix
        IFS=$'\n' sorted=($(sort -t: -k1,1n -k2,2 <<<"${scripts[*]}"))
        unset IFS

        # Extract just the file paths
        local result=()
        for item in "${sorted[@]}"; do
            result+=("${item#*:}")
        done
        printf '%s\n' "${result[@]}"
    fi
}

show_test_scripts_context() {
    echo "GLOBAL_VAR_DIR: ${GLOBAL_VAR_DIR}"
}

# Trim leading/trailing whitespace from TEST_SELECTOR_INPUT
test_selector_trim_input() {
    TEST_SELECTOR_INPUT="${TEST_SELECTOR_INPUT#"${TEST_SELECTOR_INPUT%%[![:space:]]*}"}"
    TEST_SELECTOR_INPUT="${TEST_SELECTOR_INPUT%"${TEST_SELECTOR_INPUT##*[![:space:]]}"}"
}

# Match TEST_SELECTOR_INPUT against the sorted script list; first match wins.
# Digits: exact numeric-prefix match first (93 -> 93_x.sh, not 193_x.sh), then substring fallback.
# Text: case-insensitive substring match on the script basename.
# Result stored in TEST_SELECTOR_MATCHED_SCRIPT; returns 0 on match, 1 otherwise.
find_matching_script() {
    local user_input="$1"
    shift
    local -a candidate_scripts=("$@")
    local input_lower="${user_input,,}"
    local candidate=""
    local candidate_name=""

    TEST_SELECTOR_MATCHED_SCRIPT=""

    if [[ "$input_lower" =~ ^[0-9]+$ ]]; then
        for candidate in "${candidate_scripts[@]}"; do
            candidate_name="$(basename "$candidate")"
            if [[ "$candidate_name" =~ ^${input_lower}_ ]]; then
                TEST_SELECTOR_MATCHED_SCRIPT="$candidate"
                return 0
            fi
        done
    fi

    for candidate in "${candidate_scripts[@]}"; do
        candidate_name="$(basename "${candidate,,}")"
        if [[ "$candidate_name" == *"$input_lower"* ]]; then
            TEST_SELECTOR_MATCHED_SCRIPT="$candidate"
            return 0
        fi
    done

    return 1
}

# Execute selected test script
execute_test_script() {
    local script_path="$1"
    local script_name=$(basename "$script_path")
    
    clear
    echo "  Executing: $script_name"
    echo "  Path: $script_path"
    echo ""
    
    if [ ! -f "$script_path" ]; then
        echo "Error: Script not found: $script_path"
        echo "Press any key to continue..."
        read -n 1
        return 1
    fi
    
    if [ ! -x "$script_path" ]; then
        echo "Making script executable..."
        chmod +x "$script_path"
    fi
    
    echo "Starting execution of $script_name..."
    
    # Execute the script
    "$script_path"
    local exit_code=$?
    
    echo ""
    echo "Script execution completed with exit code: $exit_code"
    echo "Press any key to return to test scripts menu..."
    read -n 1
    
    return $exit_code
}

# Main test scripts menu loop (input-based selection)
test_scripts_main() {
    local scripts=($(get_install_scripts))
    local script_count=${#scripts[@]}
    local script_index
    
    if [ $script_count -eq 0 ]; then
        clear
        echo "  Test Scripts Menu"
        echo ""
        echo "No installation scripts found in install_shells directory."
        echo "Press any key to exit..."
        read -n 1
        exit 0
    fi
    
    while true; do
        clear
        echo "=========================================="
        echo "Test Installation Scripts"
        echo "=========================================="
        show_test_scripts_context
        echo ""
        echo "Enter a number or name to select a script (first match runs):"
        echo "Press Enter (empty input), q or lowercase b to go back"
        echo ""
        for script_index in "${!scripts[@]}"; do
            echo "  $(basename "${scripts[$script_index]}")"
        done
        echo ""
        read -r -p "Select script (number/name, b=back): " TEST_SELECTOR_INPUT
        test_selector_trim_input

        # Back keys: empty input, q/Q, and lowercase b (b is reserved and never
        # participates in keyword matching). Uppercase B still matches by keyword.
        if [ -z "$TEST_SELECTOR_INPUT" ] || [ "$TEST_SELECTOR_INPUT" = "q" ] || [ "$TEST_SELECTOR_INPUT" = "Q" ] || [ "$TEST_SELECTOR_INPUT" = "b" ]; then
            return 0
        fi

        if find_matching_script "$TEST_SELECTOR_INPUT" "${scripts[@]}"; then
            execute_test_script "$TEST_SELECTOR_MATCHED_SCRIPT"
        else
            echo ""
            echo "No matching script found for: $TEST_SELECTOR_INPUT"
            echo "Press any key to continue..."
            read -n 1
        fi
    done
}

# Main Program Entry Point

test_scripts_main
