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

# Permission Manager Module - Handles file and directory permissions

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Setup Laravel directory permissions
setup_directory_permissions() {
    echo -e "\n${BLUE}[PERMISSIONS] Setting up directory permissions${NC}"

    # Reset Laravel framework directories
    echo -e "${YELLOW}Resetting Laravel directories...${NC}"
    rm -rf storage/framework/views/* 2>/dev/null || true
    rm -rf storage/framework/cache/* 2>/dev/null || true
    rm -rf storage/framework/sessions/* 2>/dev/null || true
    rm -rf storage/logs/* 2>/dev/null || true
    rm -rf bootstrap/cache/* 2>/dev/null || true

    # Create required directories
    echo -e "${YELLOW}Creating required directories...${NC}"
    mkdir -p storage/framework/views
    mkdir -p storage/framework/cache
    mkdir -p storage/framework/sessions
    mkdir -p storage/logs
    mkdir -p bootstrap/cache

    # Set directory permissions to 755
    echo -e "${YELLOW}Setting directory permissions to 755${NC}"
    find . -type d -exec chmod 755 {} \; 2>/dev/null || true

    # Set file permissions to 644
    echo -e "${YELLOW}Setting file permissions to 644${NC}"
    find . -type f -exec chmod 644 {} \; 2>/dev/null || true

    # Set 777 permissions for critical Laravel directories (recursive)
    echo -e "${YELLOW}Setting 777 permissions for critical directories (recursive)${NC}"
    chmod -R 777 storage 2>/dev/null || true
    chmod -R 777 bootstrap/cache 2>/dev/null || true

    # Setup additional upload directories
    if [ -d "public/uploads" ]; then
        chmod -R 777 public/uploads 2>/dev/null || true
        echo -e "${GREEN}Set 777 permissions for public/uploads${NC}"
    fi

    if [ -d "resources/views/cache" ]; then
        chmod -R 777 resources/views/cache 2>/dev/null || true
        echo -e "${GREEN}Set 777 permissions for resources/views/cache${NC}"
    fi

    # Ensure artisan is executable
    chmod +x artisan 2>/dev/null || true

    echo -e "${GREEN}Directory permissions setup complete${NC}"
}

# Set up file ownership
setup_file_ownership() {
    echo -e "\n${BLUE}[OWNERSHIP] Setting up file ownership${NC}"

    local username="${1:-www}"

    if ! id "$username" &>/dev/null; then
        echo -e "${YELLOW}User $username does not exist, using current user: $USER${NC}"
        username="$USER"
    fi

    if [ "$USER" = "root" ]; then
        echo -e "${YELLOW}Setting ownership to $username...${NC}"
        chown -R "$username:$username" . 2>/dev/null || true
        echo -e "${GREEN}File ownership set to $username${NC}"
    else
        echo -e "${YELLOW}Current user is not root, skipping ownership change${NC}"
    fi
}

# Verify and repair permissions after potential issues
verify_critical_permissions() {
    echo -e "\n${BLUE}[VERIFICATION] Verifying critical permissions${NC}"

    local errors=0

    # Check storage directory
    if [ ! -w "storage" ]; then
        echo -e "${RED}ERROR: storage directory is not writable${NC}"
        chmod 777 storage 2>/dev/null || true
        ((errors++))
    else
        echo -e "${GREEN}storage directory is writable${NC}"
    fi

    # Check bootstrap/cache directory
    if [ ! -w "bootstrap/cache" ]; then
        echo -e "${RED}ERROR: bootstrap/cache directory is not writable${NC}"
        chmod 777 bootstrap/cache 2>/dev/null || true
        ((errors++))
    else
        echo -e "${GREEN}bootstrap/cache directory is writable${NC}"
    fi

    # Check .env file readability
    if [ -f ".env" ] && [ ! -r ".env" ]; then
        echo -e "${RED}ERROR: .env file is not readable${NC}"
        chmod 644 .env 2>/dev/null || true
        ((errors++))
    else
        echo -e "${GREEN}.env file is readable${NC}"
    fi

    if [ $errors -gt 0 ]; then
        echo -e "${YELLOW}Fixed $errors permission issues${NC}"
    else
        echo -e "${GREEN}All critical permissions verified${NC}"
    fi
}

# Export functions
export -f setup_directory_permissions
export -f setup_file_ownership
export -f verify_critical_permissions
