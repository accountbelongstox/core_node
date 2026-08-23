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
# System Functions for dd.sh
# =============================================================================
SYSTEM_PACKAGE_READY=false

detect_system_version() {
    if [ -s /.dockerenv ]; then
        echo "Running inside Docker container"
        set_global_var "CURRENT_SYSTEM" "DOCKER"
        return
    fi

    if [ ! -s /etc/os-release ]; then
        echo "Error: Cannot detect operating system (missing /etc/os-release)"
        set_global_var "CURRENT_SYSTEM" "UNKNOWN"
        return
    fi

    . /etc/os-release
    case "$ID" in
        ubuntu)
            echo -e "\033[32mUbuntu $(echo $VERSION_ID) detected - using Debian-compatible scripts\033[0m"
            set_global_var "CURRENT_SYSTEM" "UBUNTU_$(echo $VERSION_ID | cut -d. -f1)"
            ;;
        debian)
            echo -e "\033[32mDebian $(echo $VERSION_ID) detected\033[0m"
            set_global_var "CURRENT_SYSTEM" "DEBIAN_$(echo $VERSION_ID | cut -d. -f1)"
            ;;
        kali)
            echo -e "\033[32mKali ${VERSION_ID:-rolling} detected - using Debian-compatible scripts\033[0m"
            set_global_var "CURRENT_SYSTEM" "KALI_$(echo ${VERSION_ID:-0} | cut -d. -f1)"
            ;;
        *)
            # Accept any other Debian-family derivative (ID_LIKE contains "debian").
            if echo " ${ID_LIKE:-} " | grep -q " debian "; then
                echo -e "\033[32m${ID} ${VERSION_ID:-} detected (Debian-compatible via ID_LIKE) - using Debian scripts\033[0m"
                set_global_var "CURRENT_SYSTEM" "$(echo ${ID} | tr '[:lower:]' '[:upper:]')_$(echo ${VERSION_ID:-0} | cut -d. -f1)"
            else
                echo "Error: This script only supports Debian, Ubuntu, and Kali (Debian-family) systems"
                set_global_var "CURRENT_SYSTEM" "UNSUPPORTED"
            fi
            ;;
    esac
}

install_package() {
    local package_name="$1"
    SYSTEM_PACKAGE_READY=false
    echo "Attempting to install $package_name..."
    if ! command -v apt-get &>/dev/null; then
        echo "Error: apt-get not found. This script only supports Debian-based systems."
        return
    fi
    $sudo apt-get update
    $sudo apt-get install -y "$package_name" || true
    command -v "$package_name" >/dev/null 2>&1 && SYSTEM_PACKAGE_READY=true
}

check_and_install_sudo() {
    if [ "$EUID" -eq 0 ]; then
        sudo=""
        USE_SUDO=""
        echo "Running as root. sudo not needed."
        return
    fi

    if ! command -v sudo >/dev/null 2>&1; then
        echo "sudo not found. Attempting to install..."
        install_package "sudo"
        if [ "$SYSTEM_PACKAGE_READY" = true ]; then
            echo "sudo installed successfully."
        else
            echo "Failed to install sudo. Commands will be run without sudo."
            sudo=""
            USE_SUDO=""
            return
        fi
    fi

    if command -v sudo >/dev/null 2>&1; then
        sudo="sudo"
        USE_SUDO="sudo"
        echo "sudo is available and will be used."
    else
        sudo=""
        USE_SUDO=""
        echo "sudo is not available. Commands will be run without sudo."
    fi
}

check_and_install_dos2unix() {
    if ! command -v dos2unix &>/dev/null; then
        echo "dos2unix is not installed, attempting to install..."
        install_package "dos2unix"
        if [ "$SYSTEM_PACKAGE_READY" = true ]; then
            echo "dos2unix installed successfully."
        else
            echo "Failed to install dos2unix. Please install it manually and try again."
            return
        fi
    fi
}

check_and_install_git() {
    if ! command -v git &>/dev/null; then
        echo "git is not installed, attempting to install..."
        install_package "git"
        if [ "$SYSTEM_PACKAGE_READY" = true ]; then
            echo "git installed successfully."
        else
            echo "Failed to install git. Please install it manually and try again."
            return
        fi
    fi
}

make_sh_executable() {
    if [ -z "$CORE_NODE_ROOT_DIR" ]; then
        echo "CORE_NODE_ROOT_DIR is not specified."
        return
    fi
    find "$CORE_NODE_ROOT_DIR" -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \;
    if [ -d "$SCRIPT_DIR" ]; then
        find "$SCRIPT_DIR" -type f -name "*.sh" -exec chmod +x {} \;
    else
        echo "Directory $SCRIPT_DIR does not exist."
    fi
}
