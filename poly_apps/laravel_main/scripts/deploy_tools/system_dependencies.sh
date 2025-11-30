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

# System Dependencies Module - Handles installation and verification of system requirements

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Install archive extraction tools
install_archive_tools() {
    echo -e "\n${BLUE}[ARCHIVE TOOLS] Checking archive extraction tools${NC}"
    local tools_needed=()

    if ! command -v unzip >/dev/null 2>&1; then
        tools_needed+=("unzip")
    fi

    if ! command -v 7z >/dev/null 2>&1 && ! command -v 7za >/dev/null 2>&1; then
        tools_needed+=("p7zip-full")
    fi

    if [ ${#tools_needed[@]} -gt 0 ]; then
        echo -e "${YELLOW}Installing missing tools: ${tools_needed[*]}${NC}"

        if apt update >/dev/null 2>&1; then
            echo -e "${GREEN}Package list updated${NC}"
        else
            echo -e "${RED}Failed to update package list${NC}"
            return 1
        fi

        for tool in "${tools_needed[@]}"; do
            if apt install -y "$tool" >/dev/null 2>&1; then
                echo -e "${GREEN}Installed $tool${NC}"
            else
                echo -e "${RED}Failed to install $tool${NC}"
                return 1
            fi
        done
    else
        echo -e "${GREEN}Archive extraction tools already available${NC}"
    fi
}

# Ensure PHP is installed and configured
ensure_php_requirements() {
    echo -e "\n${BLUE}[PHP] Checking PHP requirements${NC}"

    if ! command -v php &>/dev/null; then
        echo -e "${YELLOW}PHP is not installed. Installing PHP...${NC}"
        apt update && apt install -y php 2>&1 | tail -1
    fi

    local php_version=$(php -v | head -n 1 | cut -d " " -f 2)
    echo -e "${GREEN}PHP version: $php_version${NC}"

    echo -e "${YELLOW}Checking required PHP extensions...${NC}"
    local extensions_needed=()

    if ! php -m | grep -q 'dom'; then
        extensions_needed+=("php-xml")
    fi
    if ! php -m | grep -q 'xml'; then
        extensions_needed+=("php-xml")
    fi
    if ! php -m | grep -q 'sqlite'; then
        extensions_needed+=("php-sqlite3")
    fi

    if [ ${#extensions_needed[@]} -gt 0 ]; then
        echo -e "${YELLOW}Installing missing extensions: ${extensions_needed[*]}${NC}"
        apt update && apt install -y "${extensions_needed[@]}" 2>&1 | tail -1
    else
        echo -e "${GREEN}All required PHP extensions are available${NC}"
    fi
}

# Ensure Composer is installed
ensure_composer() {
    echo -e "\n${BLUE}[COMPOSER] Checking Composer installation${NC}"

    if command -v composer &>/dev/null; then
        local composer_version=$(composer --version 2>&1 | grep -oP 'Composer version \K[0-9.]+' || echo "unknown")
        echo -e "${GREEN}Composer is installed (version: $composer_version)${NC}"
        return 0
    fi

    echo -e "${YELLOW}Composer is not installed. Installing Composer...${NC}"

    if php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" 2>/dev/null; then
        php composer-setup.php --install-dir=/usr/local/bin --filename=composer 2>&1 | tail -3
        rm -f composer-setup.php

        if command -v composer &>/dev/null; then
            local composer_version=$(composer --version 2>&1 | grep -oP 'Composer version \K[0-9.]+' || echo "unknown")
            echo -e "${GREEN}Composer installed successfully (version: $composer_version)${NC}"
            return 0
        else
            echo -e "${RED}Failed to install Composer${NC}"
            return 1
        fi
    else
        echo -e "${RED}Failed to download Composer installer${NC}"
        return 1
    fi
}

# Ensure Python3 and pip3 are installed
ensure_python3() {
    echo -e "\n${BLUE}[PYTHON3] Checking Python3 and pip3 installation${NC}"

    if ! command -v python3 &>/dev/null; then
        echo -e "${YELLOW}Python3 is not installed. Installing Python3...${NC}"
        apt update && apt install -y python3 python3-dev python3-setuptools python3-wheel python3-venv build-essential 2>&1 | tail -1
    fi

    local python_version=$(python3 --version 2>&1 | cut -d " " -f 2)
    echo -e "${GREEN}Python3 version: $python_version${NC}"

    if ! command -v pip3 &>/dev/null; then
        echo -e "${YELLOW}pip3 is not installed. Installing pip3...${NC}"
        apt update && apt install -y python3-pip 2>&1 | tail -1
    fi

    local pip_version=$(pip3 --version 2>&1 | cut -d " " -f 2)
    echo -e "${GREEN}pip3 version: $pip_version${NC}"
}

# Install EdgeTTS (text-to-speech tool)
ensure_edgetts() {
    echo -e "\n${BLUE}[EDGETTS] Checking EdgeTTS installation${NC}"

    if command -v edge-tts &>/dev/null; then
        local edgetts_version=$(edge-tts --version 2>/dev/null || echo "unknown")
        echo -e "${GREEN}EdgeTTS is already installed (version: $edgetts_version)${NC}"
        return 0
    fi

    echo -e "${YELLOW}EdgeTTS is not installed. Installing EdgeTTS...${NC}"

    if pip3 install edge-tts 2>&1 | tail -3; then
        if command -v edge-tts &>/dev/null; then
            echo -e "${GREEN}EdgeTTS installed successfully${NC}"
            return 0
        else
            echo -e "${RED}EdgeTTS installation verification failed${NC}"
            return 1
        fi
    else
        echo -e "${RED}Failed to install EdgeTTS${NC}"
        return 1
    fi
}

# Check for Microsoft Edge browser
check_edge_browser() {
    echo -e "\n${BLUE}[EDGE BROWSER] Checking Microsoft Edge browser${NC}"

    if command -v microsoft-edge &>/dev/null || command -v microsoft-edge-stable &>/dev/null || command -v msedge &>/dev/null; then
        echo -e "${GREEN}Microsoft Edge browser is installed${NC}"

        local edge_version=""
        if command -v microsoft-edge &>/dev/null; then
            edge_version=$(microsoft-edge --version 2>/dev/null | cut -d " " -f 3 || echo "unknown")
        elif command -v microsoft-edge-stable &>/dev/null; then
            edge_version=$(microsoft-edge-stable --version 2>/dev/null | cut -d " " -f 3 || echo "unknown")
        elif command -v msedge &>/dev/null; then
            edge_version=$(msedge --version 2>/dev/null | cut -d " " -f 3 || echo "unknown")
        fi

        if [ "$edge_version" != "unknown" ]; then
            echo -e "${GREEN}Edge browser version: $edge_version${NC}"
        fi
        return 0
    else
        echo -e "${YELLOW}Microsoft Edge browser is not detected${NC}"
        echo -e "${YELLOW}If needed, run: sudo bash /www/wwwroot/core_node/dd.sh${NC}"
        return 0
    fi
}

# Fix Git safe directory configuration
fix_git_safe_directory() {
    echo -e "\n${BLUE}[GIT] Fixing Git safe directory issues${NC}"

    if ! command -v git &>/dev/null; then
        echo -e "${YELLOW}Git is not installed. Skipping Git configuration.${NC}"
        return 0
    fi

    local current_dir=$(pwd)
    git config --global --add safe.directory "$current_dir" 2>/dev/null || true
    git config --global --add safe.directory "$PROJECT_ROOT" 2>/dev/null || true

    local parent_dir=$(dirname "$current_dir")
    git config --global --add safe.directory "$parent_dir" 2>/dev/null || true

    echo -e "${GREEN}Git safe directories configured${NC}"
}

# Fix file permissions for artisan and other scripts
fix_script_permissions() {
    echo -e "\n${BLUE}[PERMISSIONS] Fixing script executable permissions${NC}"

    if [ -f "artisan" ]; then
        chmod +x artisan 2>/dev/null || true
        echo -e "${GREEN}Fixed artisan permissions${NC}"
    fi
}

# Verify Git functionality
verify_git() {
    echo -e "\n${BLUE}[GIT] Verifying Git functionality${NC}"

    if ! command -v git &>/dev/null; then
        echo -e "${YELLOW}Git is not installed. Skipping Git verification.${NC}"
        return 0
    fi

    if git status >/dev/null 2>&1; then
        echo -e "${GREEN}Git is working properly${NC}"
        return 0
    else
        echo -e "${YELLOW}Git may have issues, but continuing...${NC}"
        return 0
    fi
}

# Export functions
export -f install_archive_tools
export -f ensure_php_requirements
export -f ensure_composer
export -f ensure_python3
export -f ensure_edgetts
export -f check_edge_browser
export -f fix_git_safe_directory
export -f fix_script_permissions
export -f verify_git
