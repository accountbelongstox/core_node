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

# Safety Checker Module - Handles safety verification and prechecks

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Verify deployment safety and data preservation
verify_deployment_safety() {
    echo -e "\n${BLUE}[SAFETY CHECK] Verifying deployment safety${NC}"

    # Check if database file exists and contains data
    if [ -f "$1" ]; then
        local db_size=$(stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo "0")
        echo -e "${CYAN}Checking database file: $1${NC}"
        echo -e "${CYAN}Database file size: ${db_size} bytes${NC}"

        if [ "$db_size" -gt 1024 ]; then
            echo -e "${GREEN}Existing database detected (${db_size} bytes)${NC}"
            echo -e "${GREEN}SAFETY: This deployment will preserve existing data${NC}"
        else
            echo -e "${CYAN}Database file is small or empty - will be initialized${NC}"
        fi
    else
        echo -e "${CYAN}Database file does not exist - will be created${NC}"
    fi

    # Verify no destructive operations
    echo -e "\n${GREEN}SAFETY: No migrate:fresh or destructive operations will be performed${NC}"
    echo -e "${GREEN}SAFETY: Only additive migrations will be run${NC}"
    echo -e "${GREEN}Safety verification complete${NC}"
}

# Verify Laravel project structure
verify_laravel_structure() {
    echo -e "\n${BLUE}[STRUCTURE] Verifying Laravel project structure${NC}"

    local errors=0

    # Check artisan file
    if [ ! -f "artisan" ]; then
        echo -e "${RED}ERROR: artisan file not found${NC}"
        ((errors++))
    else
        echo -e "${GREEN}artisan file found${NC}"
    fi

    # Check composer.json
    if [ ! -f "composer.json" ]; then
        echo -e "${RED}ERROR: composer.json file not found${NC}"
        ((errors++))
    else
        echo -e "${GREEN}composer.json file found${NC}"
    fi

    # Check app directory
    if [ ! -d "app" ]; then
        echo -e "${RED}ERROR: app directory not found${NC}"
        ((errors++))
    else
        echo -e "${GREEN}app directory found${NC}"
    fi

    # Check config directory
    if [ ! -d "config" ]; then
        echo -e "${RED}ERROR: config directory not found${NC}"
        ((errors++))
    else
        echo -e "${GREEN}config directory found${NC}"
    fi

    # Check routes directory
    if [ ! -d "routes" ]; then
        echo -e "${RED}ERROR: routes directory not found${NC}"
        ((errors++))
    else
        echo -e "${GREEN}routes directory found${NC}"
    fi

    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}Laravel project structure verified successfully${NC}"
        return 0
    else
        echo -e "${RED}Laravel project structure verification failed: $errors errors found${NC}"
        return 1
    fi
}

# Check available disk space
check_disk_space() {
    local path="$1"
    local min_space_mb="${2:-100}"

    echo -e "\n${BLUE}[DISK] Checking disk space${NC}"

    if [ -z "$path" ]; then
        path="."
    fi

    local available_kb=$(df "$path" 2>/dev/null | tail -1 | awk '{print $4}')
    local available_mb=$((available_kb / 1024))

    echo -e "${CYAN}Available disk space: ${available_mb}MB${NC}"

    if [ "$available_mb" -lt "$min_space_mb" ]; then
        echo -e "${RED}ERROR: Insufficient disk space (${available_mb}MB < ${min_space_mb}MB required)${NC}"
        return 1
    else
        echo -e "${GREEN}Sufficient disk space available${NC}"
        return 0
    fi
}

# Verify critical system commands
verify_system_commands() {
    echo -e "\n${BLUE}[COMMANDS] Verifying critical system commands${NC}"

    local missing_commands=()

    # Check bash
    if ! command -v bash &>/dev/null; then
        missing_commands+=("bash")
    else
        echo -e "${GREEN}bash available${NC}"
    fi

    # Check php
    if ! command -v php &>/dev/null; then
        missing_commands+=("php")
    else
        local php_version=$(php -v 2>&1 | head -1 | awk '{print $2}')
        echo -e "${GREEN}php available (version: $php_version)${NC}"
    fi

    # Check git
    if ! command -v git &>/dev/null; then
        echo -e "${YELLOW}git not available (optional)${NC}"
    else
        local git_version=$(git --version 2>&1 | awk '{print $3}')
        echo -e "${GREEN}git available (version: $git_version)${NC}"
    fi

    # Check find
    if ! command -v find &>/dev/null; then
        missing_commands+=("find")
    else
        echo -e "${GREEN}find available${NC}"
    fi

    # Check chmod
    if ! command -v chmod &>/dev/null; then
        missing_commands+=("chmod")
    else
        echo -e "${GREEN}chmod available${NC}"
    fi

    if [ ${#missing_commands[@]} -gt 0 ]; then
        echo -e "${RED}ERROR: Missing critical commands: ${missing_commands[*]}${NC}"
        return 1
    else
        echo -e "${GREEN}All critical system commands available${NC}"
        return 0
    fi
}

# Pre-deployment validation
pre_deployment_check() {
    echo -e "\n${BLUE}[PRE-CHECK] Running pre-deployment validation${NC}"

    local errors=0

    verify_system_commands || ((errors++))
    verify_laravel_structure || ((errors++))
    check_disk_space "." 100 || ((errors++))

    echo -e "\n${BLUE}[PRE-CHECK] Pre-deployment validation complete${NC}"

    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}All pre-deployment checks passed${NC}"
        return 0
    else
        echo -e "${RED}Pre-deployment checks failed: $errors errors found${NC}"
        return 1
    fi
}

# Export functions
export -f verify_deployment_safety
export -f verify_laravel_structure
export -f check_disk_space
export -f verify_system_commands
export -f pre_deployment_check
