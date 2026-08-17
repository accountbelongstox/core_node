#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For Shell scripts: Always use absolute paths, avoid relative paths like "../".
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
SCRIPT_INDEX="DIAG"

# Source global variables
source "$PARENT_DIR/common/gvar_common.sh"

# Variable declarations
www_root=""
nginx_config_dir=""
laravel_dir=""

echo "========================================"
echo "POST-DOMAIN SETUP DIAGNOSTICS"
echo "========================================"
echo ""

# Get paths from gvar_common
www_root=$(map_web_path "wwwroot")
nginx_config_dir=$(map_web_path "nginxconfig")
laravel_dir="$www_root/core_node/poly_apps/laravel_main"

echo "[$SCRIPT_INDEX] System Paths:"
echo "[$SCRIPT_INDEX]   WWW Root: $www_root"
echo "[$SCRIPT_INDEX]   Nginx Config: $nginx_config_dir"
echo "[$SCRIPT_INDEX]   Laravel Dir: $laravel_dir"
echo ""

# 1. Check PHP-FPM Status
echo "========================================"
echo "1. PHP-FPM STATUS CHECK"
echo "========================================"

if command -v php-fpm8.4 >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] PHP-FPM 8.4 is installed"

    # Check if running
    if pgrep -f "php-fpm8.4" >/dev/null; then
        echo "[$SCRIPT_INDEX] [OK] PHP-FPM 8.4 is running"
        echo "[$SCRIPT_INDEX] Process count: $(pgrep -f "php-fpm8.4" | wc -l)"
    else
        echo "[$SCRIPT_INDEX] [ERROR] PHP-FPM 8.4 is NOT running"
    fi

    # Check PHP-FPM socket/port
    if [ -S "/var/run/php/php8.5-fpm.sock" ]; then
        echo "[$SCRIPT_INDEX] [OK] PHP-FPM socket exists: /var/run/php/php8.5-fpm.sock"
        ls -la /var/run/php/php8.5-fpm.sock
    elif netstat -tln | grep -q ":9000"; then
        echo "[$SCRIPT_INDEX] [OK] PHP-FPM listening on port 9000"
    else
        echo "[$SCRIPT_INDEX] [ERROR] PHP-FPM socket/port not found"
    fi
else
    echo "[$SCRIPT_INDEX] [ERROR] PHP-FPM 8.4 not found"
fi
echo ""

# 2. Check Nginx Configuration
echo "========================================"
echo "2. NGINX CONFIGURATION CHECK"
echo "========================================"

# Check enabled sites
echo "[$SCRIPT_INDEX] Enabled sites in $nginx_config_dir/sites-enabled/:"
if [ -d "$nginx_config_dir/sites-enabled" ]; then
    ls -la "$nginx_config_dir/sites-enabled/" | head -20
    echo "[$SCRIPT_INDEX] Total enabled sites: $(ls -1 "$nginx_config_dir/sites-enabled/" 2>/dev/null | wc -l)"
else
    echo "[$SCRIPT_INDEX] [ERROR] Sites-enabled directory not found"
fi
echo ""

# Sample one poly (API) site configuration
echo "[$SCRIPT_INDEX] Sample API site configuration:"
sample_api_config=$(find "$nginx_config_dir/sites-enabled" -name "*api*" -type l 2>/dev/null | head -1)
if [ -n "$sample_api_config" ]; then
    echo "[$SCRIPT_INDEX] Config file: $sample_api_config"
    echo "[$SCRIPT_INDEX] Points to: $(readlink "$sample_api_config")"
    echo ""
    echo "[$SCRIPT_INDEX] Key configuration lines:"
    grep -E "root|index|fastcgi_param|fastcgi_pass|location.*php" "$(readlink "$sample_api_config")" 2>/dev/null | head -20
else
    echo "[$SCRIPT_INDEX] [ERROR] No API site configuration found"
fi
echo ""

# 3. Check Laravel Directory Structure
echo "========================================"
echo "3. LARAVEL DIRECTORY STRUCTURE"
echo "========================================"

