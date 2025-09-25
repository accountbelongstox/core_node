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
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

echo "[$SCRIPT_INDEX] Domain Setup Script - Adding domains to nginx and certbot"

check_and_install_sudo

# Function to get core_node directory using gvar_common.sh logic
get_core_node_dir() {
    # Find CORE_NODE_DIR by walking up from current script directory
    local script_dir="$(dirname "$(readlink -f "$0")")"
    local core_node_dir=""

    # Try to find core_node directory
    local current_dir="$script_dir"
    while [ "$current_dir" != "/" ] && [ "$current_dir" != "." ]; do
        if [ -d "$current_dir/.secret_keys" ] || [ -f "$current_dir/package.json" ]; then
            core_node_dir="$current_dir"
            break
        fi
        current_dir="$(dirname "$current_dir")"
    done

    # Fallback to environment variable or default
    if [ -z "$core_node_dir" ]; then
        if [ -n "$CORE_NODE_DIR" ]; then
            core_node_dir="$CORE_NODE_DIR"
        else
            # Default fallback
            core_node_dir="/opt/core_node"
        fi
    fi

    echo "$core_node_dir"
}

# Function to get Laravel directory path
get_laravel_dir() {
    local core_node_dir=$(get_core_node_dir)
    local laravel_dir="$core_node_dir/poly_apps/laravel_main"
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

    # Test artisan command
    if ! php artisan --version >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Error: artisan command failed"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Laravel is ready for use"
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
    get_secret_content "domains_list"
}

# Function to read DNSPod configuration
read_dnspod_config() {
    echo "[$SCRIPT_INDEX] Reading DNSPod configuration..."

    local email=$(get_secret_content "dns_dnspod_email")
    local api_token=$(get_secret_content "dns_dnspod_api_token")

    if [ -z "$email" ] || [ -z "$api_token" ]; then
        echo "[$SCRIPT_INDEX] DNSPod configuration not found or incomplete"
        echo "[$SCRIPT_INDEX]   Email: ${email:-'NOT FOUND'}"
        echo "[$SCRIPT_INDEX]   API Token: ${api_token:+FOUND}"
        return 1
    fi

    echo "[$SCRIPT_INDEX] DNSPod configuration loaded:"
    echo "[$SCRIPT_INDEX]   Email: $email"
    echo "[$SCRIPT_INDEX]   API Token: $api_token"

    return 0
}

