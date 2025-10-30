#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="130"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

echo "[$SCRIPT_INDEX] Domain Setup Script - Adding domains to nginx and certbot"

# USE_SUDO is already defined in gvar_common.sh
echo "[$SCRIPT_INDEX] Using sudo configuration from gvar_common.sh: ${USE_SUDO:-'(none)'}"

# Function to initialize system directories
initialize_system_directories() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] INITIALIZING SYSTEM DIRECTORIES"
    echo "[$SCRIPT_INDEX] =================================="

    # List of critical system directories
    local system_dirs=(
        "/www/nginxconfig"
        "/www/nginxconfig/ssl"
        "/www/nginxconfig/sites-available"
        "/www/nginxconfig/sites-enabled"
        "/www/wwwroot"
        "/www/wwwroot/laravel_main"
        "/www/wwwroot/laravel_main/laravel_db"
        "/www/server/panel/vhost/cert"
    )

    # Also use mapped paths from gvar_common.sh
    local www_root=$(map_web_path "wwwroot")
    local nginx_config=$(map_web_path "nginxconfig")
    local ssl_dir=$(map_web_path "nginxconfig")/ssl
    local shared_data=$(map_web_path "shared-data")
    local backup_dir=$(map_web_path "backup")

    # Add mapped paths to directories list
    system_dirs+=("$www_root" "$nginx_config" "$shared_data" "$backup_dir")

    # Add Laravel-specific paths that match DatabasePathHelper logic
    local laravel_main="$www_root/laravel_main"
    local laravel_db="$laravel_main/laravel_db"
    system_dirs+=("$laravel_main" "$laravel_db")

    echo "[$SCRIPT_INDEX] Using mapped paths from gvar_common.sh:"
    echo "[$SCRIPT_INDEX]   wwwroot: $www_root"
    echo "[$SCRIPT_INDEX]   nginxconfig: $nginx_config"
    echo "[$SCRIPT_INDEX]   ssl: $ssl_dir"
    echo "[$SCRIPT_INDEX]   shared-data: $shared_data"
    echo "[$SCRIPT_INDEX]   backup: $backup_dir"
    echo "[$SCRIPT_INDEX]   laravel_main: $laravel_main"
    echo "[$SCRIPT_INDEX]   laravel_db: $laravel_db"

    for dir in "${system_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "[$SCRIPT_INDEX]   Creating: $dir"
            $USE_SUDO mkdir -p "$dir" 2>/dev/null || {
                echo "[$SCRIPT_INDEX]   ✗ Failed to create $dir"
                return 1
            }
            # Set appropriate permissions
            $USE_SUDO chmod 755 "$dir" 2>/dev/null || true
            echo "[$SCRIPT_INDEX]   ✓ Created: $dir"
        else
            echo "[$SCRIPT_INDEX]   ✓ Exists: $dir"
        fi
    done

    # Ensure current user and www-data can write to these directories
    echo "[$SCRIPT_INDEX] Setting ownership and permissions..."
    for dir in "${system_dirs[@]}"; do
        if [ -d "$dir" ]; then
            # Set ownership to current user with www-data as group
            if [ "$IS_WSL" = true ]; then
                # WSL doesn't support chown properly, just set permissions
                $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
                echo "[$SCRIPT_INDEX]   ✓ Set WSL permissions: $dir"
            else
                # Linux: Set ownership and group
                $USE_SUDO chown -R $USER:www-data "$dir" 2>/dev/null || {
                    echo "[$SCRIPT_INDEX]   ⚠ Could not set user:www-data, trying 777..."
                    $USE_SUDO chmod -R 777 "$dir" 2>/dev/null || true
                }
                # Set group write permissions
                $USE_SUDO chmod -R 775 "$dir" 2>/dev/null || true
                echo "[$SCRIPT_INDEX]   ✓ Set ownership: $dir"
            fi
        fi
    done

    # Verify writable using actual mapped paths
    echo "[$SCRIPT_INDEX] Verifying write permissions..."
    local test_dirs=("$ssl_dir" "$www_root" "$laravel_db")
    local permission_errors=0
    for dir in "${test_dirs[@]}"; do
        if [ -d "$dir" ] && [ ! -w "$dir" ]; then
            echo "[$SCRIPT_INDEX]   ✗ Not writable: $dir"
            permission_errors=$((permission_errors + 1))
        elif [ -d "$dir" ]; then
            echo "[$SCRIPT_INDEX]   ✓ Writable: $dir"
        else
            echo "[$SCRIPT_INDEX]   ⚠ Directory not found: $dir"
        fi
    done

    if [ $permission_errors -gt 0 ]; then
        echo "[$SCRIPT_INDEX] ⚠ Warning: $permission_errors directories are not writable"
        echo "[$SCRIPT_INDEX]   This may cause Laravel commands to fail"
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] ✓ System directories initialized"
    echo "[$SCRIPT_INDEX] =================================="
    return 0
}

# Function to install certbot-dns-dnspod plugin
install_certbot_dnspod() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] CHECKING CERTBOT-DNS-DNSPOD PLUGIN"
    echo "[$SCRIPT_INDEX] =================================="

    # Check if pip3 is available
    if ! command -v pip3 >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] pip3 not found, installing python3-pip..."
        $USE_SUDO apt-get update >/dev/null 2>&1
        $USE_SUDO apt-get install -y python3-pip >/dev/null 2>&1 || {
            echo "[$SCRIPT_INDEX] ✗ Failed to install python3-pip"
            return 1
        }
        echo "[$SCRIPT_INDEX] ✓ python3-pip installed"
    else
        echo "[$SCRIPT_INDEX] ✓ pip3 is available"
    fi

    # Check if certbot-dns-dnspod is installed
    if pip3 list 2>/dev/null | grep -qi "certbot-dns-dnspod"; then
        echo "[$SCRIPT_INDEX] ✓ certbot-dns-dnspod already installed"
        local version=$(pip3 show certbot-dns-dnspod 2>/dev/null | grep "Version:" | cut -d' ' -f2)
        echo "[$SCRIPT_INDEX]   Version: ${version:-unknown}"
        return 0
    fi

    echo "[$SCRIPT_INDEX] Installing certbot-dns-dnspod..."
    $USE_SUDO pip3 install certbot-dns-dnspod --break-system-packages 2>&1 | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo "[$SCRIPT_INDEX] ✓ certbot-dns-dnspod installed successfully"
    else
        echo "[$SCRIPT_INDEX] ⚠ certbot-dns-dnspod installation had issues, but continuing..."
    fi

    echo "[$SCRIPT_INDEX] =================================="
    return 0
}