echo "[$SCRIPT_INDEX] Laravel directory: $laravel_dir"
if [ -d "$laravel_dir" ]; then
    echo "[$SCRIPT_INDEX] [OK] Laravel directory exists"

    # Check public directory
    if [ -d "$laravel_dir/public" ]; then
        echo "[$SCRIPT_INDEX] [OK] Public directory exists"

        # Check index.php
        if [ -f "$laravel_dir/public/index.php" ]; then
            echo "[$SCRIPT_INDEX] [OK] index.php exists"
            ls -la "$laravel_dir/public/index.php"

            # Check if index.php is readable
            if [ -r "$laravel_dir/public/index.php" ]; then
                echo "[$SCRIPT_INDEX] [OK] index.php is readable"
            else
                echo "[$SCRIPT_INDEX] [ERROR] index.php is NOT readable"
            fi
        else
            echo "[$SCRIPT_INDEX] [ERROR] index.php NOT found in $laravel_dir/public/"
        fi

        # Check .htaccess
        if [ -f "$laravel_dir/public/.htaccess" ]; then
            echo "[$SCRIPT_INDEX] [OK] .htaccess exists"
        fi
    else
        echo "[$SCRIPT_INDEX] [ERROR] Public directory NOT found"
    fi

    # Check storage permissions
    if [ -d "$laravel_dir/storage" ]; then
        echo "[$SCRIPT_INDEX] Storage directory permissions:"
        ls -ld "$laravel_dir/storage"

        if [ -w "$laravel_dir/storage" ]; then
            echo "[$SCRIPT_INDEX] [OK] Storage directory is writable"
        else
            echo "[$SCRIPT_INDEX] [ERROR] Storage directory is NOT writable"
        fi
    fi

    # Check bootstrap/cache permissions
    if [ -d "$laravel_dir/bootstrap/cache" ]; then
        echo "[$SCRIPT_INDEX] Bootstrap/cache directory permissions:"
        ls -ld "$laravel_dir/bootstrap/cache"

        if [ -w "$laravel_dir/bootstrap/cache" ]; then
            echo "[$SCRIPT_INDEX] [OK] Bootstrap/cache directory is writable"
        else
            echo "[$SCRIPT_INDEX] [ERROR] Bootstrap/cache directory is NOT writable"
        fi
    fi
else
    echo "[$SCRIPT_INDEX] [ERROR] Laravel directory NOT found"
fi
echo ""

# 4. Check SSL Certificates
echo "========================================"
echo "4. SSL CERTIFICATES CHECK"
echo "========================================"

ssl_dir="$nginx_config_dir/ssl"
echo "[$SCRIPT_INDEX] SSL directory: $ssl_dir"

