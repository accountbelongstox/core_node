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

# Environment Checker Module - Handles environment detection and comprehensive checks

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Detect if running in WSL environment
detect_wsl_environment() {
    if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "1"
    else
        echo "0"
    fi
}

# Get database directory based on environment
get_database_directory() {
    local is_wsl=$(detect_wsl_environment)
    local wsl_db_dir="/mnt/d/wwwroot/laravel_main/laravel_db"
    local default_db_dir="/www/wwwroot/laravel_main/laravel_db"

    if [ "$is_wsl" = "1" ]; then
        if [ -d "/mnt/d/wwwroot" ]; then
            echo "$wsl_db_dir"
        else
            echo "$default_db_dir"
        fi
    else
        echo "$default_db_dir"
    fi
}

# Get project root directory based on environment
get_project_root() {
    local is_wsl=$(detect_wsl_environment)
    local wsl_project_root="/mnt/d/programing/core_node"
    local default_project_root="/www/wwwroot/core_node"

    if [ "$is_wsl" = "1" ]; then
        if [ -d "$wsl_project_root" ]; then
            echo "$wsl_project_root"
        else
            echo "$default_project_root"
        fi
    else
        echo "$default_project_root"
    fi
}

# Comprehensive environment check
comprehensive_environment_check() {
    echo -e "\n${BLUE}=== COMPREHENSIVE ENVIRONMENT CHECK ===${NC}"

    # 1. WSL Detection
    echo -e "\n${YELLOW}[ENVIRONMENT] WSL Detection:${NC}"
    local is_wsl=$(detect_wsl_environment)
    if [ "$is_wsl" = "1" ]; then
        echo -e "${GREEN}✓ WSL Environment Detected${NC}"
        echo -e "${CYAN}  WSL Version: $(cat /proc/version)${NC}"

        echo -e "\n${YELLOW}[WSL PATHS] Windows Path Access:${NC}"
        if [ -d "/mnt/c" ]; then
            echo -e "${GREEN}✓ /mnt/c (C: drive) accessible${NC}"
        else
            echo -e "${RED}✗ /mnt/c (C: drive) not accessible${NC}"
        fi

        if [ -d "/mnt/d" ]; then
            echo -e "${GREEN}✓ /mnt/d (D: drive) accessible${NC}"
        else
            echo -e "${RED}✗ /mnt/d (D: drive) not accessible${NC}"
        fi
    else
        echo -e "${GREEN}✓ Native Linux Environment${NC}"
        echo -e "${CYAN}  System: $(uname -a)${NC}"
    fi

    # 2. Directory Status Check
    echo -e "\n${YELLOW}[DIRECTORIES] Critical Directory Status:${NC}"

    if [ -d "$APP_DIR" ]; then
        local app_size=$(du -sh "$APP_DIR" 2>/dev/null | cut -f1)
        local app_files=$(find "$APP_DIR" -type f | wc -l)
        echo -e "${GREEN}✓ APP_DIR exists: $APP_DIR${NC}"
        echo -e "${CYAN}  Size: $app_size, Files: $app_files${NC}"

        if [ -f "$APP_DIR/artisan" ]; then
            echo -e "${GREEN}  ✓ Laravel artisan found${NC}"
        else
            echo -e "${RED}  ✗ Laravel artisan missing${NC}"
        fi

        if [ -d "$APP_DIR/vendor" ]; then
            echo -e "${GREEN}  ✓ Composer vendor directory exists${NC}"
        else
            echo -e "${YELLOW}  ⚠ Composer vendor directory missing${NC}"
        fi
    else
        echo -e "${RED}✗ APP_DIR missing: $APP_DIR${NC}"
    fi

    # 3. Database Status Check
    echo -e "\n${YELLOW}[DATABASE] Database Directory Status:${NC}"
    if [ -d "$DB_DIR" ]; then
        local db_size=$(du -sh "$DB_DIR" 2>/dev/null | cut -f1)
        local db_files=$(find "$DB_DIR" -type f | wc -l)
        echo -e "${GREEN}✓ DB_DIR exists: $DB_DIR${NC}"
        echo -e "${CYAN}  Size: $db_size, Files: $db_files${NC}"

        if [ -f "$DB_FILE" ]; then
            local db_file_size=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
            echo -e "${GREEN}  ✓ Database file exists: $DB_FILE${NC}"
            echo -e "${CYAN}    Size: ${db_file_size} bytes${NC}"

            if [ "$db_file_size" -gt 1024 ]; then
                echo -e "${GREEN}    ✓ Database contains data${NC}"
            else
                echo -e "${YELLOW}    ⚠ Database appears empty or new${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ Database file missing: $DB_FILE${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ DB_DIR missing: $DB_DIR${NC}"
        echo -e "${CYAN}  Will be created during deployment${NC}"
    fi

    # 4. Project Root Check
    echo -e "\n${YELLOW}[PROJECT] Project Root Status:${NC}"
    if [ -d "$PROJECT_ROOT" ]; then
        local project_size=$(du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1)
        echo -e "${GREEN}✓ PROJECT_ROOT exists: $PROJECT_ROOT${NC}"
        echo -e "${CYAN}  Size: $project_size${NC}"

        if [ -f "$PROJECT_ROOT/main.js" ]; then
            echo -e "${GREEN}  ✓ Core Node main.js found${NC}"
        else
            echo -e "${YELLOW}  ⚠ Core Node main.js not found${NC}"
        fi
    else
        echo -e "${RED}✗ PROJECT_ROOT missing: $PROJECT_ROOT${NC}"
    fi

    # 5. Environment Files Check
    echo -e "\n${YELLOW}[ENVIRONMENT] Configuration Files:${NC}"

    if [ -f "$ENV_FILE" ]; then
        local env_size=$(stat -f%z "$ENV_FILE" 2>/dev/null || stat -c%s "$ENV_FILE" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓ .env file exists: $ENV_FILE${NC}"
        echo -e "${CYAN}  Size: ${env_size} bytes${NC}"

        if grep -q "APP_KEY=" "$ENV_FILE"; then
            echo -e "${GREEN}  ✓ APP_KEY configured${NC}"
        else
            echo -e "${YELLOW}  ⚠ APP_KEY not configured${NC}"
        fi

        if grep -q "DB_CONNECTION=sqlite" "$ENV_FILE"; then
            echo -e "${GREEN}  ✓ Database configured for SQLite${NC}"
        else
            echo -e "${YELLOW}  ⚠ Database not configured for SQLite${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ .env file missing: $ENV_FILE${NC}"
        if [ -f "$ENV_EXAMPLE" ]; then
            echo -e "${CYAN}  Will be created from .env.example${NC}"
        else
            echo -e "${RED}  ✗ .env.example also missing${NC}"
        fi
    fi

    # 6. System Resources Check
    echo -e "\n${YELLOW}[SYSTEM] System Resources:${NC}"

    local disk_usage=$(df -h "$APP_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ -n "$disk_usage" ]; then
        echo -e "${CYAN}  Disk usage: ${disk_usage}%${NC}"
        if [ "$disk_usage" -lt 90 ]; then
            echo -e "${GREEN}  ✓ Sufficient disk space${NC}"
        else
            echo -e "${YELLOW}  ⚠ Low disk space warning${NC}"
        fi
    fi

    local mem_total=$(free -m 2>/dev/null | awk 'NR==2{printf "%.0f", $2}' || echo "unknown")
    echo -e "${CYAN}  Total memory: ${mem_total}MB${NC}"

    # 7. Deployment Readiness Summary
    echo -e "\n${YELLOW}[DEPLOYMENT] Deployment Readiness:${NC}"

    local readiness_score=0
    local total_checks=6

    [ -d "$APP_DIR" ] && [ -f "$APP_DIR/artisan" ] && ((readiness_score++))
    [ -d "$DB_DIR" ] && ((readiness_score++))
    [ -d "$PROJECT_ROOT" ] && ((readiness_score++))
    [ -f "$ENV_FILE" ] && ((readiness_score++))
    [ -f "$DB_FILE" ] && ((readiness_score++))
    [ "$disk_usage" -lt 90 ] && ((readiness_score++))

    local readiness_percent=$((readiness_score * 100 / total_checks))

    if [ $readiness_percent -ge 80 ]; then
        echo -e "${GREEN}✓ Deployment Ready: ${readiness_percent}% (${readiness_score}/${total_checks})${NC}"
    elif [ $readiness_percent -ge 60 ]; then
        echo -e "${YELLOW}⚠ Deployment Partially Ready: ${readiness_percent}% (${readiness_score}/${total_checks})${NC}"
    else
        echo -e "${RED}✗ Deployment Not Ready: ${readiness_percent}% (${readiness_score}/${total_checks})${NC}"
    fi

    echo -e "${BLUE}=== ENVIRONMENT CHECK COMPLETE ===${NC}\n"
}

# Export functions
export -f detect_wsl_environment
export -f get_database_directory
export -f get_project_root
export -f comprehensive_environment_check