# Function to check and display environment information
check_environment() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] ENVIRONMENT DIAGNOSTICS"
    echo "[$SCRIPT_INDEX] =================================="

    # Check PHP
    echo "[$SCRIPT_INDEX] Checking PHP..."
    if command -v php >/dev/null 2>&1; then
        local php_version=$(php -v 2>&1 | head -n 1)
        echo "[$SCRIPT_INDEX]   ✓ PHP installed: $php_version"

        # Check PHP CLI SAPI
        local php_sapi=$(php -r "echo PHP_SAPI;" 2>/dev/null)
        echo "[$SCRIPT_INDEX]   PHP SAPI: $php_sapi"

        # Check important PHP extensions
        echo "[$SCRIPT_INDEX]   Checking PHP extensions..."
        local required_extensions=("mbstring" "json" "pdo" "openssl" "tokenizer" "xml" "ctype" "fileinfo")
        for ext in "${required_extensions[@]}"; do
            if php -m 2>/dev/null | grep -qi "^$ext$"; then
                echo "[$SCRIPT_INDEX]     ✓ $ext"
            else
                echo "[$SCRIPT_INDEX]     ✗ $ext (MISSING)"
            fi
        done
    else
        echo "[$SCRIPT_INDEX]   ✗ PHP not found in PATH"
        echo "[$SCRIPT_INDEX]   Please install PHP first"
        return 1
    fi

    # Check Composer
    echo "[$SCRIPT_INDEX] Checking Composer..."
    if command -v composer >/dev/null 2>&1; then
        local composer_version=$(composer --version 2>&1 | head -n 1)
        echo "[$SCRIPT_INDEX]   ✓ Composer installed: $composer_version"
    else
        echo "[$SCRIPT_INDEX]   ✗ Composer not found in PATH"
        echo "[$SCRIPT_INDEX]   Please install Composer first"
        return 1
    fi

    # Check Node/NPM (optional but good to know)
    echo "[$SCRIPT_INDEX] Checking Node.js (optional)..."
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version 2>&1)
        echo "[$SCRIPT_INDEX]   ✓ Node.js installed: $node_version"
    else
        echo "[$SCRIPT_INDEX]   ℹ Node.js not found (not required for headless Laravel)"
    fi

    # Check Git
    echo "[$SCRIPT_INDEX] Checking Git..."
    if command -v git >/dev/null 2>&1; then
        local git_version=$(git --version 2>&1)
        echo "[$SCRIPT_INDEX]   ✓ Git installed: $git_version"
    else
        echo "[$SCRIPT_INDEX]   ✗ Git not found"
    fi

    # Check Nginx
    echo "[$SCRIPT_INDEX] Checking Nginx..."
    if command -v nginx >/dev/null 2>&1; then
        local nginx_version=$(nginx -v 2>&1)
        echo "[$SCRIPT_INDEX]   ✓ Nginx installed: $nginx_version"

        # Check if nginx is running
        if pgrep nginx >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX]   ✓ Nginx is running"
        else
            echo "[$SCRIPT_INDEX]   ⚠ Nginx is installed but not running"
        fi
    else
        echo "[$SCRIPT_INDEX]   ✗ Nginx not found"
    fi

    # Check Certbot
    echo "[$SCRIPT_INDEX] Checking Certbot..."
    if command -v certbot >/dev/null 2>&1; then
        local certbot_version=$(certbot --version 2>&1)
        echo "[$SCRIPT_INDEX]   ✓ Certbot installed: $certbot_version"
    else
        echo "[$SCRIPT_INDEX]   ✗ Certbot not found"
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo ""

    return 0
}

# Function to initialize Laravel directories and permissions
initialize_laravel_directories() {
    local laravel_dir="$1"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] INITIALIZING LARAVEL DIRECTORIES"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Laravel directory: $laravel_dir"

    cd "$laravel_dir" || {
        echo "[$SCRIPT_INDEX] Error: Cannot change to Laravel directory"
        return 1
    }

    # Create required directories
    echo "[$SCRIPT_INDEX] Creating required directories..."
    local directories=(
        "bootstrap/cache"
        "storage/framework/cache"
        "storage/framework/sessions"
        "storage/framework/views"
        "storage/logs"
        "storage/app/public"
    )

    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "[$SCRIPT_INDEX]   Creating: $dir"
            mkdir -p "$dir" 2>/dev/null || {
                echo "[$SCRIPT_INDEX]   ⚠ Failed to create $dir, trying with sudo..."
                $USE_SUDO mkdir -p "$dir" || {
                    echo "[$SCRIPT_INDEX]   ✗ Failed to create $dir even with sudo"
                    return 1
                }
            }
        else
            echo "[$SCRIPT_INDEX]   ✓ Exists: $dir"
        fi
    done

    # Set permissions
    echo "[$SCRIPT_INDEX] Setting permissions..."

    # Critical directories need 777 for Laravel to write
    echo "[$SCRIPT_INDEX]   Setting 777 for storage..."
    chmod -R 777 storage 2>/dev/null || $USE_SUDO chmod -R 777 storage || {
        echo "[$SCRIPT_INDEX]   ⚠ Could not set storage permissions"
    }

    echo "[$SCRIPT_INDEX]   Setting 777 for bootstrap/cache..."
    chmod -R 777 bootstrap/cache 2>/dev/null || $USE_SUDO chmod -R 777 bootstrap/cache || {
        echo "[$SCRIPT_INDEX]   ⚠ Could not set bootstrap/cache permissions"
    }

    # Make artisan executable
    echo "[$SCRIPT_INDEX]   Making artisan executable..."
    chmod +x artisan 2>/dev/null || $USE_SUDO chmod +x artisan || true

    # Verify critical permissions
    echo "[$SCRIPT_INDEX] Verifying permissions..."
    local permission_errors=0

    if [ ! -w "storage" ]; then
        echo "[$SCRIPT_INDEX]   ✗ storage directory is not writable"
        permission_errors=$((permission_errors + 1))
    else
        echo "[$SCRIPT_INDEX]   ✓ storage directory is writable"
    fi

    if [ ! -w "bootstrap/cache" ]; then
        echo "[$SCRIPT_INDEX]   ✗ bootstrap/cache directory is not writable"
        permission_errors=$((permission_errors + 1))
    else
        echo "[$SCRIPT_INDEX]   ✓ bootstrap/cache directory is writable"
    fi

    if [ $permission_errors -gt 0 ]; then
        echo "[$SCRIPT_INDEX] ⚠ Warning: $permission_errors permission issues remain"
        echo "[$SCRIPT_INDEX] Attempting to use deploy.sh for complete initialization..."
        return 2  # Signal that we should try deploy.sh
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] ✓ Laravel directories initialized"
    echo "[$SCRIPT_INDEX] =================================="
    return 0
}

