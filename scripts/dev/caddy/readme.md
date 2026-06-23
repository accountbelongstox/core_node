# Caddy Website Management Script

This script (`add_website.sh`) helps you easily add domains to your Caddy web server with support for different website types.

## Prerequisites

- Caddy v2.9+ installed at `/usr/bin/caddy`
- Caddyfile located at `/etc/caddy/Caddyfile`
- Root privileges
- PHP-FPM (for PHP and Laravel sites)

## Installation

1. Make the script executable:
```bash
chmod +x add_website.sh
```

2. Run the script as root:
```bash
sudo ./add_website.sh
```

## Usage

```bash
./add_website.sh DOMAINS [WEBSITE_ID] [WEBSITE_TYPE] [TARGET]
```

### Parameters

- **DOMAINS** - Domain names (comma-separated, required)
  - Example: `'example.com,www.example.com'`
- **WEBSITE_ID** - Website identifier (optional, defaults to first domain)
  - Used as directory name and configuration identifier
- **WEBSITE_TYPE** - Website type (optional, default: `static`)
  - Options: `static`, `php`, `laravel`, `proxy`
- **TARGET** - Target path or proxy URL (optional)
  - For static/php/laravel: directory path
  - For proxy: target URL

## Website Types

### 1. Static Website (`static`)
Serves static files (HTML, CSS, JS, images).

**Features:**
- File server with gzip compression
- Security headers
- Default web root: `/var/www/[website_id]`

**Example:**
```bash
./add_website.sh 'blog.example.com' 'blog' 'static' '/var/www/blog'
```

### 2. PHP Website (`php`)
Serves PHP applications with FastCGI.

**Features:**
- PHP-FPM integration
- File server for static assets
- Security headers
- Protection for sensitive files (.env, .log, etc.)
- Default web root: `/var/www/[website_id]`

**Example:**
```bash
./add_website.sh 'app.example.com' 'app' 'php' '/var/www/php-app'
```

### 3. Laravel Website (`laravel`)
Optimized for Laravel PHP framework.

**Features:**
- Serves from `public/` directory
- URL rewriting for Laravel routing
- PHP-FPM integration
- Protection for Laravel-specific directories
- Default web root: `/var/www/[website_id]`

**Example:**
```bash
./add_website.sh 'laravel.example.com' 'laravel' 'laravel' '/var/www/laravel-project'
```

### 4. Reverse Proxy (`proxy`)
Proxies requests to another server/application.

**Features:**
- Health checks
- Proper headers forwarding
- Load balancing ready
- Gzip compression

**Example:**
```bash
./add_website.sh 'api.example.com' 'api' 'proxy' 'http://localhost:3000'
```

## Examples

### Basic static website
```bash
./add_website.sh 'example.com,www.example.com'
```
Creates a static website serving from `/var/www/example.com`

### Multiple domains for existing website
```bash
./add_website.sh 'new.example.com,another.example.com' 'example.com'
```
Adds new domains to existing website configuration

### PHP application
```bash
./add_website.sh 'shop.example.com' 'shop' 'php' '/var/www/shop'
```

### Laravel application
```bash
./add_website.sh 'app.example.com' 'app' 'laravel' '/var/www/laravel-app'
```
'd3.sz.15gm.com' 'd3laravel' 'laravel' '/www/wwwroot/d3.sz.15gm.com'

### Reverse proxy to Node.js app
```bash
./add_website.sh 'api.example.com' 'api' 'proxy' 'http://localhost:3000'
```

### Multiple domains with custom path
```bash
./add_website.sh 'docs.example.com,documentation.example.com' 'docs' 'static' '/var/www/documentation'
```

## Script Features

### Safety Features
- **Automatic backups**: Creates timestamped backups of Caddyfile before changes
- **Configuration validation**: Validates Caddyfile syntax before applying
- **Rollback on failure**: Restores backup if validation fails
- **Domain validation**: Validates domain name format
- **Requirement checks**: Verifies Caddy installation and permissions

### Smart Configuration Management
- **Duplicate handling**: Automatically handles adding domains to existing sites
- **Directory creation**: Creates web directories with proper permissions
- **Security headers**: Adds security headers to all configurations
- **File protection**: Protects sensitive files from web access

### Logging
- Color-coded output for easy reading
- Detailed operation logging
- Clear success/error messages

## Configuration Customization

Edit the script variables at the top to customize paths:

```bash
CADDYFILE="/etc/caddy/Caddyfile"
CADDY_BIN="/usr/bin/caddy"
WEB_ROOT="/var/www"
PHP_FASTCGI="unix//run/php/php-fpm.sock"
```

## Troubleshooting

### Permission Errors
Ensure you're running as root:
```bash
sudo ./add_website.sh [arguments]
```

### PHP-FPM Issues
Check if PHP-FPM is running and socket path is correct:
```bash
systemctl status php-fpm
ls -la /run/php/php-fpm.sock
```

### Configuration Validation Failures
- Check domain DNS records point to your server
- Ensure target directories exist and are readable
- Verify proxy targets are accessible

### Backup Recovery
If you need to manually restore a backup:
```bash
cp /etc/caddy/Caddyfile.backup.YYYYMMDD_HHMMSS /etc/caddy/Caddyfile
systemctl reload caddy
```

## Generated Configuration Examples

### Static Site Configuration
```
# Website: example.com
example.com, www.example.com {
    root * /var/www/example.com
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
```

### Laravel Configuration
```
# Website: app (Laravel)
app.example.com {
    root * /var/www/app/public
    
    # Laravel index.php handling
    try_files {path} {path}/ /index.php?{query}
    
    # PHP FastCGI
    php_fastcgi unix//run/php/php-fpm.sock
    
    # Static files
    file_server
    encode gzip
    
    # Security headers and file protection
    # ...
}
```

## Security Considerations

- Script requires root privileges for system modifications
- Automatic backups prevent data loss
- Security headers protect against common web vulnerabilities
- Sensitive files are automatically protected from web access
- Configuration validation prevents broken setups

## Support

For issues or questions:
1. Check the Caddy logs: `journalctl -u caddy -f`
2. Validate your configuration: `caddy validate --config /etc/caddy/Caddyfile`
3. Review the generated Caddyfile: `cat /etc/caddy/Caddyfile`
