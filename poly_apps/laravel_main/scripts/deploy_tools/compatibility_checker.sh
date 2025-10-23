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

# Compatibility Checker Module - Detects system versions and Laravel 12 requirements
# Checks PHP version, Nginx version, configuration files, and compatibility

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Laravel 12 Requirements
LARAVEL_12_MIN_PHP="8.2"
LARAVEL_12_RECOMMENDED_PHP="8.3"
LARAVEL_12_OPTIMAL_PHP="8.4"
LARAVEL_12_MIN_NGINX="1.20"

# System paths
NGINX_CONFIG_DIR="/www/nginxconfig"
WWW_ROOT="/www/wwwroot"
PHP_INI_PATHS=("/etc/php/*/fpm/php.ini" "/etc/php*/php.ini" "/usr/local/etc/php/php.ini")
NGINX_CONFIG_PATHS=("/etc/nginx/nginx.conf" "/usr/local/etc/nginx/nginx.conf")

# Detected versions (global)
DETECTED_PHP_VERSION=""
DETECTED_NGINX_VERSION=""
DETECTED_PHP_FPM_VERSION=""

# Print section header
print_section() {
    local section_name="$1"
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $section_name${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Print check result
print_check() {
    local status="$1"
    local message="$2"
    local details="${3:-}"

    case "$status" in
        PASS)
            echo -e "${GREEN}[PASS]${NC} $message"
            ;;
        FAIL)
            echo -e "${RED}[FAIL]${NC} $message"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        INFO)
            echo -e "${CYAN}[INFO]${NC} $message"
            ;;
    esac

    if [ -n "$details" ]; then
        echo -e "${CYAN}       $details${NC}"
    fi
}

# Check PHP version
check_php_version() {
    print_section "PHP Version Detection"

    if ! command -v php &>/dev/null; then
        print_check "FAIL" "PHP is not installed"
        return 1
    fi

    local php_full_version=$(php --version 2>/dev/null | head -n1)
    DETECTED_PHP_VERSION=$(echo "$php_full_version" | grep -oP 'PHP \K[0-9]+\.[0-9]+' || echo "unknown")

    print_check "INFO" "PHP detected" "$php_full_version"

    # Check minimum version for Laravel 12
    if [ "$DETECTED_PHP_VERSION" != "unknown" ]; then
        # Compare versions
        if (( $(echo "$DETECTED_PHP_VERSION >= $LARAVEL_12_MIN_PHP" | bc -l) )); then
            print_check "PASS" "PHP version meets Laravel 12 minimum requirement ($LARAVEL_12_MIN_PHP)"

            if (( $(echo "$DETECTED_PHP_VERSION >= $LARAVEL_12_OPTIMAL_PHP" | bc -l) )); then
                print_check "PASS" "PHP version is optimal for Laravel 12 ($LARAVEL_12_OPTIMAL_PHP)"
            elif (( $(echo "$DETECTED_PHP_VERSION >= $LARAVEL_12_RECOMMENDED_PHP" | bc -l) )); then
                print_check "PASS" "PHP version is recommended for Laravel 12 ($LARAVEL_12_RECOMMENDED_PHP)"
            fi
        else
            print_check "FAIL" "PHP version is below Laravel 12 minimum" "Detected: $DETECTED_PHP_VERSION, Required: >= $LARAVEL_12_MIN_PHP"
            return 1
        fi
    fi

    return 0
}