# Function to run Laravel deploy.sh for full initialization
run_laravel_deploy_init() {
    local laravel_dir="$1"
    local deploy_script="$laravel_dir/scripts/deploy.sh"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] RUNNING LARAVEL DEPLOY SCRIPT"
    echo "[$SCRIPT_INDEX] =================================="

    if [ ! -f "$deploy_script" ]; then
        echo "[$SCRIPT_INDEX] Error: deploy.sh not found at: $deploy_script"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Deploy script: $deploy_script"
    echo "[$SCRIPT_INDEX] This will perform full Laravel initialization..."
    echo "[$SCRIPT_INDEX]"

    # Make deploy.sh executable
    chmod +x "$deploy_script" 2>/dev/null || $USE_SUDO chmod +x "$deploy_script"

    # Run deploy.sh
    cd "$laravel_dir" || return 1

    echo "[$SCRIPT_INDEX] Executing deploy.sh (this may take a while)..."
    echo "[$SCRIPT_INDEX] =================================="

    bash "$deploy_script" || {
        local exit_code=$?
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] ⚠ deploy.sh exited with code: $exit_code"
        echo "[$SCRIPT_INDEX] Continuing anyway..."
        return 0  # Don't fail completely
    }

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] ✓ Deploy script completed"
    echo "[$SCRIPT_INDEX] =================================="
    return 0
}

# Function to get Laravel directory path using centralized CORE_NODE_DIR
get_laravel_dir() {
    # Use CORE_NODE_DIR from gvar_common.sh
    if [ -z "$CORE_NODE_DIR" ]; then
        # Fallback: Calculate from script location
        local script_root="$(cd "$PARENT_DIR_LEVEL_2/../.." && pwd)"
        echo "[$SCRIPT_INDEX] Warning: CORE_NODE_DIR not set, using fallback: $script_root"
        local laravel_dir="$script_root/poly_apps/laravel_main"
    else
        local laravel_dir="$CORE_NODE_DIR/poly_apps/laravel_main"
    fi

    # Verify the path exists
    if [ ! -d "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Laravel directory does not exist: $laravel_dir"
        return 1
    fi

    echo "$laravel_dir"
}

# Function to check if Laravel is available
check_laravel_available() {
    local laravel_dir=$(get_laravel_dir)

    if [ ! -d "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Laravel directory not found: $laravel_dir"
        return 1
    fi

    if [ ! -f "$laravel_dir/artisan" ]; then
        echo "[$SCRIPT_INDEX] Laravel artisan not found: $laravel_dir/artisan"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Laravel directory found: $laravel_dir"

    # Initialize Laravel directories and permissions BEFORE checking
    echo "[$SCRIPT_INDEX]"
    initialize_laravel_directories "$laravel_dir"
    local init_result=$?

    if [ $init_result -eq 2 ]; then
        # Permission issues detected, try deploy.sh
        echo "[$SCRIPT_INDEX]"
        run_laravel_deploy_init "$laravel_dir"
    elif [ $init_result -ne 0 ]; then
        echo "[$SCRIPT_INDEX] Failed to initialize Laravel directories"
        return 1
    fi

    # Check Laravel environment
    echo "[$SCRIPT_INDEX] Checking Laravel environment..."
    cd "$laravel_dir"

    # Check vendor directory
    if [ ! -d "vendor" ]; then
        echo "[$SCRIPT_INDEX] Warning: vendor directory not found, running composer install..."
        echo "[$SCRIPT_INDEX] Executing: composer install --optimize-autoloader"

        composer install --optimize-autoloader
        if [ $? -ne 0 ]; then
            echo "[$SCRIPT_INDEX] Error: Failed to install composer dependencies"
            return 1
        fi
        echo "[$SCRIPT_INDEX] Composer dependencies installed successfully"
    else
        echo "[$SCRIPT_INDEX] Vendor directory exists, skipping composer install"
    fi

    # Test artisan command with detailed debugging
    echo "[$SCRIPT_INDEX] Testing artisan command..."
    echo "[$SCRIPT_INDEX] Current directory: $(pwd)"
    echo "[$SCRIPT_INDEX] Artisan file exists: $([ -f artisan ] && echo 'YES' || echo 'NO')"

    # Try to run artisan and capture full output
    local artisan_output
    local artisan_exit_code
    artisan_output=$(php artisan --version 2>&1)
    artisan_exit_code=$?

    if [ $artisan_exit_code -ne 0 ]; then
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] ERROR: artisan command failed"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] Exit code: $artisan_exit_code"
        echo "[$SCRIPT_INDEX] Output:"
        echo "$artisan_output" | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done
        echo "[$SCRIPT_INDEX] =================================="

        # Check .env file
        if [ ! -f ".env" ]; then
            echo "[$SCRIPT_INDEX] ⚠ .env file not found!"
            if [ -f ".env.example" ]; then
                echo "[$SCRIPT_INDEX] ℹ .env.example exists. You may need to copy it:"
                echo "[$SCRIPT_INDEX]   cp .env.example .env"
                echo "[$SCRIPT_INDEX]   php artisan key:generate"
            fi
        else
            echo "[$SCRIPT_INDEX] ✓ .env file exists"

            # Check APP_KEY
            if grep -q "^APP_KEY=base64:" .env; then
                echo "[$SCRIPT_INDEX] ✓ APP_KEY is set"
            else
                echo "[$SCRIPT_INDEX] ⚠ APP_KEY not set. Run: php artisan key:generate"
            fi
        fi

        # Check storage permissions
        echo "[$SCRIPT_INDEX] Checking storage directory..."
        if [ -d "storage" ]; then
            local storage_writable=$([ -w "storage" ] && echo "YES" || echo "NO")
            echo "[$SCRIPT_INDEX] Storage writable: $storage_writable"
        else
            echo "[$SCRIPT_INDEX] ⚠ storage directory not found"
        fi

        # Check bootstrap/cache
        echo "[$SCRIPT_INDEX] Checking bootstrap/cache..."
        if [ -d "bootstrap/cache" ]; then
            local cache_writable=$([ -w "bootstrap/cache" ] && echo "YES" || echo "NO")
            echo "[$SCRIPT_INDEX] bootstrap/cache writable: $cache_writable"
        else
            echo "[$SCRIPT_INDEX] ⚠ bootstrap/cache directory not found"
        fi

        return 1
    else
        echo "[$SCRIPT_INDEX] ✓ Artisan command successful: $artisan_output"
    fi

    # Check database configuration
    echo "[$SCRIPT_INDEX] Checking database configuration..."
    if [ -f ".env" ]; then
        local db_connection=$(grep "^DB_CONNECTION=" .env 2>/dev/null | cut -d'=' -f2)
        local db_database=$(grep "^DB_DATABASE=" .env 2>/dev/null | cut -d'=' -f2)
        echo "[$SCRIPT_INDEX] DB_CONNECTION: ${db_connection:-'NOT SET'}"
        echo "[$SCRIPT_INDEX] DB_DATABASE: ${db_database:-'NOT SET'}"

        # Try to test database connection
        echo "[$SCRIPT_INDEX] Testing database connection..."
        local db_test_output
        db_test_output=$(php artisan db:show 2>&1 | head -n 5)
        if [ $? -eq 0 ]; then
            echo "[$SCRIPT_INDEX] ✓ Database connection successful"
        else
            echo "[$SCRIPT_INDEX] ⚠ Database connection test output:"
            echo "$db_test_output" | while IFS= read -r line; do
                echo "[$SCRIPT_INDEX]   $line"
            done
        fi
    fi

    # Verify required ServerManagerV1 commands exist
    echo "[$SCRIPT_INDEX] Verifying ServerManagerV1 commands..."
    local available_commands=$(php artisan list 2>/dev/null | grep -i servermanager || true)

    if [ -z "$available_commands" ]; then
        echo "[$SCRIPT_INDEX] ⚠ No servermanager commands found"
        echo "[$SCRIPT_INDEX] Listing all available artisan commands:"
        php artisan list 2>/dev/null | head -n 30 | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done
        return 1
    fi

    if ! echo "$available_commands" | grep -q "servermanager:certificate"; then
        echo "[$SCRIPT_INDEX] Warning: servermanager:certificate command not found"
        echo "[$SCRIPT_INDEX] Available ServerManager commands:"
        echo "$available_commands" | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done
        return 1
    fi

    if ! echo "$available_commands" | grep -q "servermanager:website"; then
        echo "[$SCRIPT_INDEX] Warning: servermanager:website command not found"
        echo "[$SCRIPT_INDEX] Available ServerManager commands:"
        echo "$available_commands" | while IFS= read -r line; do
            echo "[$SCRIPT_INDEX]   $line"
        done
        return 1
    fi

    echo "[$SCRIPT_INDEX] ✓ ServerManagerV1 commands verified:"
    echo "$available_commands" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] ✓ Laravel is ready for use"
    echo "[$SCRIPT_INDEX] =================================="
    return 0
}

