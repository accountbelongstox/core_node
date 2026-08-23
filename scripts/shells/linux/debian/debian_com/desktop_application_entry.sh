#!/bin/bash

# Intelligent icon finder - searches common locations for application icons
find_app_icon() {
    local app_name="$1"
    local app_display_name="$2"
    local provided_icon="$3"
    
    # If icon is provided and exists, use it
    if [[ -n "$provided_icon" ]] && [[ -f "$provided_icon" ]]; then
        echo "$provided_icon"
        return 0
    fi
    
    # If provided icon is just a name (no path), search for it
    if [[ -n "$provided_icon" ]] && [[ "$provided_icon" != *"/"* ]]; then
        # Search in common icon directories
        local icon_search_paths=(
            "/usr/share/pixmaps/${provided_icon}.png"
            "/usr/share/pixmaps/${provided_icon}.svg"
            "/usr/share/pixmaps/${provided_icon}"
            "/usr/share/icons/hicolor/*/apps/${provided_icon}.png"
            "/usr/share/icons/hicolor/*/apps/${provided_icon}.svg"
            "~/.local/share/icons/hicolor/*/apps/${provided_icon}.png"
            "~/.local/share/icons/hicolor/*/apps/${provided_icon}.svg"
        )
        
        for icon_pattern in "${icon_search_paths[@]}"; do
            # Expand wildcards
            for icon_path in $icon_pattern; do
                if [[ -f "$icon_path" ]]; then
                    echo "$icon_path"
                    return 0
                fi
            done
        done
    fi
    
    # Try searching by app_name
    local search_names=("$app_name" "${app_name,,}" "${app_name^^}")
    
    # Add common variants
    case "$app_name" in
        vscode|code)
            search_names+=("vscode" "code" "visual-studio-code" "com.visualstudio.code")
            ;;
        cursor)
            search_names+=("cursor" "cursor-editor")
            ;;
        wechat)
            search_names+=("wechat" "weixin" "com.tencent.wechat")
            ;;
    esac
    
    # Search in common icon directories
    local icon_dirs=(
        "/usr/share/pixmaps"
        "/usr/share/icons/hicolor/48x48/apps"
        "/usr/share/icons/hicolor/64x64/apps"
        "/usr/share/icons/hicolor/128x128/apps"
        "/usr/share/icons/hicolor/256x256/apps"
        "/usr/share/icons/hicolor/scalable/apps"
        "$HOME/.local/share/icons/hicolor/48x48/apps"
        "$HOME/.local/share/icons/hicolor/64x64/apps"
        "$HOME/.local/share/icons/hicolor/128x128/apps"
        "$HOME/.local/share/icons/hicolor/scalable/apps"
    )
    
    # Try each search name
    for search_name in "${search_names[@]}"; do
        for icon_dir in "${icon_dirs[@]}"; do
            if [[ ! -d "$icon_dir" ]]; then
                continue
            fi
            
            # Search for png, svg files
            for ext in png svg; do
                local icon_file="$icon_dir/${search_name}.$ext"
                if [[ -f "$icon_file" ]]; then
                    echo "$icon_file"
                    return 0
                fi
            done
        done
    done
    
    # Try finding icon in application-specific directories
    local app_specific_dirs=(
        "/opt/${app_name}"
        "/opt/${app_name,,}"
        "/usr/share/${app_name}"
        "/usr/share/${app_name,,}"
        "$HOME/.local/share/${app_name}"
    )
    
    for app_dir in "${app_specific_dirs[@]}"; do
        if [[ -d "$app_dir" ]]; then
            # Find any icon file in the directory
            local found_icon=$(find "$app_dir" -type f \( -name "*.png" -o -name "*.svg" \) 2>/dev/null | head -1)
            if [[ -n "$found_icon" ]]; then
                echo "$found_icon"
                return 0
            fi
        fi
    done
    
    # Last resort: use app_name as symbolic icon name (let desktop environment resolve it)
    echo "${app_name,,}"
    return 0
}

