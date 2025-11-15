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

# Deployment Helper Module - Utility functions for deployment

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Log deployment status with timestamp
deployment_status_update() {
    local status="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo -e "${CYAN}[${timestamp}] ${status}: ${message}${NC}"
}

# Install or update Composer dependencies
install_dependencies() {
    echo -e "\n${BLUE}[DEPENDENCIES] Installing/updating Laravel dependencies${NC}"

    if [ ! -f "composer.json" ]; then
        echo -e "${YELLOW}composer.json not found - skipping dependency installation${NC}"
        return 0
    fi

    if ! command -v composer &>/dev/null; then
        echo -e "${RED}Composer is not available - cannot install dependencies${NC}"
        return 1
    fi

    echo -e "${CYAN}Running: composer install --no-dev --optimize-autoloader${NC}"
    if composer install --no-dev --optimize-autoloader 2>&1; then
        echo -e "${GREEN}Dependencies installed successfully${NC}"
        return 0
    else
        echo -e "${RED}Dependency installation failed with status: $?${NC}"
        return 1
    fi
}

# Optimize Laravel for production
optimize_for_production() {
    echo -e "\n${BLUE}[OPTIMIZATION] Running Laravel production optimizations${NC}"

    if [ ! -f "artisan" ]; then
        echo -e "${YELLOW}Laravel artisan file not found - skipping optimizations${NC}"
        return 0
    fi

    echo -e "${CYAN}Caching configuration...${NC}"
    php artisan config:cache 2>&1 | tail -1 || true

    echo -e "${CYAN}Caching routes...${NC}"
    php artisan route:cache 2>&1 | tail -1 || true

    echo -e "${CYAN}Caching views...${NC}"
    php artisan view:cache 2>&1 | tail -1 || true

    echo -e "${GREEN}Production optimizations complete${NC}"
}

# Optimize Laravel for development
optimize_for_development() {
    echo -e "\n${BLUE}[OPTIMIZATION] Setting up development environment${NC}"

    if [ ! -f "artisan" ]; then
        echo -e "${YELLOW}Laravel artisan file not found - skipping setup${NC}"
        return 0
    fi

    echo -e "${CYAN}Clearing configuration cache...${NC}"
    php artisan config:clear 2>&1 | tail -1 || true

    echo -e "${CYAN}Clearing route cache...${NC}"
    php artisan route:clear 2>&1 | tail -1 || true

    echo -e "${CYAN}Clearing view cache...${NC}"
    php artisan view:clear 2>&1 | tail -1 || true

    echo -e "${GREEN}Development environment setup complete${NC}"
}

# Create initialization marker file
create_init_marker() {
    local marker_file="$1"

    if [ -z "$marker_file" ]; then
        echo -e "${YELLOW}Init marker file not specified - skipping${NC}"
        return 0
    fi

    touch "$marker_file"
    echo -e "${GREEN}Initialization marker created: $marker_file${NC}"
}

# Verify artisan file exists
verify_artisan_exists() {
    if [ ! -f "artisan" ]; then
        echo -e "${RED}ERROR: artisan file not found in current directory${NC}"
        return 1
    fi

    echo -e "${GREEN}Laravel artisan file verified${NC}"
    return 0
}

# Print deployment summary
print_deployment_summary() {
    local app_dir="$1"
    local mode="$2"
    local app_name="$3"

    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}    DEPLOYMENT SUMMARY${NC}"
    echo -e "${BLUE}========================================${NC}"

    if [ "$mode" = "production" ]; then
        echo -e "\n${GREEN}[MODE] Production${NC}"
        echo -e "${CYAN}Application Directory: $app_dir${NC}"
        echo -e "${YELLOW}Please configure your web server to point to: $app_dir/public${NC}"
        echo -e "${YELLOW}Recommended: Use nginx + php-fpm for production${NC}"
    else
        echo -e "\n${GREEN}[MODE] Development${NC}"
        echo -e "${CYAN}Application Directory: $app_dir${NC}"
        echo -e "${CYAN}Application Name: ${app_name:-laravel_main}${NC}"
        echo -e "${GREEN}Laravel development server will start on: http://0.0.0.0:8000${NC}"
    fi

    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Stop Laravel development server on specific port
stop_development_server() {
    local port="$1"

    if [ -z "$port" ]; then
        port="8000"
    fi

    echo -e "\n${BLUE}[CLEANUP] Stopping Laravel development server${NC}"
    echo -e "${CYAN}Checking for processes using port $port...${NC}"

    # Kill artisan serve processes
    echo -e "${CYAN}Killing any existing php artisan serve processes...${NC}"
    pkill -f "php.*artisan.*serve" 2>/dev/null || true
    sleep 1

    # Check for processes using the port
    local port_pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        echo -e "${YELLOW}Found processes using port $port: $port_pids${NC}"
        echo -e "${CYAN}Terminating processes...${NC}"
        kill -TERM $port_pids 2>/dev/null || true
        sleep 2

        # Force kill if still running
        port_pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$port_pids" ]; then
            echo -e "${YELLOW}Force killing remaining processes: $port_pids${NC}"
            kill -KILL $port_pids 2>/dev/null || true
            sleep 1
        fi
    fi

    # Verify port is free
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${RED}ERROR: Port $port is still in use${NC}"
        echo -e "${YELLOW}Processes using port $port:${NC}"
        lsof -i:$port 2>/dev/null || true
        return 1
    fi

    echo -e "${GREEN}Port $port is now available${NC}"
    return 0
}

# Start Laravel development server
start_development_server() {
    local host="${1:-0.0.0.0}"
    local port="${2:-8000}"

    echo -e "\n${BLUE}[STARTUP] Starting Laravel development server${NC}"
    echo -e "${CYAN}Server will be available at: http://$host:$port${NC}"
    echo -e "${CYAN}Environment will be read from .env file${NC}"

    if [ ! -f "artisan" ]; then
        echo -e "${RED}ERROR: artisan file not found - cannot start server${NC}"
        return 1
    fi

    echo -e "${GREEN}Starting server...${NC}"
    exec php artisan serve --host=$host --port=$port
}

# Export functions
export -f deployment_status_update
export -f install_dependencies
export -f optimize_for_production
export -f optimize_for_development
export -f create_init_marker
export -f verify_artisan_exists
export -f print_deployment_summary
export -f stop_development_server
export -f start_development_server