# Function to read domains from secret storage
read_domains() {
    echo "[$SCRIPT_INDEX] Reading domains from secret storage..."

    local domains_content=$(get_secret_content "domains_list")
    if [ -z "$domains_content" ]; then
        echo "[$SCRIPT_INDEX] No domains found in secret storage"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Found domains:"
    echo "$domains_content" | while read -r domain; do
        if [ -n "$domain" ]; then
            echo "[$SCRIPT_INDEX]   - $domain"
        fi
    done

    return 0
}

# Function to get domains list (without debug output)
get_domains_list() {
    get_secret_content "domains_list" | tr -d '\r' | sed '/^$/d'
}

# Function to read DNSPod configuration
read_dnspod_config() {
    echo "[$SCRIPT_INDEX] Reading DNSPod configuration..."

    # Check if get_secret_content function exists
    if ! type get_secret_content >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Error: get_secret_content function not found"
        echo "[$SCRIPT_INDEX] Please ensure common_functions.sh is properly sourced"
        return 1
    fi

    local email=$(get_secret_content "dns_dnspod_email")
    local api_token=$(get_secret_content "dns_dnspod_api_token")

    if [ -z "$email" ] || [ -z "$api_token" ]; then
        echo "[$SCRIPT_INDEX] DNSPod configuration not found or incomplete"
        echo "[$SCRIPT_INDEX]   Email: ${email:-'NOT FOUND'}"
        echo "[$SCRIPT_INDEX]   API Token: ${api_token:+FOUND}"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Please configure DNSPod credentials in secret storage:"
        echo "[$SCRIPT_INDEX]   - dns_dnspod_email"
        echo "[$SCRIPT_INDEX]   - dns_dnspod_api_token"
        return 1
    fi

    # Validate email format
    if [[ ! "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        echo "[$SCRIPT_INDEX] Warning: DNSPod email format looks invalid: $email"
    fi

    echo "[$SCRIPT_INDEX] DNSPod configuration loaded:"
    echo "[$SCRIPT_INDEX]   Email: $email"
    echo "[$SCRIPT_INDEX]   API Token: [HIDDEN - ${#api_token} characters]"

    return 0
}

# Function to setup domain in nginx and certbot
setup_domain() {
    local domain="$1"
    local laravel_dir=$(get_laravel_dir)

    echo "[$SCRIPT_INDEX] Setting up domain: $domain"

    # Validate domain format
    if [[ ! "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        echo "[$SCRIPT_INDEX] Error: Invalid domain format: $domain"
        return 1
    fi

    # Change to Laravel directory
    if [ ! -d "$laravel_dir" ]; then
        echo "[$SCRIPT_INDEX] Error: Laravel directory not found: $laravel_dir"
        return 1
    fi

    cd "$laravel_dir" || {
        echo "[$SCRIPT_INDEX] Error: Failed to change to Laravel directory: $laravel_dir"
        return 1
    }

    # Domain validation will be handled by Laravel commands directly

    # Ensure wwwroot directory exists using path mapping from gvar_common.sh
    local www_root=$(map_web_path "wwwroot")
    echo "[$SCRIPT_INDEX] Ensuring $www_root directory exists..."
    if [ ! -d "$www_root" ]; then
        echo "[$SCRIPT_INDEX] Creating $www_root directory..."
        $USE_SUDO mkdir -p "$www_root"
        # Skip chown in WSL as Windows filesystem doesn't support it
        if [ "$IS_WSL" = false ]; then
            $USE_SUDO chown -R www-data:www-data "$www_root"
        fi
        $USE_SUDO chmod -R 755 "$www_root" 2>/dev/null || true
    fi

    # Create domain-specific directory
    local domain_dir="$www_root/$domain"
    if [ ! -d "$domain_dir" ]; then
        echo "[$SCRIPT_INDEX] Creating domain directory: $domain_dir"
        $USE_SUDO mkdir -p "$domain_dir"
        if [ "$IS_WSL" = false ]; then
            $USE_SUDO chown -R www-data:www-data "$domain_dir"
        fi
        $USE_SUDO chmod -R 755 "$domain_dir" 2>/dev/null || true
    fi

    # Use new Laravel commands instead of deploy
    echo "[$SCRIPT_INDEX] Setting up SSL certificate and website for: $domain"

    # Step 1: Add SSL certificate
    echo "[$SCRIPT_INDEX] Adding SSL certificate..."
    echo "[$SCRIPT_INDEX] Executing: php artisan servermanager:certificate add \"$domain\" --prefixes=si,sz,local,api --provider=dnspod"
    local ssl_output
    ssl_output=$(php artisan servermanager:certificate add "$domain" --prefixes=si,sz,local,api --provider=dnspod 2>&1)
    local ssl_result=$?

    echo "[$SCRIPT_INDEX] SSL certificate result:"
    echo "$ssl_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Determine PHP version (use 8.4 for compatibility)
    local php_version="8.4"

    # Step 2: Add local website (HTML - static content)
    echo "[$SCRIPT_INDEX] Adding local website..."
    echo "[$SCRIPT_INDEX] Executing: php artisan servermanager:website add \"local.$domain\" --type=html --ssl=auto --php-version=$php_version"
    local local_website_output
    local_website_output=$(php artisan servermanager:website add "local.$domain" --type=html --ssl=auto --php-version=$php_version 2>&1)
    local local_result=$?

    echo "[$SCRIPT_INDEX] Local website setup result:"
    echo "$local_website_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Step 3: Add API website (Poly - bind to Laravel main)
    echo "[$SCRIPT_INDEX] Adding API website..."
    echo "[$SCRIPT_INDEX] Executing: php artisan servermanager:website add \"api.$domain\" --type=poly --ssl=auto --php-version=$php_version"
    local api_website_output
    api_website_output=$(php artisan servermanager:website add "api.$domain" --type=poly --ssl=auto --php-version=$php_version 2>&1)
    local api_result=$?

    echo "[$SCRIPT_INDEX] API website setup result:"
    echo "$api_website_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Step 4: Add local.api website (Poly - for local testing with API)
    echo "[$SCRIPT_INDEX] Adding local.api website..."
    echo "[$SCRIPT_INDEX] Executing: php artisan servermanager:website add \"local.api.$domain\" --type=poly --ssl=auto --php-version=$php_version"
    local local_api_website_output
    local_api_website_output=$(php artisan servermanager:website add "local.api.$domain" --type=poly --ssl=auto --php-version=$php_version 2>&1)
    local local_api_result=$?

    echo "[$SCRIPT_INDEX] Local.api website setup result:"
    echo "$local_api_website_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Combine results
    local deploy_result=0
    if [ $ssl_result -ne 0 ] || [ $local_result -ne 0 ] || [ $api_result -ne 0 ] || [ $local_api_result -ne 0 ]; then
        deploy_result=1
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Domain Setup Summary for: $domain"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] SSL Certificate Result: $([ $ssl_result -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')"
    echo "[$SCRIPT_INDEX] Local Website Result: $([ $local_result -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')"
    echo "[$SCRIPT_INDEX] API Website Result: $([ $api_result -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')"
    echo "[$SCRIPT_INDEX] Local.API Website Result: $([ $local_api_result -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')"
    echo "[$SCRIPT_INDEX] =================================="

    if [ $deploy_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] Successfully deployed $domain"

        # Domain configuration is now handled by the Laravel website commands above
        echo "[$SCRIPT_INDEX] Domain configuration completed through Laravel commands"
    else
        echo "[$SCRIPT_INDEX] Failed to deploy $domain (exit code: $deploy_result)"
        return $deploy_result
    fi

    # SSL certificate generation and domain linking is now handled by the Laravel commands above
    # All deployment activities are managed through the Laravel command system

    echo "[$SCRIPT_INDEX] Domain setup completed for: $domain"
    return $deploy_result
}

# Function to get all possible IP addresses
get_possible_ips() {
    local ips=""

    # Get all network interface IPs (exclude loopback)
    local interface_ips=$(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | grep -v 'scope host lo' | awk '{print $2}' | cut -d'/' -f1 2>/dev/null)

    # Add interface IPs
    if [ -n "$interface_ips" ]; then
        ips="$ips $interface_ips"
    fi

    # Always include localhost as fallback
    ips="127.0.0.1 $ips"

    # Remove duplicates and empty entries
    echo "$ips" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' '
}

# Function to show Windows hosts file modification instructions
show_windows_hosts_info() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] LOCAL TESTING SETUP INSTRUCTIONS"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] For local testing, modify your Windows hosts file:"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Hosts file location:"
    echo "[$SCRIPT_INDEX]   C:\\Windows\\System32\\drivers\\etc\\hosts"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Add these lines to your hosts file:"
    echo "[$SCRIPT_INDEX] =================================="

    local possible_ips=$(get_possible_ips)

    local domains_content=$(get_domains_list)
    if [ -n "$domains_content" ]; then
        # Show entries for each IP address
        for ip in $possible_ips; do
            if [ -n "$ip" ]; then
                echo "# Using IP: $ip"
                echo "$domains_content" | while read -r domain; do
                    if [ -n "$domain" ]; then
                        echo "$ip    local.$domain"
                        echo "$ip    api.$domain"
                    fi
                done
                echo ""
            fi
        done
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Available IP addresses: $possible_ips"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Note: SSL certificates will work with DNS validation"
    echo "[$SCRIPT_INDEX] even when domains point to localhost for testing."
    echo "[$SCRIPT_INDEX]"
}

# Function to test nginx configuration
test_nginx_config() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] TESTING NGINX CONFIGURATION"
    echo "[$SCRIPT_INDEX] =================================="

    if ! command -v nginx >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] ✗ Nginx command not found"
        return 1
    fi

    local test_output
    test_output=$($USE_SUDO nginx -t 2>&1)
    local test_result=$?

    echo "[$SCRIPT_INDEX] Nginx configuration test output:"
    echo "$test_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    if [ $test_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] ✓ Nginx configuration test PASSED"
        return 0
    else
        echo "[$SCRIPT_INDEX] ✗ Nginx configuration test FAILED"
        return 1
    fi
}