# Extract original binary from launcher script (prevent recursion)
extract_original_binary() {
    local binary_path="$1"

    # Check if this is a launcher script created by desktop_entry_manager
    if [[ ! -f "$binary_path" ]]; then
        echo "$binary_path"
        return 0
    fi

    # Check if it's a launcher script (signature comment check)
    if ! grep -q "# Created by Desktop Entry Manager" "$binary_path" 2>/dev/null; then
        # Not a launcher script, return as-is
        echo "$binary_path"
        return 0
    fi

    # It's a launcher script - extract the original binary
    # Look for the exec line with the actual binary path
    local original_binary=""

    # Pattern 1: pkexec mode - look for binary path on the last non-comment line with content
    # The launcher script has the binary path as the first argument after environment variables
    original_binary=$(grep -E '^\s+[^#]*\s+\S+\s+' "$binary_path" | tail -1 | awk '{print $1}')

    # Pattern 2: normal mode - look for exec line
    if [[ -z "$original_binary" ]]; then
        original_binary=$(grep -E '^exec\s+' "$binary_path" | head -1 | awk '{print $2}')
    fi

    # If extraction failed or is still pointing to launcher dir, return original
    if [[ -z "$original_binary" ]] || [[ "$original_binary" == *"$LAUNCH_DIR"* ]]; then
        echo "$binary_path"
        return 0
    fi

    # Verify the extracted binary exists and is executable
    if [[ -x "$original_binary" ]]; then
        echo -e "${COLOR_YELLOW}  [RECURSION PREVENTION] Detected launcher script, using original binary: $original_binary${COLOR_RESET}" >&2
        echo "$original_binary"
        return 0
    fi

    # Fallback to original if extraction didn't work
    echo "$binary_path"
    return 0
}

