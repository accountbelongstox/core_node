#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. For Bash scripts: Use absolute paths resolved from script location
# 7. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/nginx_common.sh"

WWW_ROOT=$(map_web_path "wwwroot")
NGINX_CONFIG_DIR=$(map_web_path "nginxconfig")
NGINX_SITES_AVAILABLE="$NGINX_CONFIG_DIR/sites-available"
NGINX_SITES_ENABLED="$NGINX_CONFIG_DIR/sites-enabled"
CERTBOT_CONFIG_DIR="/etc/letsencrypt"

COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

check_nginx_installed() {
    if ! command -v nginx >/dev/null 2>&1; then
        echo -e "${COLOR_RED}Nginx is not installed!${COLOR_RESET}"
        echo "Please run installation script first: 26_install_nginx.sh"
        return 1
    fi
    return 0
}

show_header() {
    clear
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}    Nginx Management Script${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

show_nginx_status() {
    echo -e "${COLOR_BLUE}=== Nginx Service Status ===${COLOR_RESET}"
    systemctl status nginx --no-pager -l | head -20
    echo ""
}

show_nginx_info() {
    show_header
    echo -e "${COLOR_BLUE}=== Nginx Basic Information ===${COLOR_RESET}"
    echo ""
    
    echo -e "${COLOR_CYAN}Version:${COLOR_RESET}"
    nginx -v 2>&1
    echo ""
    
    echo -e "${COLOR_CYAN}Configuration Test:${COLOR_RESET}"
    nginx -t 2>&1
    echo ""
    
    show_nginx_status
    
    echo -e "${COLOR_CYAN}Listening Ports:${COLOR_RESET}"
    $USE_SUDO netstat -tlnp | grep nginx || $USE_SUDO ss -tlnp | grep nginx
    echo ""
    
    echo -e "${COLOR_CYAN}Configuration File:${COLOR_RESET}"
    echo "Main: /etc/nginx/nginx.conf"
    echo "Sites Available: $NGINX_SITES_AVAILABLE"
    echo "Sites Enabled: $NGINX_SITES_ENABLED"
    echo ""
    
    read -p "Press Enter to continue..."
}

start_nginx() {
    show_header
    echo -e "${COLOR_BLUE}=== Starting Nginx ===${COLOR_RESET}"
    
    if systemctl is-active --quiet nginx; then
        echo -e "${COLOR_YELLOW}Nginx is already running${COLOR_RESET}"
    else
        echo "Starting Nginx service..."
        $USE_SUDO systemctl start nginx
        
        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Nginx started successfully${COLOR_RESET}"
            $USE_SUDO systemctl enable nginx
        else
            echo -e "${COLOR_RED}Failed to start Nginx${COLOR_RESET}"
        fi
    fi
    
    echo ""
    show_nginx_status
    read -p "Press Enter to continue..."
}

stop_nginx() {
    show_header
    echo -e "${COLOR_BLUE}=== Stopping Nginx ===${COLOR_RESET}"
    
    if ! systemctl is-active --quiet nginx; then
        echo -e "${COLOR_YELLOW}Nginx is not running${COLOR_RESET}"
    else
        echo "Stopping Nginx service..."
        $USE_SUDO systemctl stop nginx
        
        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Nginx stopped successfully${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}Failed to stop Nginx${COLOR_RESET}"
        fi
    fi
    
    echo ""
    show_nginx_status
    read -p "Press Enter to continue..."
}

restart_nginx() {
    show_header
    echo -e "${COLOR_BLUE}=== Restarting Nginx ===${COLOR_RESET}"
    
    echo "Testing configuration before restart..."
    if ! $USE_SUDO nginx -t 2>&1; then
        echo -e "${COLOR_RED}Configuration test failed! Please fix errors before restarting.${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo "Restarting Nginx service..."
    $USE_SUDO systemctl restart nginx
    
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Nginx restarted successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to restart Nginx${COLOR_RESET}"
    fi
    
    echo ""
    show_nginx_status
    read -p "Press Enter to continue..."
}

reload_nginx() {
    show_header
    echo -e "${COLOR_BLUE}=== Reloading Nginx Configuration ===${COLOR_RESET}"
    
    echo "Testing configuration before reload..."
    if ! $USE_SUDO nginx -t 2>&1; then
        echo -e "${COLOR_RED}Configuration test failed! Please fix errors before reloading.${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo "Reloading Nginx configuration..."
    $USE_SUDO systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Nginx configuration reloaded successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to reload Nginx${COLOR_RESET}"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

list_sites() {
    show_header
    echo -e "${COLOR_BLUE}=== Nginx Sites Configuration ===${COLOR_RESET}"
    echo ""
    
    echo -e "${COLOR_CYAN}Sites Available:${COLOR_RESET}"
    if [ -d "$NGINX_SITES_AVAILABLE" ]; then
        ls -1 "$NGINX_SITES_AVAILABLE" 2>/dev/null || echo "  (none)"
    else
        echo "  Directory not found: $NGINX_SITES_AVAILABLE"
    fi
    echo ""
    
    echo -e "${COLOR_CYAN}Sites Enabled:${COLOR_RESET}"
    if [ -d "$NGINX_SITES_ENABLED" ]; then
        ls -1 "$NGINX_SITES_ENABLED" 2>/dev/null || echo "  (none)"
    else
        echo "  Directory not found: $NGINX_SITES_ENABLED"
    fi
    echo ""
    
    read -p "Press Enter to continue..."
}

list_proxies() {
    show_header
    echo -e "${COLOR_BLUE}=== Nginx Reverse Proxies ===${COLOR_RESET}"
    echo ""
    
    if [ ! -d "$NGINX_SITES_AVAILABLE" ]; then
        echo "  Directory not found: $NGINX_SITES_AVAILABLE"
        read -p "Press Enter to continue..."
        return
    fi
    
    echo -e "${COLOR_CYAN}Configured Reverse Proxies:${COLOR_RESET}"
    local found=0
    for config in "$NGINX_SITES_AVAILABLE"/*; do
        if [ -f "$config" ]; then
            if grep -q "proxy_pass" "$config" 2>/dev/null; then
                local site_name=$(basename "$config")
                local proxy_to=$(grep "proxy_pass" "$config" | head -1 | awk '{print $2}' | tr -d ';')
                echo "  - $site_name -> $proxy_to"
                found=1
            fi
        fi
    done
    
    if [ $found -eq 0 ]; then
        echo "  (no reverse proxies configured)"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

show_config() {
    show_header
    echo -e "${COLOR_BLUE}=== Nginx Configuration Files ===${COLOR_RESET}"
    echo ""
    
    echo -e "${COLOR_CYAN}Main Configuration:${COLOR_RESET}"
    echo "/etc/nginx/nginx.conf"
    echo ""
    
    echo "1) View main configuration"
    echo "2) View specific site configuration"
    echo "3) Test configuration"
    echo "0) Back to main menu"
    echo ""
    
    read -p "Select option: " choice
    
    case $choice in
        1)
            less /etc/nginx/nginx.conf
            ;;
        2)
            echo ""
            echo "Available sites:"
            ls -1 "$NGINX_SITES_AVAILABLE" 2>/dev/null
            echo ""
            read -p "Enter site name: " site_name
            if [ -f "$NGINX_SITES_AVAILABLE/$site_name" ]; then
                less "$NGINX_SITES_AVAILABLE/$site_name"
            else
                echo -e "${COLOR_RED}Site configuration not found${COLOR_RESET}"
                sleep 2
            fi
            ;;
        3)
            echo ""
            $USE_SUDO nginx -t 2>&1
            echo ""
            read -p "Press Enter to continue..."
            ;;
    esac
}

add_website() {
    show_header
    echo -e "${COLOR_BLUE}=== Add New Website ===${COLOR_RESET}"
    echo ""

    read -p "Enter domain name (e.g., example.com): " domain

    if [ -z "$domain" ]; then
        echo -e "${COLOR_RED}Domain name cannot be empty${COLOR_RESET}"
        sleep 2
        return
    fi

    read -p "Enter document root path (default: $WWW_ROOT/$domain): " doc_root
    doc_root=${doc_root:-"$WWW_ROOT/$domain"}

    echo ""
    echo -e "${COLOR_CYAN}Configuration Summary:${COLOR_RESET}"
    echo "Domain: $domain"
    echo "Document Root: $doc_root"
    echo ""

    read -p "Do you want to enable SSL with Certbot? (y/n): " enable_ssl

    $USE_SUDO mkdir -p "$doc_root"
    $USE_SUDO mkdir -p "$NGINX_SITES_AVAILABLE"
    $USE_SUDO mkdir -p "$NGINX_SITES_ENABLED"

    # Bootstrap on port 80 first; upgraded to the modern HTTP/3 vhost below
    # once a certificate exists.
    nginx_render_http_bootstrap "$domain" "$doc_root" | $USE_SUDO tee "$NGINX_SITES_AVAILABLE/$domain" > /dev/null
    $USE_SUDO ln -sf "$NGINX_SITES_AVAILABLE/$domain" "$NGINX_SITES_ENABLED/$domain"

    echo -e "${COLOR_GREEN}Website configuration created${COLOR_RESET}"

    if [[ "$enable_ssl" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Select DNS provider for DNS challenge:"
        echo "1) DNSPod"
        echo "2) Cloudflare"
        echo "3) Manual (HTTP challenge)"
        echo ""
        read -p "Select option: " dns_choice

        case $dns_choice in
            1)
                read -p "Enter DNSPod API ID: " dnspod_id
                read -p "Enter DNSPod API Token: " dnspod_token

                $USE_SUDO mkdir -p /etc/letsencrypt
                cat <<EOF | $USE_SUDO tee /etc/letsencrypt/dnspod.ini > /dev/null
dns_dnspod_api_id = $dnspod_id
dns_dnspod_api_token = $dnspod_token
EOF
                $USE_SUDO chmod 600 /etc/letsencrypt/dnspod.ini

                echo "Requesting SSL certificate via DNSPod DNS challenge..."
                $USE_SUDO certbot certonly --dns-dnspod \
                    --dns-dnspod-credentials /etc/letsencrypt/dnspod.ini \
                    -d "$domain" -d "www.$domain"
                ;;
            2)
                read -p "Enter Cloudflare API Token: " cf_token

                $USE_SUDO mkdir -p /etc/letsencrypt
                cat <<EOF | $USE_SUDO tee /etc/letsencrypt/cloudflare.ini > /dev/null
dns_cloudflare_api_token = $cf_token
EOF
                $USE_SUDO chmod 600 /etc/letsencrypt/cloudflare.ini

                echo "Requesting SSL certificate via Cloudflare DNS challenge..."
                $USE_SUDO certbot certonly --dns-cloudflare \
                    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
                    -d "$domain" -d "www.$domain"
                ;;
            3)
                echo "Requesting SSL certificate via HTTP challenge..."
                $USE_SUDO certbot certonly --webroot -w /var/www/html \
                    -d "$domain" -d "www.$domain"
                ;;
        esac

        if [ $? -eq 0 ] && [ -f "$(nginx_le_cert_path "$domain")" ]; then
            echo -e "${COLOR_GREEN}SSL certificate obtained, writing HTTP/3 vhost${COLOR_RESET}"
            nginx_render_site_vhost "$domain" "$doc_root" | $USE_SUDO tee "$NGINX_SITES_AVAILABLE/$domain" > /dev/null
        else
            echo -e "${COLOR_YELLOW}SSL certificate request failed or was cancelled${COLOR_RESET}"
        fi
    fi

    echo ""
    echo "Testing configuration..."
    if $USE_SUDO nginx -t 2>&1; then
        echo "Reloading Nginx..."
        $USE_SUDO systemctl reload nginx
        echo -e "${COLOR_GREEN}Website added successfully!${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Configuration test failed${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

add_proxy() {
    show_header
    echo -e "${COLOR_BLUE}=== Add Reverse Proxy ===${COLOR_RESET}"
    echo ""

    read -p "Enter domain name (e.g., api.example.com): " domain

    if [ -z "$domain" ]; then
        echo -e "${COLOR_RED}Domain name cannot be empty${COLOR_RESET}"
        sleep 2
        return
    fi

    read -p "Enter backend URL (e.g., http://localhost:3000): " backend

    if [ -z "$backend" ]; then
        echo -e "${COLOR_RED}Backend URL cannot be empty${COLOR_RESET}"
        sleep 2
        return
    fi

    echo ""
    echo -e "${COLOR_CYAN}Configuration Summary:${COLOR_RESET}"
    echo "Domain: $domain"
    echo "Backend: $backend"
    echo ""

    read -p "Do you want to enable SSL with Certbot? (y/n): " enable_ssl

    $USE_SUDO mkdir -p "$NGINX_SITES_AVAILABLE"
    $USE_SUDO mkdir -p "$NGINX_SITES_ENABLED"

    nginx_render_http_bootstrap "$domain" | $USE_SUDO tee "$NGINX_SITES_AVAILABLE/$domain" > /dev/null
    $USE_SUDO ln -sf "$NGINX_SITES_AVAILABLE/$domain" "$NGINX_SITES_ENABLED/$domain"

    echo -e "${COLOR_GREEN}Reverse proxy configuration created${COLOR_RESET}"

    if [[ "$enable_ssl" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Requesting SSL certificate..."
        $USE_SUDO certbot certonly --webroot -w /var/www/html -d "$domain"

        if [ $? -eq 0 ] && [ -f "$(nginx_le_cert_path "$domain")" ]; then
            echo -e "${COLOR_GREEN}SSL certificate obtained, writing HTTP/3 vhost${COLOR_RESET}"
            nginx_render_proxy_vhost "$domain" "$backend" | $USE_SUDO tee "$NGINX_SITES_AVAILABLE/$domain" > /dev/null
        else
            echo -e "${COLOR_YELLOW}SSL certificate request failed or was cancelled${COLOR_RESET}"
        fi
    fi

    echo ""
    echo "Testing configuration..."
    if $USE_SUDO nginx -t 2>&1; then
        echo "Reloading Nginx..."
        $USE_SUDO systemctl reload nginx
        echo -e "${COLOR_GREEN}Reverse proxy added successfully!${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Configuration test failed${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

update_certbot() {
    show_header
    echo -e "${COLOR_BLUE}=== Update Certbot & Renew Certificates ===${COLOR_RESET}"
    echo ""
    
    echo "1) Update Certbot"
    echo "2) Renew all certificates"
    echo "3) Test certificate renewal (dry run)"
    echo "4) List all certificates"
    echo "0) Back to main menu"
    echo ""
    
    read -p "Select option: " choice
    
    case $choice in
        1)
            echo "Updating Certbot..."
            $USE_SUDO apt update
            $USE_SUDO apt install --only-upgrade certbot python3-certbot-nginx
            echo -e "${COLOR_GREEN}Certbot updated${COLOR_RESET}"
            ;;
        2)
            echo "Renewing certificates..."
            $USE_SUDO certbot renew
            ;;
        3)
            echo "Testing certificate renewal..."
            $USE_SUDO certbot renew --dry-run
            ;;
        4)
            echo ""
            $USE_SUDO certbot certificates
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
}

show_menu() {
    show_header
    show_nginx_status
    
    echo -e "${COLOR_CYAN}Menu:${COLOR_RESET}"
    echo "  1) Start Nginx"
    echo "  2) Stop Nginx"
    echo "  3) Restart Nginx"
    echo "  4) Reload Configuration"
    echo "  5) Show Basic Information"
    echo "  6) Show All Websites"
    echo "  7) Show All Reverse Proxies"
    echo "  8) View Configuration Files"
    echo "  9) Add Website"
    echo " 10) Add Reverse Proxy"
    echo " 11) Update Certbot & Manage Certificates"
    echo "  0) Exit"
    echo ""
}

main() {
    if ! check_nginx_installed; then
        exit 1
    fi
    
    while true; do
        show_menu
        read -p "Select option: " choice
        
        case $choice in
            1) start_nginx ;;
            2) stop_nginx ;;
            3) restart_nginx ;;
            4) reload_nginx ;;
            5) show_nginx_info ;;
            6) list_sites ;;
            7) list_proxies ;;
            8) show_config ;;
            9) add_website ;;
            10) add_proxy ;;
            11) update_certbot ;;
            0) 
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo -e "${COLOR_RED}Invalid option${COLOR_RESET}"
                sleep 1
                ;;
        esac
    done
}

main "$@"