# Check PHP FPM
check_php_fpm() {
    print_section "PHP-FPM Configuration"

    if ! command -v php-fpm &>/dev/null; then
        print_check "WARN" "php-fpm command not found in PATH"
    else
        DETECTED_PHP_FPM_VERSION=$(php-fpm --version 2>/dev/null | head -n1)
        print_check "INFO" "PHP-FPM detected" "$DETECTED_PHP_FPM_VERSION"
    fi

    # Check PHP-FPM socket
    local php_socket="/var/run/php/php-fpm.sock"
    local php_socket_8_4="/var/run/php/php8.4-fpm.sock"
    local php_socket_8_3="/var/run/php/php8.3-fpm.sock"

    if [ -S "$php_socket_8_4" ]; then
        print_check "PASS" "PHP 8.4-FPM socket found" "$php_socket_8_4"
    elif [ -S "$php_socket_8_3" ]; then
        print_check "PASS" "PHP 8.3-FPM socket found" "$php_socket_8_3"
    elif [ -S "$php_socket" ]; then
        print_check "PASS" "PHP-FPM socket found" "$php_socket"
    else
        print_check "WARN" "PHP-FPM socket not found"
        print_check "INFO" "Expected paths:"
        echo "       - $php_socket_8_4"
        echo "       - $php_socket_8_3"
        echo "       - $php_socket"
    fi

    # Check PHP-FPM service
    if systemctl is-active --quiet php-fpm || systemctl is-active --quiet php8.4-fpm || systemctl is-active --quiet php8.3-fpm 2>/dev/null; then
        print_check "PASS" "PHP-FPM service is running"
    else
        print_check "WARN" "PHP-FPM service is not running"
    fi

    return 0
}

