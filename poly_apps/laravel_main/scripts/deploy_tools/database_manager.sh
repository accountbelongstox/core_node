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

# Database Manager Module - Handles SQLite database initialization and migrations

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Create database directory if it does not exist
ensure_database_directory() {
    local db_dir="$1"

    if [ -z "$db_dir" ]; then
        echo -e "${RED}Error: Database directory not specified${NC}" >&2
        return 1
    fi

    if [ ! -d "$db_dir" ]; then
        echo -e "${CYAN}Creating database directory: $db_dir${NC}"
        mkdir -p "$db_dir"
        chmod 777 "$db_dir" 2>/dev/null || true
        echo -e "${GREEN}Database directory created with 777 permissions${NC}"
    else
        echo -e "${GREEN}Database directory already exists: $db_dir${NC}"
    fi
}

# Create or verify SQLite database file
ensure_database_file() {
    local db_file="$1"

    if [ -z "$db_file" ]; then
        echo -e "${RED}Error: Database file path not specified${NC}" >&2
        return 1
    fi

    if [ ! -f "$db_file" ]; then
        echo -e "${CYAN}Creating new database file: $db_file${NC}"
        touch "$db_file"
        chmod 666 "$db_file" 2>/dev/null || true
        echo -e "${GREEN}New database file created${NC}"
    else
        local db_size=$(stat -f%z "$db_file" 2>/dev/null || stat -c%s "$db_file" 2>/dev/null || echo "0")
        echo -e "${GREEN}Using existing database file: $db_file (size: ${db_size} bytes)${NC}"

        if [ "$db_size" -gt 1024 ]; then
            echo -e "${BLUE}Database contains data - will be preserved during deployment${NC}"
        else
            echo -e "${YELLOW}Database appears empty or newly created${NC}"
        fi
    fi
}

# Run Laravel migrations safely (without data loss)
run_migrations() {
    echo -e "\n${BLUE}[MIGRATIONS] Running SAFE schema updates (preserving existing data)${NC}"
    echo -e "${YELLOW}Note: Using migrate (not migrate:fresh) to preserve existing data${NC}"

    if [ ! -f "artisan" ]; then
        echo -e "${YELLOW}Laravel artisan file not found - skipping migrations${NC}"
        return 0
    fi

    echo -e "${CYAN}Running Laravel migrations...${NC}"
    if php artisan migrate --force 2>&1; then
        echo -e "${GREEN}Migrations completed successfully${NC}"
    else
        echo -e "${YELLOW}Migrations completed with status code: $?${NC}"
    fi
}

# Clear database cache and state
clear_database_cache() {
    echo -e "\n${BLUE}[CACHE] Clearing database-related cache${NC}"

    if [ ! -f "artisan" ]; then
        echo -e "${YELLOW}Laravel artisan file not found - skipping cache clear${NC}"
        return 0
    fi

    echo -e "${CYAN}Clearing Laravel cache...${NC}"
    php artisan cache:clear 2>&1 | tail -1 || true

    echo -e "${CYAN}Clearing config cache...${NC}"
    php artisan config:clear 2>&1 | tail -1 || true

    echo -e "${CYAN}Clearing route cache...${NC}"
    php artisan route:clear 2>&1 | tail -1 || true

    echo -e "${CYAN}Clearing view cache...${NC}"
    php artisan view:clear 2>&1 | tail -1 || true

    echo -e "${GREEN}Cache cleared successfully${NC}"
}

# Verify database setup
verify_database_setup() {
    local db_dir="$1"
    local db_file="$2"
    local env_file="$3"

    echo -e "\n${BLUE}[VERIFY] Verifying database setup${NC}"

    local errors=0

    # Check database directory
    if [ ! -d "$db_dir" ]; then
        echo -e "${RED}ERROR: Database directory does not exist: $db_dir${NC}"
        ((errors++))
    else
        echo -e "${GREEN}Database directory exists: $db_dir${NC}"
    fi

    # Check database file
    if [ ! -f "$db_file" ]; then
        echo -e "${RED}ERROR: Database file does not exist: $db_file${NC}"
        ((errors++))
    else
        local db_size=$(stat -f%z "$db_file" 2>/dev/null || stat -c%s "$db_file" 2>/dev/null || echo "0")
        echo -e "${GREEN}Database file exists: $db_file (size: ${db_size} bytes)${NC}"
    fi

    # Check database directory is writable
    if [ -d "$db_dir" ] && [ ! -w "$db_dir" ]; then
        echo -e "${RED}ERROR: Database directory is not writable: $db_dir${NC}"
        chmod 777 "$db_dir" 2>/dev/null || true
        ((errors++))
    else
        echo -e "${GREEN}Database directory is writable${NC}"
    fi

    # Check database file is writable
    if [ -f "$db_file" ] && [ ! -w "$db_file" ]; then
        echo -e "${RED}ERROR: Database file is not writable: $db_file${NC}"
        chmod 666 "$db_file" 2>/dev/null || true
        ((errors++))
    else
        echo -e "${GREEN}Database file is writable${NC}"
    fi

    # Check .env configuration
    if [ -f "$env_file" ]; then
        if grep -q "^DB_CONNECTION=sqlite" "$env_file"; then
            echo -e "${GREEN}.env configured for SQLite${NC}"
        else
            echo -e "${YELLOW}WARNING: .env may not be configured for SQLite${NC}"
        fi
    fi

    if [ $errors -gt 0 ]; then
        echo -e "${YELLOW}Database verification found $errors issues (some auto-fixed)${NC}"
        return 1
    else
        echo -e "${GREEN}Database setup verified successfully${NC}"
        return 0
    fi
}

# Complete database setup
setup_database() {
    local db_dir="$1"
    local db_file="$2"
    local env_file="$3"

    echo -e "\n${BLUE}[DATABASE] SAFE Database Setup (preserving existing data)${NC}"
    echo -e "${CYAN}Database file location: $db_file${NC}"

    ensure_database_directory "$db_dir" || return 1
    ensure_database_file "$db_file" || return 1

    # Set database directory permissions
    chmod 777 "$db_dir" 2>/dev/null || true
    chmod 666 "$db_file" 2>/dev/null || true

    run_migrations
    clear_database_cache
    verify_database_setup "$db_dir" "$db_file" "$env_file"
}

# Export functions
export -f ensure_database_directory
export -f ensure_database_file
export -f run_migrations
export -f clear_database_cache
export -f verify_database_setup
export -f setup_database