# Function to reload nginx
reload_nginx() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] RELOADING NGINX"
    echo "[$SCRIPT_INDEX] =================================="

    if ! command -v nginx >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] ✗ Nginx command not found"
        return 1
    fi

    local reload_output
    reload_output=$($USE_SUDO systemctl reload nginx 2>&1)
    local reload_result=$?

    if [ $reload_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] ✓ Nginx reloaded successfully"
    else
        echo "[$SCRIPT_INDEX] ⚠ Nginx reload failed, trying restart..."
        reload_output=$($USE_SUDO systemctl restart nginx 2>&1)
        reload_result=$?

        if [ $reload_result -eq 0 ]; then
            echo "[$SCRIPT_INDEX] ✓ Nginx restarted successfully"
        else
            echo "[$SCRIPT_INDEX] ✗ Nginx restart failed"
            echo "$reload_output" | while IFS= read -r line; do
                echo "[$SCRIPT_INDEX]   $line"
            done
            return 1
        fi
    fi

    return 0
}

# Function to get nginx status
get_nginx_status() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] NGINX SERVICE STATUS"
    echo "[$SCRIPT_INDEX] =================================="

    if ! command -v nginx >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] ✗ Nginx command not found"
        return 1
    fi

    local status_output
    status_output=$($USE_SUDO systemctl status nginx 2>&1)
    local is_active=$($USE_SUDO systemctl is-active nginx 2>/dev/null)
    local is_enabled=$($USE_SUDO systemctl is-enabled nginx 2>/dev/null)

    echo "[$SCRIPT_INDEX] Service Status: $is_active"
    echo "[$SCRIPT_INDEX] Service Enabled: $is_enabled"
    echo "[$SCRIPT_INDEX]"

    if [ "$is_active" = "active" ]; then
        echo "[$SCRIPT_INDEX] ✓ Nginx is running"

        local nginx_pid=$(pgrep -o nginx 2>/dev/null)
        if [ -n "$nginx_pid" ]; then
            echo "[$SCRIPT_INDEX] Master PID: $nginx_pid"
        fi

        local worker_count=$(pgrep nginx | wc -l)
        echo "[$SCRIPT_INDEX] Worker processes: $worker_count"
    else
        echo "[$SCRIPT_INDEX] ✗ Nginx is not running"
    fi

    return 0
}