# Create desktop entry for an installed application (called by install scripts)
create_entry_for_app() {
    local app_name="$1"
    local app_display_name="$2"
    local app_binary="$3"
    local app_icon="$4"
    local app_category="${5:-Development}"
    local app_description="${6:-Launch $app_display_name}"
    local app_wm_class="${7:-}"
    local app_userdata_dir="${8:-}"
    local use_root_mode="${9:-true}"  # Default to root mode for backward compatibility

    if [[ -z "$app_name" ]] || [[ -z "$app_display_name" ]] || [[ -z "$app_binary" ]]; then
        echo -e "${COLOR_RED}[ERROR] Missing required parameters${COLOR_RESET}" >&2
        echo "Usage: --create-app <name> <display_name> <binary> <icon> [category] [description] [wm_class] [userdata_dir] [use_root_mode]" >&2
        return 1
    fi

    if [[ ! -x "$app_binary" ]]; then
        echo -e "${COLOR_RED}[ERROR] Binary not found or not executable: $app_binary${COLOR_RESET}" >&2
        return 1
    fi

    # RECURSION PREVENTION: Extract original binary if app_binary is already a launcher
    app_binary=$(extract_original_binary "$app_binary")
    
    # Intelligent icon finding
    echo -e "${COLOR_GRAY}  Searching for icon...${COLOR_RESET}" >&2
    app_icon=$(find_app_icon "$app_name" "$app_display_name" "$app_icon")
    echo -e "${COLOR_GRAY}  Using icon: $app_icon${COLOR_RESET}" >&2
    
    echo -e "${COLOR_CYAN}Creating desktop entry for: $app_display_name${COLOR_RESET}" >&2
    
    # Create launcher script
    local launcher_name="${app_name}_launcher.sh"
    local launch_script="$LAUNCH_DIR/$launcher_name"
    
    echo -e "${COLOR_GRAY}  Creating launch script: $launch_script${COLOR_RESET}" >&2

    # Build launch command arguments
    local app_args="--no-sandbox"
    if [[ -n "$app_userdata_dir" ]]; then
        echo -e "${COLOR_GRAY}  Using user data directory: $app_userdata_dir${COLOR_RESET}" >&2
        app_args="$app_args --user-data-dir=\"$app_userdata_dir\""
    fi

    # Use sudo only if not root
    local USE_SUDO=""
    if [[ "$EUID" -ne 0 ]]; then
        USE_SUDO="sudo"
    fi

    # Generate launcher based on root mode
    if [[ "$use_root_mode" == "true" ]]; then
        # Root mode: Use pkexec with preserved environment
        $USE_SUDO tee "$launch_script" > /dev/null << 'EOF'
#!/bin/bash
# Launcher for: $app_display_name
# Created by Desktop Entry Manager
# Mode: Root (pkexec)

# Preserve current user's environment
SAVED_USER="${SUDO_USER:-$USER}"
SAVED_HOME="$(getent passwd "$SAVED_USER" 2>/dev/null | cut -d: -f6)"
[[ -z "$SAVED_HOME" ]] && SAVED_HOME="$HOME"

# Preserve display environment for GUI
SAVED_DISPLAY="${DISPLAY:-:0}"
SAVED_XAUTHORITY="${XAUTHORITY:-$SAVED_HOME/.Xauthority}"
SAVED_XDG_RUNTIME_DIR="/run/user/$(id -u $SAVED_USER)"

# Launch with pkexec (root privileges) and preserve necessary environment
exec pkexec env \
    DISPLAY="$SAVED_DISPLAY" \
    XAUTHORITY="$SAVED_XAUTHORITY" \
    XDG_RUNTIME_DIR="$SAVED_XDG_RUNTIME_DIR" \
EOF

        # Append the actual command
        $USE_SUDO bash -c "cat >> '$launch_script'" << EOF
    $app_binary $app_args "\$@"
EOF
    else
        # Normal mode: Direct execution without pkexec
        $USE_SUDO tee "$launch_script" > /dev/null << 'EOF'
#!/bin/bash
# Launcher for: $app_display_name
# Created by Desktop Entry Manager
# Mode: Normal (no root)

# Launch application directly
EOF

        # Append the actual command
        $USE_SUDO bash -c "cat >> '$launch_script'" << EOF
exec $app_binary $app_args "\$@"
EOF
    fi

    $USE_SUDO chmod +x "$launch_script"
    
    # Create desktop entry
    local desktop_file="$DESKTOP_DIR/core_node_${app_name}.desktop"
    
    echo -e "${COLOR_GRAY}  Creating desktop entry: $desktop_file${COLOR_RESET}" >&2
    
    # Determine WM_CLASS if not provided
    if [[ -z "$app_wm_class" ]]; then
        case "$app_name" in
            vscode|code)
                app_wm_class="Code"
                ;;
            cursor)
                app_wm_class="Cursor"
                ;;
            *)
                # Capitalize first letter of app_name as fallback
                app_wm_class="$(echo "$app_name" | sed 's/^./\U&/')"
                ;;
        esac
    fi
    
    cat > "$desktop_file" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$app_display_name
Comment=$app_description
Exec=$launch_script
Icon=$app_icon
Terminal=false
Categories=$app_category;CoreNode;
Keywords=corenode;$app_name;
StartupNotify=true
StartupWMClass=$app_wm_class
EOF

    chmod +x "$desktop_file"

    # If running as root, fix ownership of desktop file
    if [[ "$EUID" -eq 0 ]] && [[ -n "$DESKTOP_USER" ]] && [[ "$DESKTOP_USER" != "root" ]]; then
        chown "$DESKTOP_USER:$DESKTOP_USER" "$desktop_file"
        echo -e "${COLOR_GRAY}  Set ownership to: $DESKTOP_USER${COLOR_RESET}" >&2
    fi
    
    echo -e "${COLOR_GREEN}  Created: $app_display_name${COLOR_RESET}" >&2
    echo -e "${COLOR_GREEN}Desktop entry created successfully${COLOR_RESET}" >&2
    return 0
}

