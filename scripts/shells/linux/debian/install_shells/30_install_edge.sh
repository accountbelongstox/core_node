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
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="30"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

INSTALL_EDGE=$(get_var "INSTALL_EDGE")
INSTALL_MODE=$(get_var "INSTALL_MODE")
EDGE_DOWNLOAD_URL="https://go.microsoft.com/fwlink?linkid=2149051&brand=M102"

echo "[$SCRIPT_INDEX] Microsoft Edge Installation Script"
echo "[$SCRIPT_INDEX] INSTALL_EDGE: $INSTALL_EDGE, INSTALL_MODE: $INSTALL_MODE"

if [ "$INSTALL_EDGE" = "false" ]; then
    echo "[$SCRIPT_INDEX] INSTALL_EDGE is false - skipping Edge installation"
    echo "[$SCRIPT_INDEX] Checking if Edge is still installed..."

    # Check if Edge is still installed
    if command -v microsoft-edge &> /dev/null; then
        echo "[$SCRIPT_INDEX] Edge is still installed, removing..."
        $USE_SUDO apt remove -y microsoft-edge-stable 2>/dev/null || true
        $USE_SUDO apt purge -y microsoft-edge-stable 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Edge removed successfully"
    else
        echo "[$SCRIPT_INDEX] Edge is not installed"
    fi

    # Clean up any remaining Edge-related files
    $USE_SUDO rm -f "/usr/local/bin/microsoft-edge" 2>/dev/null || true

    # Clear stored variables
    set_var "EDGE_BIN" ""
    set_var "EDGE_VERSION" ""

    echo "[$SCRIPT_INDEX] Microsoft Edge cleanup completed"
    exit 0
fi

