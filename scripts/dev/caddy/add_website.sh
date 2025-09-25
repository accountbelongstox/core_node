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

# Caddy Website Addition Script
# Usage: ./add_website.sh "domain1.com,domain2.com" [website_identifier] [website_type] [target_path_or_proxy]
# Website types: static, php, laravel, proxy (default: static)
# Target: directory path for static/php/laravel, or proxy URL for reverse proxy

set -e

# Configuration
CADDYFILE="/etc/caddy/Caddyfile"
CADDY_BIN="/usr/bin/caddy"
WEB_ROOT="/var/www"
PHP_FASTCGI="unix:/run/php/php8.4-fpm.sock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    echo "Usage: $0 DOMAINS [WEBSITE_ID] [WEBSITE_TYPE] [TARGET]"
    echo ""
    echo "Parameters:"
    echo "  DOMAINS      - Domain names (comma-separated, e.g., 'example.com,www.example.com')"
    echo "  WEBSITE_ID   - Website identifier (optional, defaults to first domain)"
    echo "  WEBSITE_TYPE - Website type: static|php|laravel|proxy (default: static)"
    echo "  TARGET       - Target path or proxy URL"
    echo ""
    echo "Website Types:"
    echo "  static  - Static files website"
    echo "  php     - PHP website with FastCGI"
    echo "  laravel - Laravel PHP framework (serves from public/index.php)"
    echo "  proxy   - Reverse proxy to another server"
    echo ""
    echo "Examples:"
    echo "  $0 'example.com,www.example.com'"
    echo "  $0 'api.example.com' 'api' 'proxy' 'http://localhost:3000'"
    echo "  $0 'blog.example.com' 'blog' 'php' '/var/www/blog'"
    echo "  $0 'app.example.com' 'app' 'laravel' '/var/www/laravel-app'"
}

check_requirements() {
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi

    # Check if Caddy is installed
    if ! command -v "$CADDY_BIN" &> /dev/null; then
        log_error "Caddy is not installed or not found at $CADDY_BIN"
        exit 1
    fi

    # Check if Caddyfile exists
    if [[ ! -f "$CADDYFILE" ]]; then
        log_error "Caddyfile not found at $CADDYFILE"
        exit 1
    fi

    # Create backup of original Caddyfile
    cp "$CADDYFILE" "${CADDYFILE}.backup.$(date +%Y%m%d_%H%M%S)"
    log_info "Created backup of Caddyfile"
}

validate_domains() {
    local domains="$1"
    IFS=',' read -ra DOMAIN_ARRAY <<< "$domains"
    
    for domain in "${DOMAIN_ARRAY[@]}"; do
        domain=$(echo "$domain" | xargs) # trim whitespace
        if [[ ! "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
            log_error "Invalid domain format: $domain"
            exit 1
        fi
    done
}

get_first_domain() {
    local domains="$1"
    echo "$domains" | cut -d',' -f1 | xargs
}

check_website_exists() {
    local website_id="$1"
    grep -q "# Website: $website_id" "$CADDYFILE"
}

create_directory() {
    local dir_path="$1"
    if [[ ! -d "$dir_path" ]]; then
        mkdir -p "$dir_path"
        chown www-data:www-data "$dir_path" 2>/dev/null || true
        log_info "Created directory: $dir_path"
    fi
}

generate_static_config() {
    local domains="$1"
    local target_path="$2"
    local website_id="$3"
    
    if [[ -z "$target_path" ]]; then
        target_path="$WEB_ROOT/$website_id"
    fi
    
    create_directory "$target_path"
    
    cat << EOF

# Website: $website_id
$domains {
    root * $target_path
    file_server
    encode gzip
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
    }
}
EOF
}

generate_php_config() {
    local domains="$1"
    local target_path="$2"
    local website_id="$3"
    
    if [[ -z "$target_path" ]]; then
        target_path="$WEB_ROOT/$website_id"
    fi
    
    create_directory "$target_path"
    
    cat << EOF

# Website: $website_id
$domains {
    root * $target_path
    
    # PHP FastCGI
    php_fastcgi $PHP_FASTCGI
    
    # Static files
    file_server
    encode gzip
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
    }
    
    # Deny access to sensitive files
    @sensitive {
        path *.log *.sql *.conf *.ini .env .htaccess
    }
    respond @sensitive 403
}
EOF
}