# Function to show nginx configuration files
show_nginx_configs() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] NGINX CONFIGURATION FILES"
    echo "[$SCRIPT_INDEX] =================================="

    local nginx_config_dir=$(map_web_path "nginxconfig")
    local sites_available="$nginx_config_dir/sites-available"
    local sites_enabled="$nginx_config_dir/sites-enabled"

    if [ ! -d "$sites_available" ]; then
        echo "[$SCRIPT_INDEX] ⚠ sites-available directory not found: $sites_available"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Configuration directory: $nginx_config_dir"
    echo "[$SCRIPT_INDEX] Sites available: $sites_available"
    echo "[$SCRIPT_INDEX] Sites enabled: $sites_enabled"
    echo "[$SCRIPT_INDEX]"

    local available_count=0
    local enabled_count=0

    if [ -d "$sites_available" ]; then
        available_count=$(find "$sites_available" -type f -name "*.conf" 2>/dev/null | wc -l)
    fi

    if [ -d "$sites_enabled" ]; then
        enabled_count=$(find "$sites_enabled" -type l 2>/dev/null | wc -l)
    fi

    echo "[$SCRIPT_INDEX] Total configuration files:"
    echo "[$SCRIPT_INDEX]   Available: $available_count"
    echo "[$SCRIPT_INDEX]   Enabled: $enabled_count"
    echo "[$SCRIPT_INDEX]"

    echo "[$SCRIPT_INDEX] Available configuration files:"
    if [ -d "$sites_available" ]; then
        local configs=$(find "$sites_available" -type f -name "*.conf" 2>/dev/null | sort)
        if [ -n "$configs" ]; then
            echo "$configs" | while IFS= read -r config_file; do
                local filename=$(basename "$config_file")
                local filesize=$(stat -f%z "$config_file" 2>/dev/null || stat -c%s "$config_file" 2>/dev/null || echo "unknown")

                local is_enabled="✗"
                local link_path="$sites_enabled/$filename"
                if [ -L "$link_path" ]; then
                    is_enabled="✓"
                fi

                echo "[$SCRIPT_INDEX]   [$is_enabled] $filename ($filesize bytes)"
            done
        else
            echo "[$SCRIPT_INDEX]   No configuration files found"
        fi
    fi

    echo "[$SCRIPT_INDEX]"
    return 0
}

# Function to show configuration file content
show_config_content() {
    local config_name="$1"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] CONFIGURATION FILE CONTENT"
    echo "[$SCRIPT_INDEX] =================================="

    local nginx_config_dir=$(map_web_path "nginxconfig")
    local sites_available="$nginx_config_dir/sites-available"
    local config_file="$sites_available/$config_name"

    if [ ! -f "$config_file" ]; then
        echo "[$SCRIPT_INDEX] ✗ Configuration file not found: $config_file"
        return 1
    fi

    echo "[$SCRIPT_INDEX] File: $config_file"
    echo "[$SCRIPT_INDEX] Size: $(stat -f%z "$config_file" 2>/dev/null || stat -c%s "$config_file" 2>/dev/null) bytes"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Content:"
    echo "[$SCRIPT_INDEX] =================================="

    cat "$config_file" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    echo "[$SCRIPT_INDEX] =================================="
    return 0
}

