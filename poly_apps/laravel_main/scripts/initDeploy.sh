#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Source gvar_common.sh for environment detection and path mapping
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GVAR_COMMON="${SCRIPT_DIR}/../../../scripts/shells/linux/common/gvar_common.sh"

if [ -f "$GVAR_COMMON" ]; then
    source "$GVAR_COMMON"
    echo -e "${GREEN}Loaded environment configuration from gvar_common.sh${NC}"
    echo -e "  CORE_NODE_DIR: ${CORE_NODE_DIR}"
    echo -e "  IS_WSL: ${IS_WSL}"
    echo -e "  IS_PRODUCTION: ${IS_PRODUCTION}"
    echo -e "  HAS_DESKTOP_ENVIRONMENT: ${HAS_DESKTOP_ENVIRONMENT}"
else
    echo -e "${YELLOW}Warning: gvar_common.sh not found, using default paths${NC}"
    # Fallback: try to detect environment manually
    # SCRIPT_DIR is now: /www/programing/core_node/poly_apps/laravel_main/scripts
    # Need to go up 3 levels: scripts -> laravel_main -> poly_apps -> core_node
    CORE_NODE_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
    IS_WSL=false
    [ -d "/mnt/c/Users" ] && IS_WSL=true
fi

# Function to fix prerequisites and common issues
fix_prerequisites() {
    echo -e "\n${BLUE}[PREREQUISITES] Checking and fixing common issues${NC}"

    # 1. Fix Git safe directory issue (WSL/dual boot common problem)
    echo -e "${YELLOW}Fixing Git safe directory issues...${NC}"
    local current_dir=$(pwd)
    local project_root="${CORE_NODE_DIR}"
    
    # Add current directory and project root to Git safe directories
    git config --global --add safe.directory "$current_dir" 2>/dev/null || true
    git config --global --add safe.directory "$project_root" 2>/dev/null || true
    
    # Also add any parent directories that might be causing issues
    local parent_dir=$(dirname "$current_dir")
    git config --global --add safe.directory "$parent_dir" 2>/dev/null || true
    
    echo -e "${GREEN}????Git safe directories configured${NC}"
    
    # 2. Install unzip and p7zip for Composer
    echo -e "${YELLOW}Checking archive extraction tools...${NC}"
    local tools_needed=()
    
    if ! command -v unzip >/dev/null 2>&1; then
        tools_needed+=("unzip")
    fi
    
    if ! command -v 7z >/dev/null 2>&1 && ! command -v 7za >/dev/null 2>&1; then
        tools_needed+=("p7zip-full")
    fi
    
    if [ ${#tools_needed[@]} -gt 0 ]; then
        echo -e "${YELLOW}Installing missing tools: ${tools_needed[*]}${NC}"
        
        # Update package list
        if sudo apt update >/dev/null 2>&1; then
            echo -e "${GREEN}????Package list updated${NC}"
        else
            echo -e "${RED}????Failed to update package list${NC}"
        fi
        
        # Install missing tools
        for tool in "${tools_needed[@]}"; do
            if sudo apt install -y "$tool" >/dev/null 2>&1; then
                echo -e "${GREEN}????Installed $tool${NC}"
            else
                echo -e "${RED}????Failed to install $tool${NC}"
            fi
        done
    else
        echo -e "${GREEN}????Archive extraction tools already available${NC}"
    fi
    
    # 3. Fix file permissions for WSL (common issue)
    echo -e "${YELLOW}Fixing file permissions...${NC}"
    
    # Fix script permissions
    if [ -f "$(basename "$0")" ]; then
        chmod +x "$(basename "$0")" 2>/dev/null || true
    fi
    
    # Fix common Laravel file permissions
    if [ -f "artisan" ]; then
        chmod +x artisan 2>/dev/null || true
        echo -e "${GREEN}????Fixed artisan permissions${NC}"
    fi
    
    # 4. Verify Git functionality
    echo -e "${YELLOW}Verifying Git functionality...${NC}"
    if git status >/dev/null 2>&1; then
        echo -e "${GREEN}????Git is working properly${NC}"
    else
        echo -e "${YELLOW}????Git may still have issues, but continuing...${NC}"
    fi
    
    # 5. Check Composer functionality
    echo -e "${YELLOW}Checking Composer zip handling...${NC}"
    if command -v unzip >/dev/null 2>&1 || command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1; then
        echo -e "${GREEN}????Archive extraction tools available for Composer${NC}"
    else
        echo -e "${YELLOW}????No archive tools found - Composer will use PHP zip extension${NC}"
    fi
    
    echo -e "${GREEN}[PREREQUISITES] Setup complete${NC}\n"
}

# Ensures the .env file exists and is properly configured
# Usage: ensure_env_file [project_root]
ensure_env_file() {
    local env_file=".env"
    local env_example=".env.example"
    local project_root="${1:-$(pwd)}"
    local full_env_path="${project_root}/${env_file}"

    echo -e "\n${BLUE}[ENV SETUP] Verifying environment configuration${NC}"

    # Verify .env file existence
    if [ ! -f "$full_env_path" ]; then
        if [ ! -f "${project_root}/${env_example}" ]; then
            echo -e "${RED}????Error: Missing ${env_example} file in ${project_root}${NC}"
            return 1
        fi

        # Create from example
        cp "${project_root}/${env_example}" "$full_env_path"
        echo -e "${GREEN}????Created ${env_file} from template${NC}"

        # Generate application key
        if grep -q "APP_KEY=" "$full_env_path"; then
            if command -v php &>/dev/null; then
                (cd "$project_root" && php artisan key:generate --quiet)
                echo -e "${GREEN}????Generated application encryption key${NC}"
            else
                echo -e "${YELLOW}????PHP not available - APP_KEY remains unset${NC}"
            fi
        fi
    else
        echo -e "${BLUE}????${env_file} already exists${NC}"
    fi

    # Set secure permissions
    if [ -f "$full_env_path" ]; then
        chmod 600 "$full_env_path"
        echo -e "${GREEN}????Applied secure file permissions (600)${NC}"
    fi
}

# Ensures production environment configuration
# Usage: ensure_production_environment [project_root]
ensure_production_environment() {
    local env_file=".env"
    local project_root="${1:-$(pwd)}"
    local full_env_path="${project_root}/${env_file}"
    local changes_made=false

    echo -e "\n${BLUE}[ENV CONFIG] Validating production settings${NC}"

    # Verify .env exists
    if [ ! -f "$full_env_path" ]; then
        echo -e "${RED}????Error: ${env_file} not found in ${project_root}${NC}"
        return 1
    fi

    # Create backup
    cp "$full_env_path" "${full_env_path}.bak"
    
    # Configure APP_ENV
    if grep -q "^APP_ENV=" "$full_env_path"; then
        if ! grep -q "^APP_ENV=production$" "$full_env_path"; then
            sed -i 's/^APP_ENV=.*/APP_ENV=production/' "$full_env_path"
            changes_made=true
            echo -e "${GREEN}????Set APP_ENV to production${NC}"
        fi
    else
        echo "APP_ENV=production" >> "$full_env_path"
        changes_made=true
        echo -e "${GREEN}????Added APP_ENV setting${NC}"
    fi

    # Configure APP_DEBUG
    if grep -q "^APP_DEBUG=" "$full_env_path"; then
        if ! grep -q "^APP_DEBUG=false$" "$full_env_path"; then
            sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' "$full_env_path"
            changes_made=true
            echo -e "${GREEN}????Disabled debug mode${NC}"
        fi
    else
        echo "APP_DEBUG=false" >> "$full_env_path"
        changes_made=true
        echo -e "${GREEN}????Added APP_DEBUG setting${NC}"
    fi

    # Cleanup if no changes were needed
    if [ "$changes_made" = false ]; then
        rm -f "${full_env_path}.bak"
        echo -e "${BLUE}????Production settings already configured${NC}"
    else
        echo -e "${GREEN}????Production configuration complete${NC}"
    fi
}
# Enhanced initialization check with double confirmation
check_initialization() {
    if [ -f ".laravel_initialized" ]; then
        echo -e "${YELLOW}Warning: Project has already been initialized.${NC}"
        echo -e "This script will reset server configuration and clear existing data."

        # First confirmation
        read -p "Do you want to continue? (yes/NO): " confirm1
        if [[ "${confirm1,,}" != "yes" ]]; then
            echo -e "${GREEN}Operation cancelled. To start server normally, use:"
            echo -e "  php artisan serve${NC}"
            exit 0
        fi

        # Second confirmation
        echo -e "\n${RED}WARNING: This will reset server configuration!${NC}"
        read -p "Type YES to confirm reset: " confirm2
        if [[ "${confirm2^^}" != "YES" ]]; then
            echo -e "${GREEN}Reset cancelled. Existing installation preserved.${NC}"
            exit 0
        fi

        # Proceed with reset
        echo -e "\n${RED}Resetting Laravel installation...${NC}"
        rm -f .laravel_initialized

        # Additional cleanup if needed
        [ -f ".env" ] && mv .env .env.backup
        [ -d "storage/framework/cache" ] && rm -rf storage/framework/cache/*
        [ -d "storage/framework/sessions" ] && rm -rf storage/framework/sessions/*
        [ -d "storage/framework/views" ] && rm -rf storage/framework/views/*

        echo -e "${YELLOW}Previous installation cleared. Proceeding with fresh setup...${NC}"
    fi
}

# Later in your script:
check_initialization

# Normal initialization continues here...
# Get confirmation before proceeding
read -p "This script will initialize your Laravel project. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Initialization cancelled."
    exit 1
fi

# Change to the script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "Changed to directory: $SCRIPT_DIR"

# Function to setup directory permissions
setup_permissions() {
    echo "Setting up directory permissions..."

    # Prompt for username with 5 second timeout
    read -t 5 -p "Enter username [default: www]: " username
    if [ -z "$username" ]; then
        username="www"
    fi

    # Check if user exists
    if ! id "$username" &>/dev/null; then
        echo "User $username does not exist, using current user: $USER"
        username="$USER"
    fi

    # Reset Laravel directories
    echo "Resetting Laravel directories..."
    rm -rf storage/framework/views/*
    rm -rf storage/framework/cache/*
    rm -rf storage/framework/sessions/*
    rm -rf storage/logs/*
    rm -rf bootstrap/cache/*

    # Create directories if they don't exist
    mkdir -p storage/framework/views
    mkdir -p storage/framework/cache
    mkdir -p storage/framework/sessions
    mkdir -p storage/logs
    mkdir -p bootstrap/cache

    # Set ownership and permissions
    echo "Setting ownership to $username:$username"
    chown -R "$username:$username" .
    echo "Setting directory permissions to 755"
    find . -type d -exec chmod 755 {} \;
    echo "Setting file permissions to 644"
    find . -type f -exec chmod 644 {} \;

    # Set special permissions for storage and bootstrap/cache
    echo "Setting special permissions for storage and bootstrap/cache"
    chmod -R 775 storage
    chmod -R 775 bootstrap/cache
}

# Function to check and install PHP 8.4
ensure_php_84() {
    if command -v php &>/dev/null; then
        php_version=$(php -v | head -n 1 | cut -d " " -f 2)
        echo "PHP version: $php_version"
    else
        echo "PHP is not installed. Installing PHP..."
        sudo apt update
        sudo apt install -y php
        php_version=$(php -v | head -n 1 | cut -d " " -f 2)
        echo "PHP version: $php_version"
    fi
}

# Function to check and install required PHP extensions
ensure_php_extensions() {
    echo "Checking required PHP extensions (dom, xml)..."
    if ! php -m | grep -q 'dom'; then
        echo "PHP extension 'dom' not found. Installing..."
        sudo apt update
        sudo apt install -y php-xml
    fi
    if ! php -m | grep -q 'xml'; then
        echo "PHP extension 'xml' not found. Installing..."
        sudo apt update
        sudo apt install -y php-xml
    fi
}

# Function to check and install Composer
ensure_composer() {
    if command -v composer &>/dev/null; then
        composer_version=$(composer --version | cut -d " " -f 3)
        echo "Composer version: $composer_version"
    else
        echo "Composer is not installed. Installing Composer..."
        # Download Composer installer
        php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
        # Verify installer signature
        php -r "if (hash_file('sha384', 'composer-setup.php') === 'e21205b207c3ff031906575712edab6f13eb0b361f2085f1f1237b7126d785e826a450292b6cfd1d64d92e6563bbde02') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;"
        # Install Composer
        sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
        # Remove installer
        rm composer-setup.php
        composer_version=$(composer --version | cut -d " " -f 3)
        echo "Composer version: $composer_version"
    fi
}

# Function to check and install vendor dependencies
ensure_vendor() {
    if [ ! -d "vendor" ]; then
        echo "Vendor directory not found. Installing dependencies..."
        composer install
    else
        echo "Vendor directory exists."
    fi
}

# Function to clear Laravel cache
clear_cache() {
    echo "Clearing Laravel cache..."
    php artisan cache:clear
    php artisan config:clear
    php artisan route:clear
    php artisan view:clear
}
# Function to handle SQLite database with intelligent migration
handle_database() {
    # Use gvar_common.sh map_web_path to get correct path
    local wwwroot=$(map_web_path "wwwroot")
    DB_DIR="$wwwroot/laravel_db"
    DB_FILE="$DB_DIR/database.sqlite"
    ENV_FILE=".env"

    echo -e "${BLUE}[DATABASE] Initializing SQLite database${NC}"
    echo "Database file location: ${GREEN}$DB_FILE${NC}"

    # 1. Ensure database directory exists
    if [ ! -d "$DB_DIR" ]; then
        mkdir -p "$DB_DIR"
        echo -e "${YELLOW}Created database directory${NC}"
    fi

    # 2. Handle database file creation
    db_exists=false
    if [ ! -f "$DB_FILE" ]; then
        read -p "Database file does not exist. Create it? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            touch "$DB_FILE"
            echo -e "${GREEN}Created new database file${NC}"
        else
            echo -e "${YELLOW}Skipping database initialization${NC}"
            return
        fi
    else
        db_exists=true
        echo -e "${GREEN}Using existing database${NC}"
    fi

    # 3. Configure .env file
    if [ ! -f "$ENV_FILE" ]; then
        cp .env.example "$ENV_FILE"
        echo -e "${YELLOW}Created .env file from example${NC}"
    fi

    # Update .env with SQLite configuration
    if ! grep -q "^DB_CONNECTION=sqlite" "$ENV_FILE"; then
        sed -i 's/DB_CONNECTION=.*/DB_CONNECTION=sqlite/' "$ENV_FILE"
    fi
    sed -i "s|^DB_DATABASE=.*|DB_DATABASE=$DB_FILE|" "$ENV_FILE"

    # 4. Run appropriate migrations based on database state
    if [ "$db_exists" = true ]; then
        echo -e "${BLUE}[DATABASE] Running schema updates on existing database${NC}"
        php artisan migrate --force
    else
        echo -e "${BLUE}[DATABASE] Initializing new database with migrations${NC}"
        php artisan migrate:fresh --force --seed
    fi

    # 5. Optional configuration (if needed)
    if [ -f "artisan" ] && php artisan | grep -q "database:config"; then
        php artisan database:config
    fi

    # Set proper permissions
    chmod 755 "$DB_DIR"
    chmod 644 "$DB_FILE"
    echo -e "${GREEN}Database setup complete${NC}"
}
# Function to start Laravel server
start_server() {
    echo "Starting Laravel development server..."
    php artisan serve --host=0.0.0.0
}
# Function to configure open_basedir in project's .user.ini
configure_project_open_basedir() {
    echo -e "${BLUE}[PHP CONFIG] Configuring open_basedir in project .user.ini${NC}"

    # Get current script directory (project root)
    local project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local user_ini_file="$project_root/public/.user.ini"
    local manual_config_needed=false

    # For Laravel poly projects, disable open_basedir entirely to allow PathMapper environment detection
    # PathMapper needs to check /mnt/c, /mnt/d, /data, /www directories for environment detection
    local new_basedir="none"
    local security_settings=$'\n; Security settings\ndisable_functions = exec,passthru,shell_exec,system,proc_open,popen\nexpose_php = Off'

    echo -e "Project root: ${GREEN}$project_root${NC}"
    echo -e "Target .user.ini: ${GREEN}$user_ini_file${NC}"
    echo -e "Open_basedir setting: ${GREEN}$new_basedir${NC} ${YELLOW}(disabled for Laravel poly project)${NC}"

    # Create public directory if missing (may fail due to permissions)
    if [ ! -d "$project_root/public" ]; then
        if mkdir -p "$project_root/public" 2>/dev/null; then
            echo -e "${YELLOW}????Created public directory${NC}"
        else
            echo -e "${RED}????Permission denied: Cannot create public directory${NC}"
            manual_config_needed=true
        fi
    fi

    # Check if we can write to .user.ini
    local can_write=false
    if [ -f "$user_ini_file" ]; then
        [ -w "$user_ini_file" ] && can_write=true
    else
        [ -w "$project_root/public" ] && can_write=true
    fi

    if [ "$manual_config_needed" = false ] && [ "$can_write" = true ]; then
        # Automated configuration possible
        if [ -f "$user_ini_file" ]; then
            cp "$user_ini_file" "$user_ini_file.bak" && echo -e "${GREEN}????Backed up existing .user.ini${NC}"
        fi

        if grep -q "^open_basedir" "$user_ini_file" 2>/dev/null; then
            sed -i "s|^open_basedir.*|open_basedir = $new_basedir|" "$user_ini_file" && \
            echo -e "${GREEN}Updated open_basedir directive to: $new_basedir${NC}"
        else
            echo "open_basedir = $new_basedir" >> "$user_ini_file" && \
            echo -e "${GREEN}Added open_basedir directive: $new_basedir${NC}"
        fi

        # Add comment explaining why open_basedir is disabled
        if ! grep -q "PathMapper" "$user_ini_file" 2>/dev/null; then
            sed -i '1i; Disable open_basedir for Laravel poly projects to allow PathMapper environment detection' "$user_ini_file" && \
            echo -e "${GREEN}Added configuration comment${NC}"
        fi

        chmod 644 "$user_ini_file" && echo -e "${GREEN}Set correct file permissions (644)${NC}"

        if ! grep -q "^disable_functions" "$user_ini_file" 2>/dev/null; then
            echo "$security_settings" >> "$user_ini_file" && \
            echo -e "${GREEN}Added security hardening settings${NC}"
        fi
    else
        # Manual configuration required
        echo -e "\n${RED}Insufficient permissions for automated configuration${NC}"
        echo -e "${YELLOW}Please manually create/update ${user_ini_file} with:${NC}"
        echo -e "--------------------------------------------------"
        echo -e "; Disable open_basedir for Laravel poly projects to allow PathMapper environment detection"
        echo -e "open_basedir = ${new_basedir}"
        echo -e "$security_settings"
        echo -e "--------------------------------------------------"
        echo -e "${YELLOW}Then run: chmod 644 ${user_ini_file}${NC}"
        return 1
    fi

    # Verify and display final configuration
    if [ -f "$user_ini_file" ]; then
        echo -e "\n${GREEN}Final .user.ini content:${NC}"
        cat "$user_ini_file"
        echo -e "\n${GREEN}Configuration completed successfully${NC}"
        echo -e "${YELLOW}Note: Changes will take effect on the next PHP request${NC}"
    else
        echo -e "${RED}????Configuration failed - .user.ini not created${NC}"
        return 1
    fi
}

configure_laravel_nginx() {
    echo -e "\n\033[34m[LARAVEL NGINX CONFIGURATION]\033[0m"
    echo "This will guide you to add Laravel-specific rules to your Nginx configuration in BT/aapanel."

    echo -e "\n\033[36m=== Required Configuration ===\033[0m"
    cat <<EOF

Add these directives to your site's Nginx configuration in BT/aapanel:

1. Go to: Websites -> Select Site -> Configuration Files
2. Find the "server" block and add:

location / {
    try_files \$uri \$uri/ /index.php?\$query_string;
}

location ~ \.php\$ {
    fastcgi_pass   unix:/tmp/php-cgi-84.sock;
    fastcgi_index  index.php;
    fastcgi_param  SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
    include        fastcgi_params;
    fastcgi_hide_header X-Powered-By;
    
    # Security enhancements
    fastcgi_read_timeout 300;
    fastcgi_buffer_size 128k;
    fastcgi_buffers 4 256k;
}

3. Click "Save" and restart Nginx.
EOF

    echo -e "\n\033[32m????Configuration instructions generated\033[0m"
    echo -e "\033[33mNote:\033[0m Replace '/tmp/php-cgi-84.sock' with your actual PHP-FPM socket path if different."
}
# Check if running on Debian/Ubuntu
if [ -f /etc/debian_version ]; then
    echo "System detected as Debian/Ubuntu"
    
    # Fix prerequisites and common issues first
    fix_prerequisites
    
    ensure_env_file
    ensure_production_environment
    setup_permissions
    ensure_php_84
    ensure_php_extensions
    ensure_composer
    ensure_vendor
    clear_cache
    handle_database
    configure_project_open_basedir
    configure_laravel_nginx
    # Create initialization marker
    touch .laravel_initialized
    echo "Project initialization completed. Marker file created."

    # Start server
    start_server
else
    echo "This script only supports Debian/Ubuntu systems"
    exit 1
fi
