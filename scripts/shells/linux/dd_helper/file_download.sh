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

# =============================================================================
# File Download Functions
# =============================================================================

# is_file_valid comes from file_validation.sh (loaded before this file).
download_file() {
    local file_path="$1"
    local relative_path="$2"
    local selected_region=$(get_global_var "SELECTED_REGION" "Global")

    # Determine base URL based on region
    local base_url=""
    case "$selected_region" in
        "Global")
            base_url="$GITHUB_BASE_URL"
            ;;
        "China")
            base_url="$GITEE_BASE_URL"
            ;;
        *)
            base_url="$GITHUB_BASE_URL"
            ;;
    esac

    local download_url="$base_url/$relative_path"

    # Ensure temporary directory exists
    if [ ! -d "$CORE_NODE_TMP_DIR" ]; then
        $USE_SUDO mkdir -p "$CORE_NODE_TMP_DIR"
    fi

    # Use core_node temporary directory for downloads
    local temp_file="$CORE_NODE_TMP_DIR/core_node_download_$(basename "$file_path").$$"

    echo "Downloading $relative_path..."
    echo "Source URL: $download_url"
    echo "Target file: $file_path"
    echo "Temp file: $temp_file"

    # Download flags
    local download_success=false
    local download_method=""

    # Try wget first (more reliable than snap curl)
    if command -v wget >/dev/null 2>&1; then
        echo "Attempting download with wget..."
        if wget -q -O "$temp_file" "$download_url" 2>&1; then
            if [ -s "$temp_file" ]; then
                echo "Download successful using wget"
                download_success=true
                download_method="wget"
            else
                echo "wget completed but file is empty"
                rm -f "$temp_file" 2>/dev/null
            fi
        else
            echo "wget download failed"
            rm -f "$temp_file" 2>/dev/null
        fi
    else
        echo "wget not found, will try curl..."
    fi

    # If wget failed or not available, try curl
    if [ "$download_success" = false ] && command -v curl >/dev/null 2>&1; then
        echo "Attempting download with curl..."
        if curl -f -s -L -o "$temp_file" "$download_url" 2>&1; then
            if [ -s "$temp_file" ]; then
                echo "Download successful using curl"
                download_success=true
                download_method="curl"
            else
                echo "curl completed but file is empty"
                rm -f "$temp_file" 2>/dev/null
            fi
        else
            local curl_error=$?
            echo "curl download failed with exit code: $curl_error"
            echo "Note: If using snap curl, it may have sandbox restrictions"
            rm -f "$temp_file" 2>/dev/null
        fi
    fi

    # If both failed, try installing wget first (preferred)
    if [ "$download_success" = false ]; then
        echo "Primary download methods failed. Installing wget..."
        if command -v apt-get >/dev/null 2>&1; then
            if $USE_SUDO apt-get update -qq && $USE_SUDO apt-get install -y wget 2>&1 | grep -q "Setting up"; then
                echo "wget installed successfully, retrying download..."
                if wget -q -O "$temp_file" "$download_url" 2>&1; then
                    if [ -s "$temp_file" ]; then
                        echo "Download successful using newly installed wget"
                        download_success=true
                        download_method="wget (newly installed)"
                    fi
                fi
            fi
        fi
    fi

    # Last resort: try installing native curl (non-snap)
    if [ "$download_success" = false ]; then
        echo "wget installation failed. Attempting to install native curl..."
        if command -v apt-get >/dev/null 2>&1; then
            if $USE_SUDO apt-get install -y curl 2>&1 | grep -q "Setting up"; then
                echo "Native curl installed, retrying download..."
                if curl -f -s -L -o "$temp_file" "$download_url" 2>&1; then
                    if [ -s "$temp_file" ]; then
                        echo "Download successful using native curl"
                        download_success=true
                        download_method="curl (native)"
                    fi
                fi
            fi
        fi
    fi

    # Check if download was successful
    if [ "$download_success" = false ]; then
        echo "[ERROR] All download methods failed"
        echo "  URL: $download_url"
        echo "  Target: $file_path"
        echo "  Temp file: $temp_file"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check internet connectivity"
        echo "  2. Verify the URL is accessible"
        echo "  3. Ensure wget or curl is properly installed"
        echo "  4. If using snap curl, consider installing native version:"
        echo "     sudo apt update && sudo apt install -y wget curl"
        rm -f "$temp_file" 2>/dev/null
        return 1
    fi

    # Verify downloaded file
    if [ ! -s "$temp_file" ]; then
        echo "[ERROR] Downloaded file verification failed"
        local file_size=$(stat -c%s "$temp_file" 2>/dev/null)
        if [ -z "$file_size" ]; then
            file_size="0"
        fi
        echo "  File size: $file_size bytes"
        rm -f "$temp_file" 2>/dev/null
        return 1
    fi

    local file_size=$(stat -c%s "$temp_file" 2>/dev/null)
    echo "Downloaded successfully using $download_method ($file_size bytes)"

    # Create target directory if needed
    local file_dir=$(dirname "$file_path")
    if [ ! -d "$file_dir" ]; then
        echo "Creating directory: $file_dir"
        if ! $USE_SUDO mkdir -p "$file_dir"; then
            echo "[ERROR] Failed to create directory: $file_dir"
            rm -f "$temp_file" 2>/dev/null
            return 1
        fi
    fi

    # Move file to target location with safe replacement
    echo "Installing file to: $file_path"

    # If target file already exists, backup first
    local backup_file=""
    if [ -s "$file_path" ]; then
        backup_file="${file_path}.backup.$(date +%Y%m%d_%H%M%S)"
        echo "Backing up existing file to: $backup_file"
        if ! $USE_SUDO cp "$file_path" "$backup_file"; then
            echo "[WARNING] Failed to create backup, proceeding anyway"
        fi
    fi

    # Move new file to target location
    if $USE_SUDO mv "$temp_file" "$file_path"; then
        $USE_SUDO chmod +x "$file_path"
        echo "[SUCCESS] File installed: $file_path"

        # Remove old backup if installation succeeded
        if [ -n "$backup_file" ] && [ -s "$backup_file" ]; then
            $USE_SUDO rm -f "$backup_file"
            echo "Removed backup file"
        fi
        return 0
    else
        echo "[ERROR] Failed to move file to target location"
        echo "  Source: $temp_file"
        echo "  Target: $file_path"

        # Restore backup if move failed
        if [ -n "$backup_file" ] && [ -s "$backup_file" ]; then
            echo "Restoring backup file"
            $USE_SUDO mv "$backup_file" "$file_path"
        fi

        rm -f "$temp_file" 2>/dev/null
        return 1
    fi
}