# Check PHP extensions for Laravel 12
check_php_extensions() {
    print_section "PHP Extensions (Laravel 12 Required)"

    # Laravel 12 critical required extensions (will block deployment if missing)
    local critical_extensions=("bcmath" "ctype" "curl" "dom" "fileinfo" "filter" "hash" "json" "mbstring" "openssl" "pdo" "pcre" "session" "tokenizer" "xml" "zlib")

    # Extensions that should be present but won't block deployment if missing
    local recommended_extensions=("xmlrpc")

    local missing_critical=()
    local found_critical=()
    local missing_recommended=()

    # Check critical extensions
    for ext in "${critical_extensions[@]}"; do
        if php -m | grep -iq "^$ext$"; then
            found_critical+=("$ext")
        else
            missing_critical+=("$ext")
        fi
    done

    print_check "INFO" "Checking ${#critical_extensions[@]} critical extensions"
    echo -e "${GREEN}Found: ${#found_critical[@]} critical extensions${NC}"

    if [ ${#missing_critical[@]} -gt 0 ]; then
        print_check "FAIL" "Missing ${#missing_critical[@]} CRITICAL extensions (will block deployment)"
        for ext in "${missing_critical[@]}"; do
            echo -e "  ${RED}-${NC} $ext"
        done
        return 1
    else
        print_check "PASS" "All critical PHP extensions installed"
    fi

    # Check recommended extensions (won't fail deployment)
    echo ""
    print_check "INFO" "Checking recommended extensions"
    for ext in "${recommended_extensions[@]}"; do
        if php -m | grep -iq "^$ext$"; then
            print_check "PASS" "Recommended extension installed: $ext"
        else
            print_check "WARN" "Recommended extension missing: $ext (not blocking deployment)"
            missing_recommended+=("$ext")
        fi
    done

    # Optional but useful extensions
    print_check "INFO" "Checking optional but useful extensions"
    local optional_extensions=("redis" "memcached" "imagick" "gd" "intl")

    for ext in "${optional_extensions[@]}"; do
        if php -m | grep -iq "^$ext$"; then
            print_check "PASS" "Optional extension installed: $ext"
        else
            print_check "WARN" "Optional extension not installed: $ext"
        fi
    done

    return 0
}

# Check PHP configuration
check_php_config() {
    print_section "PHP Configuration"

    # Critical PHP settings for Laravel 12
    local php_ini_file=$(php --ini 2>/dev/null | grep "Loaded Configuration File" | awk '{print $NF}')

    if [ -z "$php_ini_file" ]; then
        print_check "WARN" "Could not determine PHP configuration file"
        return 0
    fi

    print_check "INFO" "PHP configuration file" "$php_ini_file"

    # Check critical settings
    local memory_limit=$(php -r "echo ini_get('memory_limit');" 2>/dev/null)
    local max_execution_time=$(php -r "echo ini_get('max_execution_time');" 2>/dev/null)
    local post_max_size=$(php -r "echo ini_get('post_max_size');" 2>/dev/null)
    local upload_max_filesize=$(php -r "echo ini_get('upload_max_filesize');" 2>/dev/null)

    print_check "INFO" "memory_limit" "$memory_limit"
    print_check "INFO" "max_execution_time" "$max_execution_time seconds"
    print_check "INFO" "post_max_size" "$post_max_size"
    print_check "INFO" "upload_max_filesize" "$upload_max_filesize"

    # Verify reasonable values
    if [[ "$memory_limit" == "-1" ]] || [[ "$memory_limit" == "256M" ]]; then
        print_check "PASS" "Memory limit is adequate"
    elif [[ "$memory_limit" == *"M" ]]; then
        local mem_num=$(echo "$memory_limit" | grep -oP '\d+')
        if [ "$mem_num" -ge 256 ]; then
            print_check "PASS" "Memory limit is adequate"
        else
            print_check "WARN" "Memory limit may be too low (recommended: 256M or higher)"
        fi
    fi

    return 0
}

# Check Nginx version
check_nginx_version() {
    print_section "Nginx Version Detection"

    if ! command -v nginx &>/dev/null; then
        print_check "WARN" "Nginx is not installed"
        return 0
    fi

    local nginx_version_output=$(nginx -v 2>&1)
    DETECTED_NGINX_VERSION=$(echo "$nginx_version_output" | grep -oP 'nginx/\K[0-9]+\.[0-9]+' || echo "unknown")

    print_check "INFO" "Nginx detected" "$nginx_version_output"

    # Check minimum version
    if [ "$DETECTED_NGINX_VERSION" != "unknown" ]; then
        if (( $(echo "$DETECTED_NGINX_VERSION >= $LARAVEL_12_MIN_NGINX" | bc -l) )); then
            print_check "PASS" "Nginx version meets Laravel 12 requirement" "Detected: $DETECTED_NGINX_VERSION, Minimum: >= $LARAVEL_12_MIN_NGINX"
        else
            print_check "FAIL" "Nginx version is below requirement" "Detected: $DETECTED_NGINX_VERSION, Required: >= $LARAVEL_12_MIN_NGINX"
            return 1
        fi
    fi

    return 0
}

# Check Nginx configuration
check_nginx_config() {
    print_section "Nginx Configuration"

    local nginx_config=""

    # Find main nginx configuration
    for config_path in "${NGINX_CONFIG_PATHS[@]}"; do
        if [ -f "$config_path" ]; then
            nginx_config="$config_path"
            break
        fi
    done

    if [ -z "$nginx_config" ]; then
        print_check "WARN" "Main Nginx configuration file not found"
    else
        print_check "PASS" "Nginx configuration found" "$nginx_config"

        # Test configuration syntax
        if nginx -t 2>&1 | grep -q "successful"; then
            print_check "PASS" "Nginx configuration syntax is valid"
        else
            print_check "FAIL" "Nginx configuration has syntax errors"
            nginx -t 2>&1 | tail -5
            return 1
        fi
    fi

    # Check Laravel-specific nginx configuration directory
    if [ -d "$NGINX_CONFIG_DIR" ]; then
        print_check "PASS" "Nginx Laravel config directory exists" "$NGINX_CONFIG_DIR"

        # Count configuration files
        local config_count=$(find "$NGINX_CONFIG_DIR" -name "*.conf" 2>/dev/null | wc -l)
        if [ "$config_count" -gt 0 ]; then
            print_check "INFO" "Laravel Nginx configurations found" "$config_count file(s)"
            find "$NGINX_CONFIG_DIR" -name "*.conf" -exec echo "       - {}" \;
        fi
    else
        print_check "WARN" "Nginx Laravel config directory does not exist" "$NGINX_CONFIG_DIR"
    fi

    # Check Nginx service status
    if systemctl is-active --quiet nginx; then
        print_check "PASS" "Nginx service is running"
    else
        print_check "WARN" "Nginx service is not running"
    fi

    return 0
}

# Check Nginx modules
check_nginx_modules() {
    print_section "Nginx Modules (Laravel 12 Requirements)"

    if ! command -v nginx &>/dev/null; then
        return 0
    fi

    local required_modules=("http_ssl_module" "http_rewrite_module" "http_gzip_module" "http_fastcgi_module")
    local nginx_modules=$(nginx -V 2>&1)

    echo -e "${CYAN}Required modules:${NC}"
    for module in "${required_modules[@]}"; do
        if echo "$nginx_modules" | grep -q "$module"; then
            print_check "PASS" "Module installed: $module"
        else
            print_check "WARN" "Module not found: $module"
        fi
    done

    return 0
}

# Check application directory structure
check_laravel_structure() {
    print_section "Laravel 12 Project Structure"

    local required_files=("artisan" "composer.json")
    local optional_files=("composer.lock")
    local required_dirs=("app" "config" "database" "routes" "storage" "public")

    echo -e "${CYAN}Checking required files:${NC}"
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            print_check "PASS" "File exists: $file"
        else
            print_check "FAIL" "File missing: $file"
        fi
    done

    echo -e "${CYAN}Checking optional files:${NC}"
    for file in "${optional_files[@]}"; do
        if [ -f "$file" ]; then
            print_check "PASS" "File exists: $file"
        else
            print_check "WARN" "File missing: $file (will be created by composer install)"
        fi
    done

    echo -e "${CYAN}Checking required directories:${NC}"
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_check "PASS" "Directory exists: $dir"
        else
            print_check "WARN" "Directory missing: $dir (will be auto-created)"
        fi
    done

    if [ -f "bootstrap/app.php" ]; then
        print_check "PASS" "Laravel bootstrap file exists"
    else
        print_check "WARN" "Laravel bootstrap file missing (expected in Laravel 12)"
    fi

    return 0
}

# Check Composer
check_composer() {
    print_section "Composer (PHP Dependency Manager)"

    if ! command -v composer &>/dev/null; then
        print_check "FAIL" "Composer is not installed"
        return 1
    fi

    local composer_version=$(composer --version 2>/dev/null | head -n1)
    print_check "PASS" "Composer installed" "$composer_version"

    # Check vendor directory
    if [ -d "vendor" ]; then
        print_check "PASS" "Vendor directory exists"

        # Check for key Laravel packages
        if [ -d "vendor/laravel/framework" ]; then
            local laravel_version=$(cat vendor/laravel/framework/composer.json 2>/dev/null | grep '"version"' | head -1 | grep -oP '[0-9]+\.[0-9]+' || echo "unknown")
            print_check "PASS" "Laravel framework installed" "Version: $laravel_version"
        else
            print_check "WARN" "Laravel framework not found in vendor"
        fi
    else
        print_check "WARN" "Vendor directory does not exist"
        print_check "INFO" "Run 'composer install' to install dependencies"
    fi

    return 0
}

# Check database setup
check_database() {
    print_section "Database Configuration"

    if [ ! -f ".env" ]; then
        print_check "WARN" ".env file not found (will be auto-created from .env.example)"

        if [ -f ".env.example" ]; then
            print_check "INFO" ".env.example exists - ready for auto-setup"
        else
            print_check "ERROR" ".env.example not found - cannot auto-create .env"
        fi
        return 0
    fi

    print_check "INFO" ".env file found"

    local db_connection=$(grep "^DB_CONNECTION=" .env | cut -d'=' -f2)
    local db_database=$(grep "^DB_DATABASE=" .env | cut -d'=' -f2)

    print_check "INFO" "Database connection" "$db_connection"

    if [ "$db_connection" = "sqlite" ]; then
        if [ -f "$db_database" ]; then
            print_check "PASS" "SQLite database file exists" "$db_database"
        else
            print_check "WARN" "SQLite database file not found (will be auto-created)" "$db_database"
        fi
    fi

    return 0
}

# Check Laravel artisan command availability
check_laravel_artisan() {
    print_section "Laravel Artisan Command"

    if [ ! -f "artisan" ]; then
        print_check "FAIL" "Laravel artisan file not found"
        return 1
    fi

    print_check "PASS" "Artisan file exists" "./artisan"

    if ! command -v php &>/dev/null; then
        print_check "FAIL" "PHP is not available to run artisan"
        return 1
    fi

    if [ ! -d "vendor" ]; then
        print_check "WARN" "Vendor directory missing - artisan may not work until dependencies are installed"
        return 0
    fi

    if php artisan --version &>/dev/null; then
        local artisan_version=$(php artisan --version 2>/dev/null | head -n1)
        print_check "PASS" "Artisan command is callable" "$artisan_version"
    else
        print_check "WARN" "Artisan command may have issues (dependencies may need to be installed)"
        return 0
    fi

    echo -e "${CYAN}Checking available Laravel commands:${NC}"

    if php artisan list 2>/dev/null | grep -q "servermanager"; then
        print_check "PASS" "ServerManagerV1 commands available"
    else
        print_check "INFO" "ServerManagerV1 commands not yet available"
    fi

    if php artisan list 2>/dev/null | grep -q "migrate"; then
        print_check "PASS" "Migration commands available"
    else
        print_check "INFO" "Migration commands not yet available"
    fi

    return 0
}

# Check vendor directory status
check_vendor_status() {
    print_section "Vendor and Dependencies"

    if [ ! -d "vendor" ]; then
        print_check "WARN" "Vendor directory does not exist (will be created by composer install)"
        print_check "INFO" "Status: Dependencies not installed yet - smart setup will handle this"

        if [ -f "composer.json" ]; then
            print_check "INFO" "composer.json exists - ready for dependency installation"
        else
            print_check "ERROR" "composer.json not found - cannot install dependencies"
        fi
        return 0
    fi

    print_check "PASS" "Vendor directory exists"

    local vendor_packages=(
        "laravel/framework:Laravel Framework"
        "symfony/console:Symfony Console"
        "doctrine/dbal:Doctrine DBAL"
        "laravel/tinker:Tinker"
    )

    echo -e "${CYAN}Checking key packages:${NC}"
    for package_info in "${vendor_packages[@]}"; do
        local package_name="${package_info%%:*}"
        local package_display="${package_info##*:}"

        if [ -d "vendor/$package_name" ]; then
            local version=""
            if [ -f "vendor/$package_name/composer.json" ]; then
                version=$(grep '"version"' "vendor/$package_name/composer.json" 2>/dev/null | head -1 | grep -oP '[0-9]+\.[0-9]+' || echo "installed")
            else
                version="installed"
            fi
            print_check "PASS" "$package_display installed" "v$version"
        else
            print_check "INFO" "$package_display not yet installed"
        fi
    done

    local vendor_count=$(find vendor -maxdepth 1 -type d 2>/dev/null | wc -l)
    if [ "$vendor_count" -gt 1 ]; then
        print_check "INFO" "Total vendor packages" "$((vendor_count - 1)) installed"
    fi

    return 0
}

# Check domain bindings for the Laravel project
check_domain_bindings() {
    print_section "Domain Binding Configuration"

    local nginx_config_dir="/www/nginxconfig"
    local app_name="laravel_main"
    local app_config_file="$nginx_config_dir/${app_name}.conf"

    if [ ! -d "$nginx_config_dir" ]; then
        print_check "WARN" "Nginx config directory not found" "$nginx_config_dir"
        return 0
    fi

    print_check "INFO" "Nginx config directory found" "$nginx_config_dir"

    # Check if app-specific config exists
    if [ -f "$app_config_file" ]; then
        print_check "PASS" "Application Nginx config found" "$app_config_file"

        # Try to extract server names from config
        local server_names=$(grep -oP 'server_name\s+\K[^;]+' "$app_config_file" 2>/dev/null | head -1)
        if [ -n "$server_names" ]; then
            print_check "INFO" "Configured domain(s)" "$server_names"
        fi
    else
        print_check "WARN" "Application Nginx config not found" "$app_config_file"
        print_check "INFO" "Status: No domain bindings configured yet"
    fi

    # Check for ServerManagerV1 database entries (if available)
    if [ -f ".env" ]; then
        local db_file=$(grep "^DB_DATABASE=" .env | cut -d'=' -f2)
        if [ -f "$db_file" ]; then
            print_check "INFO" "Database file accessible" "$db_file"

            # Try to query website bindings using Laravel if available
            if command -v php &>/dev/null && [ -f "artisan" ]; then
                if php artisan list 2>/dev/null | grep -q "servermanager"; then
                    echo -e "${CYAN}Checking ServerManagerV1 database for bindings:${NC}"

                    # Try to get website info via artisan command
                    if php artisan servermanager:website:list 2>/dev/null | grep -q "$app_name"; then
                        print_check "PASS" "Application found in ServerManagerV1"
                    else
                        print_check "INFO" "Application not yet registered in ServerManagerV1"
                    fi
                fi
            fi
        fi
    fi

    return 0
}

# Generate compatibility report
generate_compatibility_report() {
    print_section "Laravel 12 Compatibility Summary"

    echo ""
    echo -e "${CYAN}System Information:${NC}"
    echo "  PHP Version: $DETECTED_PHP_VERSION"
    echo "  PHP-FPM Version: ${DETECTED_PHP_FPM_VERSION:-Not detected}"
    echo "  Nginx Version: ${DETECTED_NGINX_VERSION:-Not installed}"
    echo ""

    echo -e "${CYAN}Laravel 12 Requirements:${NC}"
    echo "  Minimum PHP: $LARAVEL_12_MIN_PHP"
    echo "  Recommended PHP: $LARAVEL_12_RECOMMENDED_PHP"
    echo "  Optimal PHP: $LARAVEL_12_OPTIMAL_PHP"
    echo "  Minimum Nginx: $LARAVEL_12_MIN_NGINX"
    echo ""

    echo -e "${CYAN}Directory Paths:${NC}"
    echo "  Nginx Config: $NGINX_CONFIG_DIR"
    echo "  Web Root: $WWW_ROOT"
    echo "  Current Directory: $(pwd)"
    echo ""

    return 0
}

# Full compatibility check
perform_full_compatibility_check() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Laravel 12 Compatibility Check${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    local check_status=0

    check_php_version || ((check_status++))
    check_php_fpm
    check_php_extensions || ((check_status++))
    check_php_config
    check_nginx_version || ((check_status++))
    check_nginx_config
    check_nginx_modules
    check_laravel_structure
    check_composer
    check_database
    check_laravel_artisan || ((check_status++))
    check_vendor_status
    check_domain_bindings
    generate_compatibility_report

    echo -e "${BLUE}========================================${NC}"
    if [ $check_status -eq 0 ]; then
        echo -e "${GREEN}System is compatible with Laravel 12${NC}"
    else
        echo -e "${YELLOW}System has some compatibility warnings${NC}"
    fi
    echo -e "${BLUE}========================================${NC}"
    echo ""

    return $check_status
}

# Export functions
export -f print_section
export -f print_check
export -f check_php_version
export -f check_php_fpm
export -f check_php_extensions
export -f check_php_config
export -f check_nginx_version
export -f check_nginx_config
export -f check_nginx_modules
export -f check_laravel_structure
export -f check_composer
export -f check_database
export -f check_laravel_artisan
export -f check_vendor_status
export -f check_domain_bindings
export -f generate_compatibility_report
export -f perform_full_compatibility_check
