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

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# File Download Functions
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
        $sudo mkdir -p "$CORE_NODE_TMP_DIR"
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
            if $sudo apt-get update -qq && $sudo apt-get install -y wget 2>&1 | grep -q "Setting up"; then
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
            if $sudo apt-get install -y curl 2>&1 | grep -q "Setting up"; then
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
        if ! $sudo mkdir -p "$file_dir"; then
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
        if ! $sudo cp "$file_path" "$backup_file"; then
            echo "[WARNING] Failed to create backup, proceeding anyway"
        fi
    fi

    # Move new file to target location
    if $sudo mv "$temp_file" "$file_path"; then
        $sudo chmod +x "$file_path"
        echo "[SUCCESS] File installed: $file_path"

        # Remove old backup if installation succeeded
        if [ -n "$backup_file" ] && [ -s "$backup_file" ]; then
            $sudo rm -f "$backup_file"
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
            $sudo mv "$backup_file" "$file_path"
        fi

        rm -f "$temp_file" 2>/dev/null
        return 1
    fi
}

check_and_download_files() {
    echo "Checking for required files..."

    # Build file paths from constants
    local gvar_common_file="$CORE_NODE_ROOT_DIR/$GVAR_COMMON_FILE_RELATIVE"
    local setting_base_file="$CORE_NODE_ROOT_DIR/$SETTING_BASE_FILE_RELATIVE"
    local project_validator_file="$CORE_NODE_ROOT_DIR/$PROJECT_VALIDATOR_FILE_RELATIVE"

    # Use the IS_INSTALLATION_MODE variable set at script start
    local force_update=false
    if [ "$IS_INSTALLATION_MODE" = true ]; then
        force_update=true
        echo -e "\033[33m[INFO] Installation mode detected - will update all temporary scripts\033[0m"
    fi

    # Check gvar_common.sh
    if [ "$force_update" = true ] || ! is_file_valid "$gvar_common_file"; then
        if [ "$force_update" = true ]; then
            echo "Updating gvar_common.sh to latest version..."
        else
            echo "gvar_common.sh not found or invalid, downloading..."
        fi
        if download_file "$gvar_common_file" "scripts/shells/linux/common/gvar_common.sh"; then
            echo "gvar_common.sh downloaded successfully"
        else
            echo "Failed to download gvar_common.sh"
            return 1
        fi
    else
        echo "gvar_common.sh already exists and is valid"
    fi

    # Check 2_setting_base.sh
    if [ "$force_update" = true ] || ! is_file_valid "$setting_base_file"; then
        if [ "$force_update" = true ]; then
            echo "Updating 2_setting_base.sh to latest version..."
        else
            echo "2_setting_base.sh not found or invalid, downloading..."
        fi
        if download_file "$setting_base_file" "scripts/shells/linux/debian/install_shells/2_setting_base.sh"; then
            echo "2_setting_base.sh downloaded successfully"
        else
            echo "Failed to download 2_setting_base.sh"
            return 1
        fi
    else
        echo "2_setting_base.sh already exists and is valid"
    fi

    # Check 8_project_validator.sh
    if [ "$force_update" = true ] || ! is_file_valid "$project_validator_file"; then
        if [ "$force_update" = true ]; then
            echo "Updating 8_project_validator.sh to latest version..."
        else
            echo "8_project_validator.sh not found or invalid, downloading..."
        fi
        if download_file "$project_validator_file" "scripts/shells/linux/debian/install_shells/8_project_validator.sh"; then
            echo "8_project_validator.sh downloaded successfully"
        else
            echo "Failed to download 8_project_validator.sh"
            return 1
        fi
    else
        echo "8_project_validator.sh already exists and is valid"
    fi

    if [ "$force_update" = true ]; then
        echo -e "\033[32mAll required files updated to latest version\033[0m"
    else
        echo "All required files are available and valid"
    fi
    return 0
}

show_region_selection_menu() {
    echo ""
    echo "=========================================="
    echo "Select Download Region:"
    echo "=========================================="
    echo "1) Global (GitHub)"
    echo "2) China (Gitee)"
    echo "=========================================="
    echo -n "Enter your choice (1-2): "
    
    read -r choice
    case "$choice" in
        1)
            set_global_var "SELECTED_REGION" "Global"
            echo "Selected region: Global (GitHub)"
            ;;
        2)
            set_global_var "SELECTED_REGION" "China"
            echo "Selected region: China (Gitee)"
            ;;
        *)
            echo "Invalid choice, defaulting to Global"
            set_global_var "SELECTED_REGION" "Global"
            ;;
    esac
}
