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
SCRIPT_INDEX="31"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_resource_limit.sh"
source "$PARENT_DIR_LEVEL_2/common/memory_governance.sh"

INSTALL_EDGE=$(get_var "INSTALL_EDGE")
INSTALL_MODE=$(get_var "INSTALL_MODE")
EDGE_DOWNLOAD_URL="https://go.microsoft.com/fwlink?linkid=2149051&brand=M102"
EDGE_GPU_FLAGS=""  # GPU hardware-acceleration flags baked into the launch wrapper
# Browser cgroup recipe, identical to Chrome (35): the browser is the PRIMARY
# app. The old 500M hard pin was below Edge's process baseline (dead on arrival).
# MemoryMax=min(62% RAM, 16G); MemoryHigh=73% of Max; CPUQuota=nproc*100% (inert,
# slice CPUWeight handles contention). Wrapper collapses High onto Max when swap=0.
BROWSER_MEM_PCT="62"
BROWSER_MEM_CAP_MB="16384"
BROWSER_HIGH_PCT="73"
BROWSER_CPU_PCT="100"
# Sleeping Tabs managed policy: documented by Microsoft for Windows/macOS only,
# best-effort on Linux (harmless if inert).
EDGE_POLICY_DIR="/etc/opt/edge/policies/managed"
EDGE_POLICY_FILE="$EDGE_POLICY_DIR/corenode_memory.json"
edge_tts_metadata=""

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

    # Clean up any remaining Edge-related files (incl. the managed memory policy)
    $USE_SUDO rm -f "/usr/local/bin/microsoft-edge" 2>/dev/null || true
    $USE_SUDO rm -f "$EDGE_POLICY_FILE" 2>/dev/null || true

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

# Sleeping Tabs via managed policy (best-effort on Linux; see note at top).
# Side effect: edge://settings shows "Managed by your organization".
configure_edge_memory_policy() {
    local desired
    desired='{
  "SleepingTabsEnabled": true,
  "SleepingTabsTimeout": 900
}'
    $USE_SUDO mkdir -p "$EDGE_POLICY_DIR" 2>/dev/null || true
    if [ ! -f "$EDGE_POLICY_FILE" ] || [ "$(cat "$EDGE_POLICY_FILE" 2>/dev/null)" != "$desired" ]; then
        printf '%s' "$desired" | $USE_SUDO tee "$EDGE_POLICY_FILE" >/dev/null
        echo "[$SCRIPT_INDEX] Wrote Sleeping Tabs policy: $EDGE_POLICY_FILE (Edge will show 'Managed by your organization')"
    else
        echo "[$SCRIPT_INDEX] Sleeping Tabs policy already set: $EDGE_POLICY_FILE"
    fi
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

# Memory governance prerequisites (shared with Chrome/35): zram so the memory
# caps reclaim gracefully instead of thrashing, systemd-oomd as PSI backstop.
# Runs BEFORE the install/verify branch so idempotent re-runs get it too.
if ! ensure_zram_swap; then
    echo "[$SCRIPT_INDEX] [WARN] NO ACTIVE SWAP: memory caps without swap cause reclaim thrash (browser freezes at the cap);"
    echo "[$SCRIPT_INDEX] [WARN] the launch wrapper falls back to hard-OOM-only mode until swap/zram is enabled."
fi
ensure_systemd_oomd
configure_edge_memory_policy