generate_laravel_config() {
    local domains="$1"
    local target_path="$2"
    local website_id="$3"
    
    if [[ -z "$target_path" ]]; then
        target_path="$WEB_ROOT/$website_id"
    fi
    
    create_directory "$target_path"
    create_directory "$target_path/public"
    
    cat << EOF

# Website: $website_id (Laravel)
$domains {
    root * $target_path/public
    
    # Laravel index.php handling
    try_files {path} {path}/ /index.php?{query}
    
    # PHP FastCGI
    php_fastcgi $PHP_FASTCGI
    
    # Static files
    file_server
    encode gzip
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
    }
    
    # Deny access to sensitive Laravel files
    @sensitive {
        path *.log *.sql *.conf *.ini .env .htaccess
        path /storage/* /bootstrap/cache/* /.git/*
    }
    respond @sensitive 403
}
EOF
}

generate_proxy_config() {
    local domains="$1"
    local proxy_url="$2"
    local website_id="$3"
    
    if [[ -z "$proxy_url" ]]; then
        log_error "Proxy URL is required for reverse proxy configuration"
        exit 1
    fi
    
    cat << EOF

# Website: $website_id (Reverse Proxy)
$domains {
    reverse_proxy $proxy_url {
        # Health check
        health_uri /health
        health_interval 30s
        health_timeout 5s
        
        # Headers
        header_up Host {upstream_hostport}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
    }
    
    encode gzip
}
EOF
}

add_domains_to_existing() {
    local website_id="$1"
    local new_domains="$2"
    
    # Find the line with the website identifier
    local start_line=$(grep -n "# Website: $website_id" "$CADDYFILE" | cut -d: -f1)
    if [[ -z "$start_line" ]]; then
        log_error "Website $website_id not found in Caddyfile"
        exit 1
    fi
    
    # Find the domains line (next line after comment)
    local domains_line=$((start_line + 1))
    local current_domains=$(sed -n "${domains_line}p" "$CADDYFILE" | sed 's/ {.*//')
    
    # Combine domains (remove duplicates)
    local combined_domains="$current_domains,$new_domains"
    combined_domains=$(echo "$combined_domains" | tr ',' '\n' | sort -u | tr '\n' ',' | sed 's/,$//')
    
    # Replace the domains line
    sed -i "${domains_line}s/.*/$combined_domains {/" "$CADDYFILE"
    
    log_success "Added domains '$new_domains' to existing website '$website_id'"
}

add_new_website() {
    local domains="$1"
    local website_id="$2"
    local website_type="$3"
    local target="$4"
    
    local config_block=""
    
    case "$website_type" in
        "static")
            config_block=$(generate_static_config "$domains" "$target" "$website_id")
            ;;
        "php")
            config_block=$(generate_php_config "$domains" "$target" "$website_id")
            ;;
        "laravel")
            config_block=$(generate_laravel_config "$domains" "$target" "$website_id")
            ;;
        "proxy")
            config_block=$(generate_proxy_config "$domains" "$target" "$website_id")
            ;;
        *)
            log_error "Unknown website type: $website_type"
            exit 1
            ;;
    esac
    
    # Append to Caddyfile
    echo "$config_block" >> "$CADDYFILE"
    
    log_success "Added new $website_type website '$website_id' with domains: $domains"
}

validate_and_reload_caddy() {
    log_info "Validating Caddy configuration..."
    
    if "$CADDY_BIN" validate --config "$CADDYFILE"; then
        log_success "Configuration is valid"
        
        log_info "Reloading Caddy..."
        if systemctl reload caddy; then
            log_success "Caddy reloaded successfully"
        else
            log_error "Failed to reload Caddy"
            exit 1
        fi
    else
        log_error "Configuration validation failed. Restoring backup..."
        mv "${CADDYFILE}.backup."* "$CADDYFILE"
        exit 1
    fi
}

main() {
    # Parse arguments
    if [[ $# -lt 1 ]]; then
        show_usage
        exit 1
    fi
    
    local domains="$1"
    local website_id="${2:-$(get_first_domain "$domains")}"
    local website_type="${3:-static}"
    local target="$4"
    
    # Validate inputs
    validate_domains "$domains"
    check_requirements
    
    log_info "Processing website configuration:"
    log_info "  Domains: $domains"
    log_info "  Website ID: $website_id"
    log_info "  Type: $website_type"
    log_info "  Target: ${target:-default}"
    
    # Check if website already exists
    if check_website_exists "$website_id"; then
        log_warning "Website '$website_id' already exists. Adding domains to existing configuration."
        add_domains_to_existing "$website_id" "$domains"
    else
        log_info "Creating new website configuration"
        add_new_website "$domains" "$website_id" "$website_type" "$target"
    fi
    
    # Validate and reload
    validate_and_reload_caddy
    
    log_success "Website configuration completed successfully!"
    log_info "You can view the updated configuration at: $CADDYFILE"
}

# Run main function
main "$@"