# Function to print detailed summary
print_summary() {
    local success_count="$1"
    local total_count="$2"

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] DOMAIN SETUP SUMMARY"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Successfully configured: $success_count/$total_count domains"
    echo "[$SCRIPT_INDEX]"

    # Get detailed information from Laravel commands
    echo "[$SCRIPT_INDEX] Fetching detailed information..."
    echo "[$SCRIPT_INDEX]"

    # Show website summary
    echo "[$SCRIPT_INDEX] WEBSITE SUMMARY:"
    php artisan servermanager:website summary 2>/dev/null | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done
    echo "[$SCRIPT_INDEX]"

    # Show certificate summary
    echo "[$SCRIPT_INDEX] CERTIFICATE SUMMARY:"
    php artisan servermanager:certificate summary 2>/dev/null | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done
    echo "[$SCRIPT_INDEX]"

    echo "[$SCRIPT_INDEX] Services configured:"
    echo "[$SCRIPT_INDEX]   - Nginx virtual hosts with expanded domain coverage"
    echo "[$SCRIPT_INDEX]   - SSL certificates (DNSPod DNS validation)"
    echo "[$SCRIPT_INDEX]   - Wildcard and subdomain certificate coverage"
    echo "[$SCRIPT_INDEX]   - Automatic certificate renewal"
    echo "[$SCRIPT_INDEX]   - Index.html files created"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] You can now access your domains:"

    local domains_content=$(get_domains_list)
    if [ -n "$domains_content" ]; then
        echo "$domains_content" | while read -r domain; do
            if [ -n "$domain" ]; then
                echo "[$SCRIPT_INDEX]   - https://$domain (with wildcard coverage)"
                echo "[$SCRIPT_INDEX]   - https://si.$domain, https://sz.$domain, https://local.$domain"
                echo "[$SCRIPT_INDEX]   - https://api.$domain, https://api.si.$domain, etc."
            fi
        done
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"

    # Show nginx configuration files
    show_nginx_configs

    # Test nginx configuration
    test_nginx_config
    local test_result=$?
    echo "[$SCRIPT_INDEX]"

    if [ $test_result -eq 0 ]; then
        # Get nginx status before reload
        get_nginx_status
        echo "[$SCRIPT_INDEX]"

        # Reload nginx
        reload_nginx
        echo "[$SCRIPT_INDEX]"

        # Get nginx status after reload
        get_nginx_status
    else
        echo "[$SCRIPT_INDEX] ⚠ Skipping nginx reload due to configuration errors"
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"

    # Show sample configuration file contents
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] SAMPLE NGINX CONFIGURATION FILES"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"

    local nginx_config_dir=$(map_web_path "nginxconfig")
    local sites_available="$nginx_config_dir/sites-available"

    if [ -d "$sites_available" ]; then
        local sample_configs=$(find "$sites_available" -type f -name "*.conf" 2>/dev/null | head -n 3)
        if [ -n "$sample_configs" ]; then
            echo "$sample_configs" | while IFS= read -r config_file; do
                echo "[$SCRIPT_INDEX]"
                show_config_content "$(basename "$config_file")"
                echo "[$SCRIPT_INDEX]"
            done
        else
            echo "[$SCRIPT_INDEX] No configuration files to display"
        fi
    fi

    echo "[$SCRIPT_INDEX] =================================="
}

# Main execution
echo "[$SCRIPT_INDEX] Starting domain setup process..."

# Check and display environment information
check_environment

# Initialize system directories FIRST
echo "[$SCRIPT_INDEX]"
initialize_system_directories || {
    echo "[$SCRIPT_INDEX] Failed to initialize system directories"
    exit 1
}

# Install certbot-dns-dnspod plugin
echo "[$SCRIPT_INDEX]"
install_certbot_dnspod || {
    echo "[$SCRIPT_INDEX] Warning: certbot-dns-dnspod installation failed, continuing..."
}

# Verify environment
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Verifying environment..."

# Check required functions are available
for func in get_secret_content map_web_path; do
    if ! type "$func" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Error: Required function '$func' not found"
        echo "[$SCRIPT_INDEX] Please ensure common_functions.sh is properly sourced"
        exit 1
    fi
done

# Check CORE_NODE_DIR or fallback path
echo "[$SCRIPT_INDEX] CORE_NODE_DIR: ${CORE_NODE_DIR:-'NOT SET (will use fallback)'}"

# Display readiness summary
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] SYSTEM READINESS SUMMARY"
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Environment:"
echo "[$SCRIPT_INDEX]   PHP: $(php --version 2>/dev/null | head -n1 | cut -d' ' -f2)"
echo "[$SCRIPT_INDEX]   Composer: $(composer --version 2>/dev/null | cut -d' ' -f3)"
echo "[$SCRIPT_INDEX]   Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"
echo "[$SCRIPT_INDEX]   Certbot: $(certbot --version 2>&1 | cut -d' ' -f2)"
echo "[$SCRIPT_INDEX]   certbot-dns-dnspod: $(pip3 show certbot-dns-dnspod 2>/dev/null | grep Version | cut -d' ' -f2 || echo 'NOT INSTALLED')"
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX] Directories (using mapped paths):"
local actual_www_root=$(map_web_path "wwwroot")
local actual_ssl_dir=$(map_web_path "nginxconfig")/ssl
local actual_laravel_db=$(map_web_path "wwwroot")/laravel_main/laravel_db

for check_dir in "$actual_ssl_dir" "$actual_www_root" "$actual_laravel_db"; do
    if [ -d "$check_dir" ] && [ -w "$check_dir" ]; then
        echo "[$SCRIPT_INDEX]   ✓ $check_dir (writable)"
    elif [ -d "$check_dir" ]; then
        echo "[$SCRIPT_INDEX]   ⚠ $check_dir (exists but NOT writable)"
    else
        echo "[$SCRIPT_INDEX]   ✗ $check_dir (does not exist)"
    fi
done
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX]"

# Check prerequisites
if ! check_laravel_available; then
    echo "[$SCRIPT_INDEX] Laravel is not available. Please install Laravel first."
    exit 1
fi

# Read configuration
if ! read_dnspod_config; then
    echo "[$SCRIPT_INDEX] DNSPod configuration is missing. Please check secret storage."
    exit 1
fi

# Read domains and show debug info
read_domains

domains_content=$(get_domains_list)
if [ -z "$domains_content" ]; then
    echo "[$SCRIPT_INDEX] No domains to configure. Exiting."
    exit 1
fi

# Setup each domain
success_count=0
total_count=0

# Use process substitution to avoid subshell issues
while read -r domain; do
    if [ -n "$domain" ]; then
        total_count=$((total_count + 1))

        echo "[$SCRIPT_INDEX] Processing domain: $domain"

        if setup_domain "$domain"; then
            success_count=$((success_count + 1))
            echo "[$SCRIPT_INDEX] ?Successfully configured: $domain"
        else
            echo "[$SCRIPT_INDEX] ?Failed to configure: $domain"
        fi

        echo "[$SCRIPT_INDEX] ---"
    fi
done <<< "$domains_content"

# Show local testing instructions
show_windows_hosts_info

# Print summary
print_summary "$success_count" "$total_count"