# Function to kill hanging Edge processes
kill_edge_processes() {
    local count=$(pgrep -c "microsoft-edge" 2>/dev/null | tr -d '\n' || echo "0")
    if [ "$count" -gt 3 ]; then
        echo "[$SCRIPT_INDEX] Found $count Edge processes, cleaning up..."
        $USE_SUDO pkill -f "microsoft-edge" 2>/dev/null || true
        echo "[$SCRIPT_INDEX] All Edge processes have been terminated"
    elif [ "$count" -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Found $count Edge process(es), normal range"
    fi
}

# Function to check Edge version
check_edge_version() {
    if command -v microsoft-edge &> /dev/null; then
        local version=$(microsoft-edge --version 2>/dev/null || echo "unknown version")
        echo "[$SCRIPT_INDEX] Microsoft Edge is installed: $version"
        return 0
    fi
    return 1
}

# Install Edge if not present
install_edge() {
    echo "[$SCRIPT_INDEX] Installing Microsoft Edge..."

    local edge_deb=""

    # Try to find in Downloads directory first
    echo "[$SCRIPT_INDEX] Searching for Edge .deb in Downloads directories..."
    edge_deb=$(find_file_in_downloads_from_common_functions "microsoft-edge-stable*.deb" "newest")

    if [[ -z "$edge_deb" ]]; then
        echo "[$SCRIPT_INDEX] No Edge .deb found in Downloads, downloading automatically..."

        # Detect actual user and use their Downloads directory
        if [ -z "$ACTUAL_DESKTOP_USER_HOME" ]; then
            detect_actual_desktop_user
        fi

        local downloads_dir
        if [ -n "$ACTUAL_DESKTOP_USER_HOME" ] && [ -d "$ACTUAL_DESKTOP_USER_HOME" ]; then
            downloads_dir="$ACTUAL_DESKTOP_USER_HOME/Downloads"
            echo "[$SCRIPT_INDEX] Using actual user's Downloads directory: $downloads_dir"
            mkdir -p "$downloads_dir" 2>/dev/null || {
                echo "[$SCRIPT_INDEX] Warning: Cannot create Downloads directory, using /tmp"
                downloads_dir="/tmp"
            }
        else
            echo "[$SCRIPT_INDEX] Warning: Cannot detect actual user, using /tmp"
            downloads_dir="/tmp"
        fi

        local download_target="$downloads_dir/microsoft-edge-stable.deb"

        echo "[$SCRIPT_INDEX] Download target: $download_target"
        echo "[$SCRIPT_INDEX] Download URL: $EDGE_DOWNLOAD_URL"

        # Try automatic download with progress bar
        if wget --show-progress --progress=bar:force -O "$download_target" "$EDGE_DOWNLOAD_URL"; then
            if [ -f "$download_target" ] && [ -s "$download_target" ]; then
                edge_deb="$download_target"
                echo "[$SCRIPT_INDEX] Edge package downloaded successfully"
                echo "[$SCRIPT_INDEX] Package saved to: $edge_deb"
                echo "[$SCRIPT_INDEX] (Package will be preserved for future installations)"
            else
                echo "[$SCRIPT_INDEX] Download completed but file is empty or missing"
                rm -f "$download_target"
                edge_deb=""
            fi
        else
            echo "[$SCRIPT_INDEX] Automatic download failed"
            rm -f "$download_target"
            edge_deb=""
        fi

        # If download failed, prompt user to download manually
        if [[ -z "$edge_deb" ]]; then
            echo "[$SCRIPT_INDEX] Please download manually from: https://www.microsoft.com/edge"

            edge_deb=$(prompt_and_wait_for_download_from_common_functions \
                "https://www.microsoft.com/edge" \
                "microsoft-edge-stable*.deb" \
                0)

            if [[ -z "$edge_deb" ]]; then
                echo "[$SCRIPT_INDEX] Failed to obtain Edge package"
                return 1
            fi
        fi
    else
        echo "[$SCRIPT_INDEX] Found Edge .deb: $edge_deb"
    fi

    # Install the package
    echo "[$SCRIPT_INDEX] Installing Edge from: $edge_deb"
    if $USE_SUDO dpkg -i "$edge_deb" 2>&1 | tee /tmp/edge_install.log; then
        echo "[$SCRIPT_INDEX] Microsoft Edge installed successfully"
    else
        echo "[$SCRIPT_INDEX] dpkg installation had issues, fixing dependencies..."
        $USE_SUDO apt-get install -f -y

        # Verify installation after fix
        if ! check_edge_version; then
            echo "[$SCRIPT_INDEX] Error: Failed to install Microsoft Edge"
            cat /tmp/edge_install.log 2>/dev/null
            return 1
        fi
    fi

    # Note: Do NOT delete the downloaded .deb file - keep it for future use

    # Verify installation
    if check_edge_version; then
        echo "[$SCRIPT_INDEX] Microsoft Edge installed successfully"
        return 0
    else
        echo "[$SCRIPT_INDEX] Error: Failed to install Microsoft Edge"
        return 1
    fi
}

# Main logic
echo "[$SCRIPT_INDEX] Checking Microsoft Edge installation..."

# Kill hanging processes if any
kill_edge_processes

# Check if Edge is installed
if check_edge_version; then
    echo "[$SCRIPT_INDEX] Edge browser is already installed"
    
    # Store Edge binary path in global variables
    if command -v microsoft-edge &> /dev/null; then
        edge_path=$(which microsoft-edge)
        if [ -n "$edge_path" ]; then
            # Use the proper set_var function instead of directly writing to file
            set_var "EDGE_BIN" "$edge_path"
            set_var "EDGE_VERSION" "$(microsoft-edge --version 2>/dev/null || echo 'unknown')"
            echo "[$SCRIPT_INDEX] Edge binary path stored in global variables: $edge_path"
            
            # Create symlink in /usr/local/bin if it doesn't exist
            if [ ! -L "/usr/local/bin/microsoft-edge" ]; then
                $USE_SUDO ln -sf "$edge_path" "/usr/local/bin/microsoft-edge"
                echo "[$SCRIPT_INDEX] Created symlink: /usr/local/bin/microsoft-edge -> $edge_path"
            fi
        fi
    fi
else
    echo "[$SCRIPT_INDEX] Edge browser not found, proceeding with installation..."
    install_edge
    
    # Store info after installation
    if command -v microsoft-edge &> /dev/null; then
        edge_path=$(which microsoft-edge)
        set_var "EDGE_BIN" "$edge_path"
        set_var "EDGE_VERSION" "$(microsoft-edge --version 2>/dev/null || echo 'unknown')"
        echo "[$SCRIPT_INDEX] Edge installation info stored in global variables"
    fi
fi

# Final status check
echo "[$SCRIPT_INDEX] ==============================="
echo "[$SCRIPT_INDEX] Edge Browser Status:"
echo "[$SCRIPT_INDEX] ==============================="
check_edge_version

# Check running processes
local edge_processes=$(ps aux | grep -i "microsoft-edge" | grep -v grep | wc -l | tr -d '\n')
if [ "$edge_processes" -gt 0 ]; then
    echo "[$SCRIPT_INDEX] Found $edge_processes Edge processes running"
else
    echo "[$SCRIPT_INDEX] No Edge processes running"
fi

# Display stored variables
local edge_bin=$(get_var "EDGE_BIN" 2>/dev/null || echo "not set")
local edge_version=$(get_var "EDGE_VERSION" 2>/dev/null || echo "not set")
echo "[$SCRIPT_INDEX] Stored variables:"
echo "[$SCRIPT_INDEX]   EDGE_BIN: $edge_bin"
echo "[$SCRIPT_INDEX]   EDGE_VERSION: $edge_version"
echo "[$SCRIPT_INDEX] ==============================="

# Function to check and fix edge-tts Python package version
check_and_fix_edge_tts_version() {
    local required_version="7.2.1"
    local compatible_versions=("7.2.1" "7.2.0" "7.1.0" "7.0.0")

    echo "[$SCRIPT_INDEX] ==============================="
    echo "[$SCRIPT_INDEX] Checking edge-tts Python package..."
    echo "[$SCRIPT_INDEX] ==============================="

    # Check if edge-tts is installed
    if ! python3 -c "import edge_tts" 2>/dev/null; then
        echo "[$SCRIPT_INDEX] edge-tts not installed, installing version $required_version..."
        pip3 install "edge-tts==$required_version" --break-system-packages 2>&1 | tail -5
        echo "[$SCRIPT_INDEX] edge-tts $required_version installed"
        return 0
    fi

    # Get current version
    local current_version=$(python3 -c "import edge_tts; print(edge_tts.__version__)" 2>/dev/null || echo "unknown")
    echo "[$SCRIPT_INDEX] Current edge-tts version: $current_version"

    # Check if current version is compatible
    local is_compatible=0
    for ver in "${compatible_versions[@]}"; do
        if [ "$current_version" = "$ver" ]; then
            is_compatible=1
            break
        fi
    done

    if [ $is_compatible -eq 1 ]; then
        echo "[$SCRIPT_INDEX] edge-tts version $current_version is compatible, no action needed"
        return 0
    fi

    # Incompatible version detected (7.2.2+), need to downgrade
    echo "[$SCRIPT_INDEX] WARNING: edge-tts $current_version is incompatible (has NoAudioReceived bug)"
    echo "[$SCRIPT_INDEX] Reference: https://github.com/rany2/edge-tts/issues/443"
    echo "[$SCRIPT_INDEX] Downgrading to $required_version..."

    # Force reinstall with correct version
    pip3 install "edge-tts==$required_version" --break-system-packages --force-reinstall 2>&1 | tail -10

    # Verify installation
    local new_version=$(python3 -c "import edge_tts; print(edge_tts.__version__)" 2>/dev/null || echo "unknown")

    if [ "$new_version" = "$required_version" ]; then
        echo "[$SCRIPT_INDEX] SUCCESS: edge-tts downgraded from $current_version to $new_version"
    else
        echo "[$SCRIPT_INDEX] WARNING: Downgrade attempted but got version $new_version instead of $required_version"
    fi

    echo "[$SCRIPT_INDEX] ==============================="
}

# Check and fix edge-tts version
check_and_fix_edge_tts_version
 