# Repair missing/invalid required startup files from the selected region.
check_and_download_files() {
    local relative_path=""
    local file_path=""
    local -a required_files=(
        "$GVAR_COMMON_FILE_RELATIVE"
        "$SETTING_BASE_FILE_RELATIVE"
        "$PROJECT_VALIDATOR_FILE_RELATIVE"
    )

    for relative_path in "${required_files[@]}"; do
        file_path="$CORE_NODE_ROOT_DIR/$relative_path"
        if is_file_valid "$file_path" >/dev/null; then
            echo "${relative_path##*/} already exists and is valid"
            continue
        fi
        echo "${relative_path##*/} not found or invalid, downloading..."
        if download_file "$file_path" "$relative_path"; then
            echo "${relative_path##*/} downloaded successfully"
        else
            echo "Failed to download ${relative_path##*/}"
            return 1
        fi
    done
    echo "All required files are available and valid"
    return 0
}

show_region_selection_menu() {
    local selected_index=0
    local menu_items=(
        "Global (GitHub)"
        "China (Gitee)"
    )

    arrow_menu_select "Select Download Region" menu_items 0 -1
    selected_index="$ARROW_MENU_SELECTED_INDEX"
    case "$selected_index" in
        0)
            set_global_var "SELECTED_REGION" "Global"
            echo "Selected region: Global (GitHub)"
            ;;
        1)
            set_global_var "SELECTED_REGION" "China"
            echo "Selected region: China (Gitee)"
            ;;
    esac
}