# Function to setup local testing mode
setup_local_testing_mode() {
    echo ""
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] LOCAL TESTING MODE SETUP"
    echo "[$SCRIPT_INDEX] =================================="

    # Get all configured domains
    local domains_content=$(get_domains_list)
    if [ -z "$domains_content" ]; then
        echo "[$SCRIPT_INDEX] No domains found to configure"
        return 1
    fi

    # Parse domains into array
    local -a all_domains=()
    while read -r domain; do
        if [ -n "$domain" ]; then
            all_domains+=("$domain")
        fi
    done <<< "$domains_content"

    # Generate test domain list (local.* and api.*)
    local -a test_domains=()
    for domain in "${all_domains[@]}"; do
        test_domains+=("local.$domain")
        test_domains+=("api.$domain")
        # Also add combinations like local.api.*
        test_domains+=("local.api.$domain")
    done

    echo "[$SCRIPT_INDEX] Test domains to configure:"
    for test_domain in "${test_domains[@]}"; do
        echo "[$SCRIPT_INDEX]   - $test_domain → 127.0.0.1"
    done

    # Determine Windows hosts file path
    local windows_hosts_file=""
    if [ "$IS_WSL" = true ]; then
        # WSL: Access Windows hosts file through /mnt/c
        windows_hosts_file="/mnt/c/Windows/System32/drivers/etc/hosts"
    elif [ -f "/c/Windows/System32/drivers/etc/hosts" ]; then
        # Git Bash or similar
        windows_hosts_file="/c/Windows/System32/drivers/etc/hosts"
    else
        echo "[$SCRIPT_INDEX] ⚠ Warning: Not in WSL/Windows environment"
        echo "[$SCRIPT_INDEX] You need to manually add entries to your hosts file:"
        echo ""
        for test_domain in "${test_domains[@]}"; do
            echo "127.0.0.1    $test_domain"
        done
        return 0
    fi

    if [ ! -f "$windows_hosts_file" ]; then
        echo "[$SCRIPT_INDEX] ✗ Windows hosts file not found: $windows_hosts_file"
        echo "[$SCRIPT_INDEX] You need to manually add entries to your hosts file"
        return 1
    fi

    echo ""
    echo "[$SCRIPT_INDEX] Windows hosts file: $windows_hosts_file"

    # Create backup
    local backup_file="${windows_hosts_file}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "[$SCRIPT_INDEX] Creating backup: $backup_file"
    cp "$windows_hosts_file" "$backup_file" 2>/dev/null || {
        echo "[$SCRIPT_INDEX] ⚠ Warning: Could not create backup (may need admin rights)"
    }

    # Generate hosts entries
    local hosts_entries="# Auto-generated by 130_setup_domains.sh - $(date)\n"
    hosts_entries+="# Local testing mode entries\n"
    for test_domain in "${test_domains[@]}"; do
        hosts_entries+="127.0.0.1    $test_domain\n"
    done
    hosts_entries+="# End of auto-generated entries\n"

    # Check if entries already exist
    local marker_found=false
    if grep -q "Auto-generated by 130_setup_domains.sh" "$windows_hosts_file" 2>/dev/null; then
        marker_found=true
        echo "[$SCRIPT_INDEX] ⚠ Auto-generated entries already exist in hosts file"
        echo "[$SCRIPT_INDEX] Removing old entries..."

        # Remove old auto-generated entries
        sed -i '/# Auto-generated by 130_setup_domains.sh/,/# End of auto-generated entries/d' "$windows_hosts_file" 2>/dev/null || {
            echo "[$SCRIPT_INDEX] ✗ Failed to remove old entries (may need admin rights)"
            echo "[$SCRIPT_INDEX] Please manually edit: $windows_hosts_file"
            return 1
        }
    fi

    # Append new entries
    echo "[$SCRIPT_INDEX] Adding new test domain entries..."
    echo -e "$hosts_entries" >> "$windows_hosts_file" 2>/dev/null || {
        echo "[$SCRIPT_INDEX] ✗ Failed to add entries (need admin/sudo rights)"
        echo "[$SCRIPT_INDEX] Please run PowerShell as Administrator and add:"
        echo ""
        echo -e "$hosts_entries"
        return 1
    }

    echo "[$SCRIPT_INDEX] ✓ Local testing mode configured successfully!"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] You can now access:"
    for test_domain in "${test_domains[@]}"; do
        echo "[$SCRIPT_INDEX]   http://$test_domain"
    done
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] To restore original hosts file:"
    echo "[$SCRIPT_INDEX]   Copy back from: $backup_file"

    return 0
}

echo "[$SCRIPT_INDEX] Domain setup script completed!"

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo "[$SCRIPT_INDEX] All domains configured successfully!"

    # Ask if user wants to enable local testing mode
    echo ""
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] LOCAL TESTING MODE"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] Do you want to enable local testing mode?"
    echo "[$SCRIPT_INDEX] This will automatically add test domains to your Windows hosts file"
    echo "[$SCRIPT_INDEX] (local.*, api.*, local.api.* → 127.0.0.1)"
    echo ""
    read -p "[$SCRIPT_INDEX] Enable local testing mode? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_local_testing_mode

        # Show debug information
        echo ""
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] DEBUG INFORMATION"
        echo "[$SCRIPT_INDEX] =================================="
        echo "[$SCRIPT_INDEX] Environment:"
        echo "[$SCRIPT_INDEX]   IS_WSL: $IS_WSL"
        echo "[$SCRIPT_INDEX]   IS_PRODUCTION: $IS_PRODUCTION"
        echo "[$SCRIPT_INDEX]   USER: $USER"
        echo "[$SCRIPT_INDEX]   HOME: $HOME"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Mapped Paths:"
        echo "[$SCRIPT_INDEX]   wwwroot: $(map_web_path 'wwwroot')"
        echo "[$SCRIPT_INDEX]   nginxconfig: $(map_web_path 'nginxconfig')"
        echo "[$SCRIPT_INDEX]   ssl: $(map_web_path 'nginxconfig')/ssl"
        echo "[$SCRIPT_INDEX]"
        echo "[$SCRIPT_INDEX] Configured Domains:"
        local domains_content=$(get_domains_list)
        echo "$domains_content" | while read -r domain; do
            if [ -n "$domain" ]; then
                echo "[$SCRIPT_INDEX]   - $domain"
            fi
        done
        echo "[$SCRIPT_INDEX] =================================="
    else
        echo "[$SCRIPT_INDEX] Skipping local testing mode setup"
    fi

    exit 0
else
    echo "[$SCRIPT_INDEX] Some domains failed to configure. Check the logs above."
    exit 1
fi