# Edge ships NO AppArmor profile (unlike Chrome): on kernels that restrict
# unprivileged user namespaces its sandbox cannot start.
if [ "$(sysctl -n kernel.apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ]; then
    echo "[$SCRIPT_INDEX] [WARN] Kernel restricts unprivileged user namespaces and Edge ships no AppArmor profile;"
    echo "[$SCRIPT_INDEX] [WARN] Edge may crash at startup. Provide an AppArmor profile for /opt/microsoft/msedge/msedge or launch with --no-sandbox."
fi

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
            
            # Create/repair symlink in /usr/local/bin. [ ! -e ] is false for a
            # working file/link but true for a DANGLING link, so this also repairs
            # stale links. Self-link guard: `which microsoft-edge` may return this
            # very path, and linking it onto itself would create a loop.
            if [ "$edge_path" != "/usr/local/bin/microsoft-edge" ] && [ ! -e "/usr/local/bin/microsoft-edge" ]; then
                $USE_SUDO ln -sfn "$edge_path" "/usr/local/bin/microsoft-edge"
                echo "[$SCRIPT_INDEX] Created symlink: /usr/local/bin/microsoft-edge -> $edge_path"
            fi

            # GPU hardware acceleration: same safe flags as Chrome (Edge is Chromium),
            # baked into the wrapper via --pre to stop software-rendering lag.
            EDGE_GPU_FLAGS="$(resolve_browser_gpu_flags)"

            # Resource limit: cap the whole Edge process tree in one cgroup-v2 user
            # scope and repoint the .deb-owned menu entry (id=microsoft-edge) at the
            # wrapper, using the browser recipe (BROWSER_* at top of file). Env-pct
            # overrides stay machine-relative; never use --mem/--high/--cpu here.
            APP_MEM_PCT="$BROWSER_MEM_PCT" APP_MEM_CAP_MB="$BROWSER_MEM_CAP_MB" \
            APP_HIGH_PCT="$BROWSER_HIGH_PCT" APP_CPU_PCT="$BROWSER_CPU_PCT" \
            apply_app_resource_limit \
                --id microsoft-edge --exec "$edge_path" \
                --pre "$EDGE_GPU_FLAGS" \
                --desktop all --field "%U"
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

        # GPU hardware acceleration: same safe flags as Chrome (Edge is Chromium).
        EDGE_GPU_FLAGS="$(resolve_browser_gpu_flags)"

        # Resource limit + repoint the .deb-owned menu entry after a fresh install
        # (id=microsoft-edge), using the same browser recipe (BROWSER_* at top of
        # file); idempotent; never double-wraps.
        APP_MEM_PCT="$BROWSER_MEM_PCT" APP_MEM_CAP_MB="$BROWSER_MEM_CAP_MB" \
        APP_HIGH_PCT="$BROWSER_HIGH_PCT" APP_CPU_PCT="$BROWSER_CPU_PCT" \
        apply_app_resource_limit \
            --id microsoft-edge --exec "$edge_path" \
            --pre "$EDGE_GPU_FLAGS" \
            --desktop all --field "%U"
    fi
fi

# Final status check
echo "[$SCRIPT_INDEX] ==============================="
echo "[$SCRIPT_INDEX] Edge Browser Status:"
echo "[$SCRIPT_INDEX] ==============================="
check_edge_version
echo "[$SCRIPT_INDEX] Swap (required for usable memory caps): $(swapon --show=NAME,SIZE --noheadings 2>/dev/null | tr '\n' ' ')"
# Kali/Debian-derivatives: Microsoft lists no per-distro support matrix for the
# Linux .deb; Edge runs as on Debian. Lag/memory behavior is governed by the
# resource wrapper + swap above, NOT by the distro.
if grep -q '^ID=kali' /etc/os-release 2>/dev/null; then
    echo "[$SCRIPT_INDEX] Note: Kali is not in Microsoft's documented targets; Edge runs as on Debian (unsupported-but-compatible)."
fi

# Check running processes
edge_processes=$(ps aux | grep -i "microsoft-edge" | grep -v grep | wc -l | tr -d '\n')
if [ "$edge_processes" -gt 0 ]; then
    echo "[$SCRIPT_INDEX] Found $edge_processes Edge processes running"
else
    echo "[$SCRIPT_INDEX] No Edge processes running"
fi

# Display stored variables
edge_bin=$(get_var "EDGE_BIN" 2>/dev/null || echo "not set")
edge_version=$(get_var "EDGE_VERSION" 2>/dev/null || echo "not set")
echo "[$SCRIPT_INDEX] Stored variables:"
echo "[$SCRIPT_INDEX]   EDGE_BIN: $edge_bin"
echo "[$SCRIPT_INDEX]   EDGE_VERSION: $edge_version"
echo "[$SCRIPT_INDEX] ==============================="

# Keep the optional edge-tts package idempotent; pip owns fine-version compatibility.
edge_tts_metadata="$(python3 -m pip show edge-tts 2>/dev/null || true)"
if [ -n "$edge_tts_metadata" ]; then
    echo "[$SCRIPT_INDEX] edge-tts is installed; preserving it."
else
    echo "[$SCRIPT_INDEX] edge-tts is missing; installing it."
    python3 -m pip install edge-tts --break-system-packages
fi
 
