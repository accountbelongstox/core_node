#!/bin/bash

SCRIPT_ACTUAL_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_ACTUAL_DIR="$(dirname "$SCRIPT_ACTUAL_PATH")"
CORE_NODE_ROOT_DIR="$(dirname "$SCRIPT_ACTUAL_DIR")"

GVAR_COMMON_FILE="$CORE_NODE_ROOT_DIR/scripts/shells/linux/common/gvar_common.sh"
if [ -f "$GVAR_COMMON_FILE" ]; then
    source "$GVAR_COMMON_FILE"
fi

sudo=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    sudo="sudo"
fi

fix_core_node_root_permissions() {
    echo "[INFO] Fixing Core Node root & scripts permissions..."

    local target_paths=(
        "$CORE_NODE_ROOT_DIR"
        "$CORE_NODE_ROOT_DIR/scripts"
    )

    for path in "${target_paths[@]}"; do
        if [ -d "$path" ]; then
            echo "[INFO] Setting 777 permissions for: $path"
            $sudo chmod -R 777 "$path" 2>/dev/null
            $sudo find "$path" -name "*.sh" -exec chmod 755 {} \; 2>/dev/null
        fi
    done

    echo "[SUCCESS] Core Node root & scripts permissions fixed"
}

fix_full_core_node_permissions() {
    echo "[INFO] Fixing Full Core Node permissions..."

    local full_dirs=(
        "$CORE_NODE_ROOT_DIR"
        "$CORE_NODE_ROOT_DIR/scripts"
        "$CORE_NODE_ROOT_DIR/pycore"
        "$CORE_NODE_ROOT_DIR/ncore"
        "$CORE_NODE_ROOT_DIR/apps"
        "$CORE_NODE_ROOT_DIR/pyapps"
    )

    for dir in "${full_dirs[@]}"; do
        if [ -d "$dir" ]; then
            echo "[INFO] Setting 777 permissions for: $dir"
            $sudo chmod -R 777 "$dir" 2>/dev/null
            $sudo find "$dir" -name "*.sh" -exec chmod 755 {} \; 2>/dev/null
        else
            echo "[WARNING] Directory not found: $dir"
        fi
    done

    echo "[SUCCESS] Full Core Node permissions fixed"
}

fix_nginxconfig_permissions() {
    echo "[INFO] Fixing nginxconfig directory permissions..."

    local nginxconfig_dir
    if type map_web_path >/dev/null 2>&1; then
        nginxconfig_dir=$(map_web_path "nginxconfig")
    else
        nginxconfig_dir="/www/nginxconfig"
    fi

    if [ -d "$nginxconfig_dir" ]; then
        echo "[INFO] Nginxconfig directory: $nginxconfig_dir"
        echo "[INFO] Setting permissions for nginxconfig..."
        $sudo chmod -R 755 "$nginxconfig_dir" 2>/dev/null
        $sudo chown -R root:root "$nginxconfig_dir" 2>/dev/null

        local ssl_dir="$nginxconfig_dir/ssl"
        if [ -d "$ssl_dir" ]; then
            echo "[INFO] Setting SSL directory permissions: $ssl_dir"
            $sudo chmod -R 700 "$ssl_dir" 2>/dev/null
            $sudo find "$ssl_dir" -type f -name "*.key" -exec chmod 600 {} \; 2>/dev/null
            $sudo find "$ssl_dir" -type f -name "*.crt" -o -name "*.pem" -exec chmod 644 {} \; 2>/dev/null
        fi

        echo "[SUCCESS] Nginxconfig permissions fixed"
    else
        echo "[WARNING] Nginxconfig directory not found: $nginxconfig_dir"
    fi
}

show_menu() {
    clear
    echo "=========================================="
    echo "Linux Management Permissions Repair Menu"
    echo "=========================================="
    echo "1) Essential Repair (Fast) - Core Node root & scripts only"
    echo "2) Full Core Node Repair - All project directories"
    echo "3) Nginxconfig Repair - Fix /www/nginxconfig permissions"
    echo "4) Full Repair - All above combined"
    echo "0) Exit"
    echo "=========================================="
}

main() {
    while true; do
        show_menu
        read -p "Select an option: " choice
        echo ""

        case $choice in
            1)
                fix_core_node_root_permissions
                ;;
            2)
                fix_full_core_node_permissions
                ;;
            3)
                fix_nginxconfig_permissions
                ;;
            4)
                fix_core_node_root_permissions
                echo ""
                fix_full_core_node_permissions
                echo ""
                fix_nginxconfig_permissions
                ;;
            0)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo "[ERROR] Invalid option"
                ;;
        esac

        echo ""
        echo "Press Enter to continue..."
        read
    done
}

main