# Function to setup domain in nginx and certbot
setup_domain() {
    local domain="$1"
    local laravel_dir=$(get_laravel_dir)

    echo "[$SCRIPT_INDEX] Setting up domain: $domain"

    # Change to Laravel directory
    cd "$laravel_dir"

    # Test secret reading first
    echo "[$SCRIPT_INDEX] Testing secret reading..."
    local secret_test_output
    secret_test_output=$(php artisan tinker --execute="
        use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SecretReader;
        echo 'Testing secret reader...' . PHP_EOL;
        \$email = ServerManagerV1SecretReader::getSecretContent('dns_dnspod_email');
        \$token = ServerManagerV1SecretReader::getSecretContent('dns_dnspod_api_token');
        echo 'Email: ' . (\$email ?: 'NOT_FOUND') . PHP_EOL;
        echo 'Token: ' . (\$token ?: 'NOT_FOUND') . PHP_EOL;
    " 2>&1)
    echo "[$SCRIPT_INDEX] Secret test result: $secret_test_output"

    # Test domain validation
    echo "[$SCRIPT_INDEX] Testing domain validation for: $domain"
    local domain_test_output
    domain_test_output=$(php artisan tinker --execute="
        use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1BaseCommand;
        \$command = new class extends ServerManagerV1BaseCommand {
            protected \$signature = 'test';
            protected \$description = 'Test';
            public function testDomain(\$domain) {
                return \$this->validateDomain(\$domain);
            }
        };
        \$result = \$command->testDomain('$domain');
        echo 'Domain validation result: ' . (\$result ? 'VALID' : 'INVALID') . PHP_EOL;
    " 2>&1)
    echo "[$SCRIPT_INDEX] Domain validation result: $domain_test_output"

    # Ensure /www/wwwroot directory exists
    echo "[$SCRIPT_INDEX] Ensuring /www/wwwroot directory exists..."
    if [ ! -d "/www/wwwroot" ]; then
        echo "[$SCRIPT_INDEX] Creating /www/wwwroot directory..."
        sudo mkdir -p /www/wwwroot
        sudo chown -R www-data:www-data /www/wwwroot
        sudo chmod -R 755 /www/wwwroot
    fi

    # Create domain-specific directory
    local domain_dir="/www/wwwroot/$domain"
    if [ ! -d "$domain_dir" ]; then
        echo "[$SCRIPT_INDEX] Creating domain directory: $domain_dir"
        sudo mkdir -p "$domain_dir"
        sudo chown -R www-data:www-data "$domain_dir"
        sudo chmod -R 755 "$domain_dir"
    fi

    # Use new Laravel commands instead of deploy
    echo "[$SCRIPT_INDEX] Setting up SSL certificate and website for: $domain"

    # Step 1: Add SSL certificate
    echo "[$SCRIPT_INDEX] Adding SSL certificate..."
    local ssl_output
    ssl_output=$(php artisan servermanager:certificate add "$domain" --prefixes=si,sz,local,api --provider=dnspod 2>&1)
    local ssl_result=$?

    echo "[$SCRIPT_INDEX] SSL certificate result:"
    echo "$ssl_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Step 2: Add website
    echo "[$SCRIPT_INDEX] Adding website..."
    local website_output
    website_output=$(php artisan servermanager:website add "$domain" --type=laravel --ssl=auto 2>&1)
    local website_result=$?

    echo "[$SCRIPT_INDEX] Website setup result:"
    echo "$website_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    # Use website result as deploy result
    local deploy_result=$website_result
    local deploy_output="SSL: $ssl_output\nWebsite: $website_output"

    echo "[$SCRIPT_INDEX] Deploy command output:"
    echo "$deploy_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    if [ $deploy_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] Successfully deployed $domain"

        # Save domain to Laravel JSON database and create certificate entry
        echo "[$SCRIPT_INDEX] Saving domain configuration and preparing certificate..."
        local save_output
        save_output=$(php artisan tinker --execute="
            use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
            use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;

            // Save domain configuration
            \$domainResult = ServerManagerV1DomainManager::addDomain('$domain', [
                'type' => 'laravel',
                'nginx_enabled' => true,
                'ssl_enabled' => false,
                'status' => 'deployed'
            ]);

            // Create certificate entry with expanded domains
            \$certResult = ServerManagerV1CertificateManager::addCertificate('$domain', [
                'provider' => 'dnspod',
                'status' => 'pending',
                'auto_renew' => true
            ]);

            echo 'Domain: ' . (\$domainResult ? 'saved' : 'failed') . ', Certificate: ' . (\$certResult ? 'created' : 'failed');
        " 2>&1)
        echo "[$SCRIPT_INDEX] Domain and certificate setup result: $save_output"
    else
        echo "[$SCRIPT_INDEX] Failed to deploy $domain (exit code: $deploy_result)"
        return $deploy_result
    fi

    # Generate SSL certificate using DNSPod with expanded domains
    echo "[$SCRIPT_INDEX] Generating SSL certificate with expanded domain coverage..."

    # Get expanded domain list and generate certificate
    local ssl_output
    ssl_output=$(php artisan tinker --execute="
        use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
        use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;

        // Get expanded domains
        \$expandedDomains = ServerManagerV1CertificateManager::generateExpandedDomains('$domain');
        echo 'Expanded domains: ' . implode(', ', \$expandedDomains) . PHP_EOL;

        // Build certbot command with all domains
        \$command = ['certonly', '--dns-dnspod', '--agree-tos', '--non-interactive'];
        foreach (\$expandedDomains as \$d) {
            \$command[] = '-d';
            \$command[] = \$d;
        }

        // Execute certbot command
        \$result = ServerManagerV1Utils::executeCommand('certbot', \$command);
        echo 'Certbot result: ' . (\$result['success'] ? 'success' : 'failed') . PHP_EOL;
        if (!\$result['success']) {
            echo 'Error: ' . \$result['error'] . PHP_EOL;
        }

        // Update certificate status
        \$status = \$result['success'] ? 'active' : 'failed';
        \$updateData = [
            'status' => \$status,
            'issued_at' => \$result['success'] ? date('Y-m-d H:i:s') : null,
            'expires_at' => \$result['success'] ? date('Y-m-d H:i:s', strtotime('+90 days')) : null,
            'last_error' => \$result['success'] ? null : \$result['error']
        ];
        ServerManagerV1CertificateManager::updateCertificateStatus('$domain', \$status, \$updateData);

        exit(\$result['success'] ? 0 : 1);
    " 2>&1)
    local ssl_result=$?

    echo "[$SCRIPT_INDEX] SSL command output:"
    echo "$ssl_output" | while IFS= read -r line; do
        echo "[$SCRIPT_INDEX]   $line"
    done

    if [ $ssl_result -eq 0 ]; then
        echo "[$SCRIPT_INDEX] Successfully generated SSL certificate for $domain with expanded coverage"

        # Link domain to certificate and update status
        echo "[$SCRIPT_INDEX] Linking domain to certificate..."
        local ssl_update_output
        ssl_update_output=$(php artisan tinker --execute="
            use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
            use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;

            // Get certificate ID
            \$certId = 'cert_' . str_replace('.', '_', '$domain');

            // Link domain to certificate
            \$linkResult = ServerManagerV1DomainManager::linkDomainToCertificate('$domain', \$certId);

            // Update domain status
            \$domains = ServerManagerV1DomainManager::getAllDomains();
            if (isset(\$domains['$domain'])) {
                \$domains['$domain']['ssl_enabled'] = true;
                \$domains['$domain']['ssl_certificate_id'] = \$certId;
                \$domains['$domain']['status'] = 'active';
                \$updateResult = ServerManagerV1DomainManager::addDomain('$domain', \$domains['$domain']);
                echo 'Domain linked and updated: ' . (\$linkResult && \$updateResult ? 'success' : 'failed');
            } else {
                echo 'Domain not found in database';
            }
        " 2>&1)
        echo "[$SCRIPT_INDEX] SSL linking result: $ssl_update_output"
    else
        echo "[$SCRIPT_INDEX] Failed to generate SSL certificate for $domain (exit code: $ssl_result)"
        echo "[$SCRIPT_INDEX] Domain deployment completed but SSL setup failed"
    fi

    # Record deployment activity
    echo "[$SCRIPT_INDEX] Recording deployment activity..."
    local record_output
    record_output=$(php artisan tinker --execute="
        use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
        \$result = ServerManagerV1DomainManager::recordDeployment('$domain', [
            'type' => 'laravel',
            'status' => $deploy_result == 0 ? 'success' : 'failed',
            'nginx_deployed' => $deploy_result == 0,
            'ssl_generated' => $ssl_result == 0,
            'source' => 'shell_script_130'
        ]);
        echo \$result ? 'Deployment recorded successfully' : 'Failed to record deployment';
    " 2>&1)
    echo "[$SCRIPT_INDEX] Deployment record result: $record_output"

    return $deploy_result
}

# Function to show Windows hosts file modification instructions
show_windows_hosts_info() {
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX] LOCAL TESTING SETUP INSTRUCTIONS"
    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] For local testing, you need to modify your Windows hosts file:"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Hosts file location:"
    echo "[$SCRIPT_INDEX]   C:\\Windows\\System32\\drivers\\etc\\hosts"
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Add these lines to your hosts file:"
    echo "[$SCRIPT_INDEX] =================================="

    local domains_content=$(get_domains_list)
    if [ -n "$domains_content" ]; then
        echo "$domains_content" | while read -r domain; do
            if [ -n "$domain" ]; then
                echo "[$SCRIPT_INDEX] 127.0.0.1    $domain"
            fi
        done
    fi

    echo "[$SCRIPT_INDEX] =================================="
    echo "[$SCRIPT_INDEX]"
    echo "[$SCRIPT_INDEX] Note: SSL certificates will still work with DNS validation"
    echo "[$SCRIPT_INDEX] even when domains point to localhost for testing."
    echo "[$SCRIPT_INDEX]"
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

    # Get detailed information from Laravel
    echo "[$SCRIPT_INDEX] Fetching detailed information..."
    local detailed_info
    detailed_info=$(php artisan tinker --execute="
        use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
        use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;

        // Get domains summary
        \$domainsSummary = ServerManagerV1DomainManager::getDomainsSummary();
        echo 'DOMAINS SUMMARY:' . PHP_EOL;
        echo '  Total domains: ' . \$domainsSummary['total_domains'] . PHP_EOL;
        echo '  Active domains: ' . \$domainsSummary['active_domains'] . PHP_EOL;
        echo '  SSL enabled: ' . \$domainsSummary['ssl_enabled_domains'] . PHP_EOL;
        echo '  Nginx enabled: ' . \$domainsSummary['nginx_enabled_domains'] . PHP_EOL;
        echo '  Laravel sites: ' . \$domainsSummary['laravel_domains'] . PHP_EOL;
        echo '  Static sites: ' . \$domainsSummary['static_domains'] . PHP_EOL;
        echo PHP_EOL;

        // Get certificates summary
        \$certsSummary = ServerManagerV1CertificateManager::getCertificatesSummary();
        echo 'CERTIFICATES SUMMARY:' . PHP_EOL;
        echo '  Total certificates: ' . \$certsSummary['total_certificates'] . PHP_EOL;
        echo '  Active certificates: ' . \$certsSummary['active_certificates'] . PHP_EOL;
        echo '  Expired certificates: ' . \$certsSummary['expired_certificates'] . PHP_EOL;
        echo '  Expiring soon: ' . \$certsSummary['expiring_soon'] . PHP_EOL;
        echo PHP_EOL;

        // List PHP versions
        echo 'PHP VERSIONS:' . PHP_EOL;
        foreach (\$domainsSummary['php_versions'] as \$version => \$count) {
            echo '  PHP ' . \$version . ': ' . \$count . ' domains' . PHP_EOL;
        }
        echo PHP_EOL;

        // List all domains with details
        echo 'DOMAIN DETAILS:' . PHP_EOL;
        foreach (\$domainsSummary['domains'] as \$domain) {
            echo '  ' . \$domain['domain'] . ':' . PHP_EOL;
            echo '    Type: ' . \$domain['type'] . PHP_EOL;
            echo '    Status: ' . \$domain['status'] . PHP_EOL;
            echo '    SSL: ' . (\$domain['ssl_enabled'] ? 'enabled' : 'disabled') . PHP_EOL;
            echo '    Nginx: ' . (\$domain['nginx_enabled'] ? 'enabled' : 'disabled') . PHP_EOL;
            echo '    PHP: ' . \$domain['php_version'] . PHP_EOL;
            echo '    Deployments: ' . \$domain['deployment_count'] . PHP_EOL;
            echo PHP_EOL;
        }
    " 2>&1)

    echo "[$SCRIPT_INDEX] $detailed_info"

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
}

# Main execution
echo "[$SCRIPT_INDEX] Starting domain setup process..."

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

echo "$domains_content" | while read -r domain; do
    if [ -n "$domain" ]; then
        total_count=$((total_count + 1))

        echo "[$SCRIPT_INDEX] Processing domain: $domain"

        if setup_domain "$domain"; then
            success_count=$((success_count + 1))
            echo "[$SCRIPT_INDEX] ????Successfully configured: $domain"
        else
            echo "[$SCRIPT_INDEX] ????Failed to configure: $domain"
        fi

        echo "[$SCRIPT_INDEX] ---"
    fi
done

# Show local testing instructions
show_windows_hosts_info

# Print summary
print_summary "$success_count" "$total_count"

echo "[$SCRIPT_INDEX] Domain setup script completed!"

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo "[$SCRIPT_INDEX] All domains configured successfully!"
    exit 0
else
    echo "[$SCRIPT_INDEX] Some domains failed to configure. Check the logs above."
    exit 1
fi