if [ -d "$ssl_dir" ]; then
    echo "[$SCRIPT_INDEX] Certificates found:"
    for cert_dir in "$ssl_dir"/*; do
        if [ -d "$cert_dir" ]; then
            domain=$(basename "$cert_dir")
            echo ""
            echo "[$SCRIPT_INDEX] Domain: $domain"

            # Check certificate files
            if [ -f "$cert_dir/fullchain.pem" ]; then
                echo "[$SCRIPT_INDEX]   [OK] fullchain.pem exists"

                # Check certificate expiry
                expiry=$(openssl x509 -in "$cert_dir/fullchain.pem" -noout -enddate 2>/dev/null | cut -d= -f2)
                if [ -n "$expiry" ]; then
                    echo "[$SCRIPT_INDEX]   Expiry: $expiry"
                fi

                # Check if self-signed
                issuer=$(openssl x509 -in "$cert_dir/fullchain.pem" -noout -issuer 2>/dev/null)
                subject=$(openssl x509 -in "$cert_dir/fullchain.pem" -noout -subject 2>/dev/null)
                if [ "$issuer" = "$subject" ]; then
                    echo "[$SCRIPT_INDEX]   [WARN] Self-signed certificate (browser will show warning)"
                else
                    echo "[$SCRIPT_INDEX]   [OK] CA-signed certificate"
                fi

                # List SANs (Subject Alternative Names)
                echo "[$SCRIPT_INDEX]   Domains covered:"
                openssl x509 -in "$cert_dir/fullchain.pem" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/DNS://g' | tr ',' '\n' | while read -r san; do
                    echo "[$SCRIPT_INDEX]     - $(echo $san | xargs)"
                done
            else
                echo "[$SCRIPT_INDEX]   [ERROR] fullchain.pem NOT found"
            fi

            if [ -f "$cert_dir/privkey.pem" ]; then
                echo "[$SCRIPT_INDEX]   [OK] privkey.pem exists"
                ls -l "$cert_dir/privkey.pem"
            else
                echo "[$SCRIPT_INDEX]   [ERROR] privkey.pem NOT found"
            fi
        fi
    done
else
    echo "[$SCRIPT_INDEX] [ERROR] SSL directory NOT found"
fi
echo ""

# 5. Test Domain Accessibility
echo "========================================"
echo "5. DOMAIN ACCESSIBILITY TEST"
echo "========================================"

echo "[$SCRIPT_INDEX] Testing sample domains locally:"

# Get list of configured domains from nginx
test_domains=()
if [ -d "$nginx_config_dir/sites-enabled" ]; then
    while IFS= read -r link; do
        domain=$(basename "$link" | sed 's/-ssl$//')
        test_domains+=("$domain")
    done < <(find "$nginx_config_dir/sites-enabled" -type l -name "*api*" 2>/dev/null | head -3)
fi

if [ ${#test_domains[@]} -eq 0 ]; then
    echo "[$SCRIPT_INDEX] No API domains found to test"
else
    for domain in "${test_domains[@]}"; do
        echo ""
        echo "[$SCRIPT_INDEX] Testing: $domain"

        # Test HTTP response
        response=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $domain" http://127.0.0.1/ 2>/dev/null || echo "failed")
        echo "[$SCRIPT_INDEX]   HTTP response: $response"

        # Test HTTPS response
        https_response=$(curl -s -o /dev/null -w "%{http_code}" -k -H "Host: $domain" https://127.0.0.1/ 2>/dev/null || echo "failed")
        echo "[$SCRIPT_INDEX]   HTTPS response: $https_response"

        # Get actual response content (first 200 chars)
        content=$(curl -s -k -H "Host: $domain" https://127.0.0.1/ 2>/dev/null | head -c 200)
        if [ -n "$content" ]; then
            echo "[$SCRIPT_INDEX]   Response preview: ${content:0:100}..."
        fi
    done
fi
echo ""

# 6. Check ServerManager Database
echo "========================================"
echo "6. SERVERMANAGER DATABASE CHECK"
echo "========================================"

if [ -f "$laravel_dir/artisan" ]; then
    cd "$laravel_dir" || exit 1

    echo "[$SCRIPT_INDEX] Checking ServerManager database records:"

    # Check certificates
    echo ""
    echo "[$SCRIPT_INDEX] SSL Certificates in database:"
    php artisan servermanager:certificate list --format=json 2>/dev/null | head -50

    # Check websites
    echo ""
    echo "[$SCRIPT_INDEX] Websites in database:"
    php artisan servermanager:website list --format=json 2>/dev/null | head -50
else
    echo "[$SCRIPT_INDEX] [ERROR] Cannot check database - artisan not found"
fi
echo ""

# 7. Nginx Error Log Check
echo "========================================"
echo "7. RECENT NGINX ERRORS"
echo "========================================"

nginx_error_log="/var/log/nginx/error.log"
if [ -f "$nginx_error_log" ]; then
    echo "[$SCRIPT_INDEX] Last 20 nginx errors:"
    tail -20 "$nginx_error_log"
else
    echo "[$SCRIPT_INDEX] Nginx error log not found at $nginx_error_log"
fi
echo ""

# 8. PHP-FPM Error Log Check
echo "========================================"
echo "8. RECENT PHP-FPM ERRORS"
echo "========================================"

php_fpm_log="/var/log/php8.5-fpm.log"
if [ -f "$php_fpm_log" ]; then
    echo "[$SCRIPT_INDEX] Last 20 PHP-FPM errors:"
    tail -20 "$php_fpm_log"
else
    # Try alternative locations
    for log in "/var/log/php-fpm.log" "/var/log/php/error.log" "/var/log/php8.5/error.log"; do
        if [ -f "$log" ]; then
            echo "[$SCRIPT_INDEX] Last 20 PHP-FPM errors from $log:"
            tail -20 "$log"
            break
        fi
    done
fi
echo ""

# 9. Summary and Recommendations
echo "========================================"
echo "9. SUMMARY AND RECOMMENDATIONS"
echo "========================================"

echo "[$SCRIPT_INDEX] Issues detected:"
issues_found=0

# Check for common issues
if ! pgrep -f "php-fpm8.4" >/dev/null; then
    echo "[$SCRIPT_INDEX] [!] PHP-FPM 8.4 is not running - START IT!"
    echo "[$SCRIPT_INDEX]     Fix: sudo systemctl start php8.5-fpm"
    issues_found=$((issues_found + 1))
fi

if [ ! -f "$laravel_dir/public/index.php" ]; then
    echo "[$SCRIPT_INDEX] [!] Laravel index.php not found"
    echo "[$SCRIPT_INDEX]     Check: $laravel_dir/public/index.php"
    issues_found=$((issues_found + 1))
fi

if [ ! -w "$laravel_dir/storage" ] || [ ! -w "$laravel_dir/bootstrap/cache" ]; then
    echo "[$SCRIPT_INDEX] [!] Laravel directories not writable"
    echo "[$SCRIPT_INDEX]     Fix: sudo chmod -R 777 $laravel_dir/storage $laravel_dir/bootstrap/cache"
    issues_found=$((issues_found + 1))
fi

# Check for self-signed certificates
cert_count=$(find "$ssl_dir" -name "fullchain.pem" 2>/dev/null | wc -l)
selfsigned_count=0
for cert in "$ssl_dir"/*/fullchain.pem; do
    if [ -f "$cert" ]; then
        issuer=$(openssl x509 -in "$cert" -noout -issuer 2>/dev/null)
        subject=$(openssl x509 -in "$cert" -noout -subject 2>/dev/null)
        if [ "$issuer" = "$subject" ]; then
            selfsigned_count=$((selfsigned_count + 1))
        fi
    fi
done

if [ $selfsigned_count -gt 0 ]; then
    echo "[$SCRIPT_INDEX] [!] $selfsigned_count self-signed certificate(s) found"
    echo "[$SCRIPT_INDEX]     Browser will show security warnings"
    echo "[$SCRIPT_INDEX]     Fix: Install the certbot-dnspod plugin and regenerate certificates"
fi

if [ $issues_found -eq 0 ] && [ $selfsigned_count -eq 0 ]; then
    echo "[$SCRIPT_INDEX] [OK] No critical issues detected"
fi

echo ""
echo "========================================"
echo "DIAGNOSTICS COMPLETE"
echo "========================================"
