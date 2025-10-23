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

# Environment Setup Module - Handles .env file configuration

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Ensure .env file exists and is properly configured
ensure_env_file() {
    local env_file="$1"
    local env_example="$2"

    echo -e "\n${BLUE}[ENV SETUP] Verifying environment configuration${NC}"

    if [ ! -f "$env_file" ]; then
        if [ ! -f "$env_example" ]; then
            echo -e "${RED}Error: Missing .env.example file${NC}"
            return 1
        fi

        cp "$env_example" "$env_file"
        echo -e "${GREEN}Created .env from template${NC}"

        if grep -q "APP_KEY=" "$env_file"; then
            if command -v php &>/dev/null; then
                php artisan key:generate --quiet 2>/dev/null || true
                echo -e "${GREEN}Generated application encryption key${NC}"
            else
                echo -e "${YELLOW}PHP not available - APP_KEY remains unset${NC}"
            fi
        fi
    else
        echo -e "${BLUE}.env already exists${NC}"
    fi

    if [ -f "$env_file" ]; then
        chmod 600 "$env_file"
        echo -e "${GREEN}Applied secure file permissions (600)${NC}"
    fi
}

# Ensure environment is set properly in .env
ensure_production_environment() {
    local env_file="$1"

    echo -e "\n${BLUE}[ENV CONFIG] Preserving .env configuration (manual control enabled)${NC}"
    echo -e "${YELLOW}Note: .env file will not be modified by deploy script${NC}"
    echo -e "${YELLOW}You can manually adjust APP_ENV and APP_DEBUG in .env file as needed${NC}"

    if [ -f "$env_file" ]; then
        echo -e "${GREEN}.env file exists and will be preserved${NC}"

        if grep -q "^APP_ENV=" "$env_file"; then
            local current_env=$(grep "^APP_ENV=" "$env_file" | cut -d= -f2)
            echo -e "${BLUE}Current APP_ENV: $current_env${NC}"
        else
            echo -e "${YELLOW}APP_ENV not set in .env file${NC}"
        fi

        if grep -q "^APP_DEBUG=" "$env_file"; then
            local current_debug=$(grep "^APP_DEBUG=" "$env_file" | cut -d= -f2)
            echo -e "${BLUE}Current APP_DEBUG: $current_debug${NC}"
        else
            echo -e "${YELLOW}APP_DEBUG not set in .env file${NC}"
        fi
    else
        echo -e "${YELLOW}.env file not found${NC}"
    fi
}

# Configure database connection in .env
configure_database_connection() {
    local env_file="$1"
    local db_file="$2"

    echo -e "\n${BLUE}[DATABASE CONFIG] Configuring database connection${NC}"

    if [ ! -f "$env_file" ]; then
        echo -e "${RED}Error: .env file not found at $env_file${NC}"
        return 1
    fi

    if ! grep -q "^DB_CONNECTION=sqlite" "$env_file"; then
        echo -e "${CYAN}Setting DB_CONNECTION to sqlite${NC}"
        sed -i 's/DB_CONNECTION=.*/DB_CONNECTION=sqlite/' "$env_file"
    else
        echo -e "${GREEN}DB_CONNECTION already set to sqlite${NC}"
    fi

    echo -e "${CYAN}Setting DB_DATABASE to: $db_file${NC}"
    sed -i "s|^DB_DATABASE=.*|DB_DATABASE=$db_file|" "$env_file"

    echo -e "${GREEN}Database configuration complete${NC}"
}

# Get current environment from .env
get_current_environment() {
    local env_file="$1"

    if [ ! -f "$env_file" ]; then
        echo "production"
        return
    fi

    grep "^APP_ENV=" "$env_file" 2>/dev/null | cut -d'=' -f2 || echo "production"
}

# Get current debug setting from .env
get_current_debug_setting() {
    local env_file="$1"

    if [ ! -f "$env_file" ]; then
        echo "false"
        return
    fi

    grep "^APP_DEBUG=" "$env_file" 2>/dev/null | cut -d'=' -f2 || echo "false"
}

# Export functions
export -f ensure_env_file
export -f ensure_production_environment
export -f configure_database_connection
export -f get_current_environment
export -f get_current_debug_setting
