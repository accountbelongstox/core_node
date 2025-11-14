# Server Management Application Development Plan

## Project Overview
Develop a comprehensive server management application within Laravel Main (`ServerManagerV1`) to provide complete server administration capabilities including system information, file management, code execution, nginx management, unified manager integration, and SSL certificate management.

## Application Structure

### Application Name: `ServerManagerV1`
- **App Directory**: `app/Apps/ServerManagerV1/`
- **Routes Directory**: `routes/ServerManagerV1Router/`
- **Database Tables**: `servermanagerv1_*` prefix
- **Models Directory**: `app/Apps/ServerManagerV1/ServerManagerV1Models/`
- **Controllers Directory**: `app/Apps/ServerManagerV1/ServerManagerV1Controllers/`
- **Utils Directory**: `app/Apps/ServerManagerV1/ServerManagerV1Utils/`
- **Global Variables**: `app/Apps/ServerManagerV1/ServerManagerV1Gvar/`
- **Tables Maps**: `app/Apps/ServerManagerV1/ServerManagerV1TablesMaps/`

## Core Modules

### 1. System Information Module (`ServerManagerV1SystemInfoCtl`)
**Functionality:**
- Server hardware information (CPU, RAM, Disk)
- Operating system details from nginx analysis report
- Network configuration
- Process monitoring
- Service status checking
- Directory permissions analysis (exe permissions)
- Database directory status (`/www/wwwroot/laravel_main/laravel_db/`)
- Storage directory status (`storage/`, `public/`)
- Nginx process analysis (multiple nginx instances detected)

**API Endpoints:**
- `GET /api/servermanager/v1/system/info` - Complete system information
- `GET /api/servermanager/v1/system/processes` - Running processes
- `GET /api/servermanager/v1/system/services` - System services status
- `GET /api/servermanager/v1/system/permissions` - Directory permissions check
- `GET /api/servermanager/v1/system/storage` - Storage analysis

### 2. File Management Module (`ServerManagerV1FileManagerCtl`)
**Functionality:**
- Browse server filesystem (not limited to web directory)
- Download any file from server (security: no parameter-based paths)
- File/directory information
- File content preview (text files only)
- Directory listing with permissions
- File size and modification time
- Security: Hardcoded path whitelist, no dynamic path construction

**API Endpoints:**
- `GET /api/servermanager/v1/files/browse` - Browse predefined directories
- `GET /api/servermanager/v1/files/download` - Download files from whitelist
- `GET /api/servermanager/v1/files/info` - File information
- `GET /api/servermanager/v1/files/preview` - Preview text files

### 3. Code Execution Module (`ServerManagerV1CodeExecutorCtl`)
**Functionality:**
- Execute ONLY predefined hardcoded scripts (no parameter code execution)
- Hardcoded script library with fixed paths
- Execution logging and monitoring
- Resource monitoring during execution
- Output capture and streaming
- Integration with Laravel's built-in execution system

**Predefined Scripts (Hardcoded):**
- System maintenance scripts
- Log rotation scripts
- Backup scripts
- Update scripts
- Diagnostic scripts
- Unified manager scripts

**API Endpoints:**
- `GET /api/servermanager/v1/executor/scripts` - List available hardcoded scripts
- `POST /api/servermanager/v1/executor/run` - Execute predefined script by ID
- `GET /api/servermanager/v1/executor/logs` - Execution logs
- `GET /api/servermanager/v1/executor/status` - Execution status

### 4. Nginx Management Module (`ServerManagerV1NginxManagerCtl`)
**Functionality:**
- Site listing and management (based on nginx analysis report)
- Configuration CRUD operations
- Support for different site types:
  - PHP sites
  - Laravel applications
  - Static websites
  - Reverse proxy configurations
- Configuration validation using nginx -t
- Nginx reload/restart operations
- Log file access
- Handle multiple nginx instances (detected in analysis)

**API Endpoints:**
- `GET /api/servermanager/v1/nginx/sites` - List all sites
- `POST /api/servermanager/v1/nginx/sites` - Create new site
- `PUT /api/servermanager/v1/nginx/sites/{id}` - Update site
- `DELETE /api/servermanager/v1/nginx/sites/{id}` - Delete site
- `POST /api/servermanager/v1/nginx/reload` - Reload nginx
- `GET /api/servermanager/v1/nginx/logs` - Access nginx logs
- `POST /api/servermanager/v1/nginx/validate` - Validate configuration
- `GET /api/servermanager/v1/nginx/instances` - List nginx instances

### 5. Unified Manager Integration Module (`ServerManagerV1UnifiedManagerCtl`)
**Functionality:**
- Integration with `/www/wwwroot/core_node/scripts/unified_manager`
- Application deployment management
- Service monitoring and control
- Build and test operations
- Start/stop/restart applications
- Application registry management
- Integration with deploy_apps.sh, build_apps.sh, start_apps.sh

**API Endpoints:**
- `GET /api/servermanager/v1/unified/apps` - List applications from registry
- `POST /api/servermanager/v1/unified/deploy` - Deploy application
- `POST /api/servermanager/v1/unified/build` - Build application
- `POST /api/servermanager/v1/unified/test` - Test application
- `POST /api/servermanager/v1/unified/start` - Start application
- `POST /api/servermanager/v1/unified/stop` - Stop application
- `POST /api/servermanager/v1/unified/restart` - Restart application
- `GET /api/servermanager/v1/unified/status` - Application status

### 6. SSL Certificate Management Module (`ServerManagerV1CertificateManagerCtl`)
**Functionality:**
- Certbot installation detection (using 26_install_certbot.sh)
- Certificate listing and status
- Automatic certificate generation
- Certificate renewal (from no cert to install, expired to renew)
- Domain validation
- Integration with nginx configurations
- Certificate expiry monitoring
- Certbot installation if not present

**API Endpoints:**
- `GET /api/servermanager/v1/certificates` - List certificates
- `POST /api/servermanager/v1/certificates/generate` - Generate certificate
- `POST /api/servermanager/v1/certificates/renew` - Renew all certificates
- `GET /api/servermanager/v1/certificates/status` - Certificate status
- `POST /api/servermanager/v1/certificates/install-certbot` - Install certbot
- `GET /api/servermanager/v1/certificates/detect-certbot` - Detect certbot installation

## Database Schema

### Tables to Create:
1. `servermanagerv1_nginx_sites` - Nginx site configurations
2. `servermanagerv1_execution_logs` - Code execution logs
3. `servermanagerv1_certificates` - SSL certificate tracking
4. `servermanagerv1_system_snapshots` - System state snapshots
5. `servermanagerv1_file_access_logs` - File access logging
6. `servermanagerv1_predefined_scripts` - Hardcoded script definitions

## Security Considerations

### File Access Security:
- Hardcoded path whitelist only (no parameter-based paths)
- No path traversal attacks possible
- File type restrictions for downloads
- Size limits for file operations
- Audit logging for all file access

### Code Execution Security:
- ONLY predefined hardcoded scripts allowed
- NO dynamic code execution whatsoever
- NO parameter-based code execution
- Script validation before execution
- Resource limits during execution
- Complete execution logging and monitoring
- Scripts stored in database with fixed IDs

### Authentication & Authorization:
- API key authentication required
- Rate limiting on all endpoints
- IP whitelisting options
- Role-based access control
- Complete audit logging
- Session management

### System Security:
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Secure file handling
- Process isolation

## Implementation Phases

### Phase 1: Core Infrastructure (Priority 1)
1. Create application directory structure
2. Set up routing system
3. Create base controllers with security
4. Implement authentication system
5. Create database migrations
6. Set up table maps system
7. Create ApiInfo implementation

### Phase 2: System Information Module (Priority 2)
1. System info collection utilities
2. Process monitoring capabilities
3. Service status checking
4. Permission analysis tools
5. Storage analysis functionality

### Phase 3: File Management Module (Priority 3)
1. Hardcoded path whitelist system
2. Secure file browsing functionality
3. Download capabilities with restrictions
4. Security implementations
5. File information APIs
6. Access logging system

### Phase 4: Code Execution Module (Priority 4)
1. Predefined script database system
2. Hardcoded script library
3. Secure execution engine
4. Comprehensive logging system
5. Resource monitoring during execution
6. Output capture and streaming

### Phase 5: Nginx Management Module (Priority 5)
1. Nginx configuration parsing
2. Site management APIs
3. Configuration validation integration
4. Nginx control integration
5. Log file access system
6. Multi-instance support

### Phase 6: Unified Manager Integration (Priority 6)
1. Script integration with unified_manager
2. Application management system
3. Service control integration
4. Status monitoring capabilities
5. Registry management
6. Deploy/build/test integration

### Phase 7: SSL Certificate Management (Priority 7)
1. Certbot detection system
2. Certificate management APIs
3. Automatic renewal system
4. Nginx integration for SSL
5. Certificate monitoring
6. Installation automation

### Phase 8: Testing and Documentation (Priority 8)
1. Security testing and validation
2. Performance testing and optimization
3. API endpoint testing
4. Complete ApiInfo implementation
5. Error handling refinement
6. Logging system optimization

## Technical Requirements

### Core Dependencies:
- Laravel 12 framework (headless API mode)
- PHP system command execution capabilities
- File system access with security restrictions
- Process monitoring tools
- Database SQLite support
- JSON configuration parsing

### External System Integration:
- `/www/wwwroot/core_node/scripts/unified_manager/` complete system
- `/www/wwwroot/core_node/scripts/shells/linux/debian/install_shells/26_install_certbot.sh`
- Nginx configuration files and management
- System service management (systemctl)
- SSL certificate management (certbot/letsencrypt)
- Process monitoring and control

### Security Requirements:
- Hardcoded script execution only
- Path whitelist security model
- Complete audit logging
- Authentication and authorization
- Input validation and sanitization
- Resource monitoring and limits

### Performance Considerations:
- Caching for system information
- Asynchronous operations for long-running tasks
- Resource monitoring and limits
- Efficient file operations
- Database query optimization
- Memory management for large operations

## Compliance with Laravel Guide

This project will strictly follow all rules in `LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md`:

### Naming Conventions:
- Application name: `ServerManagerV1`
- Controllers: `ServerManagerV1{ModuleName}Ctl`
- Models: `ServerManagerV1{ModelName}Model`
- Utils: `ServerManagerV1Utils`
- Table Maps: `ServerManagerV1TablesMaps`

### Directory Structure:
- Controllers: `app/Apps/ServerManagerV1/ServerManagerV1Controllers/`
- Models: `app/Apps/ServerManagerV1/ServerManagerV1Models/`
- Utils: `app/Apps/ServerManagerV1/ServerManagerV1Utils/`
- Routes: `routes/ServerManagerV1Router/`
- Global Variables: `app/Apps/ServerManagerV1/ServerManagerV1Gvar/`
- Table Maps: `app/Apps/ServerManagerV1/ServerManagerV1TablesMaps/`

### Development Rules:
- English-only code and comments
- No test code creation or execution
- No unauthorized file deletion
- Proper table maps implementation
- Complete ApiInfo implementation
- No Laravel web frontend features
- Database table prefix: `servermanagerv1_`

## Expected Deliverables

### Core Application:
1. Complete ServerManagerV1 application structure
2. All 6 core modules fully functional
3. 30+ API endpoints implemented
4. Comprehensive security measures
5. Complete database schema

### Integration Features:
6. External system integrations working
7. Unified manager integration complete
8. Nginx management fully operational
9. SSL certificate management functional
10. File management with security

### Quality Assurance:
11. Comprehensive ApiInfo implementation
12. Complete error handling and logging
13. Performance optimization implemented
14. Security testing completed
15. Documentation and compliance verification

This development plan provides a comprehensive, secure server management solution while maintaining strict compliance with Laravel development guidelines and security best practices.

## Command Line Interface Extension

### CLI Application: `ServerManagerV1CLI`
**Purpose**: Provide local command-line interface for server management operations, particularly domain deployment and application management.

#### **CLI Structure**
- **CLI Directory**: `app/Apps/ServerManagerV1/ServerManagerV1CLI/`
- **Commands Directory**: `app/Apps/ServerManagerV1/ServerManagerV1CLI/Commands/`
- **Templates Directory**: `app/Apps/ServerManagerV1/ServerManagerV1CLI/Templates/`
- **Entry Point**: `artisan servermanager:deploy`

#### **Core CLI Commands**

##### **1. Domain Deployment Command**
```bash
php artisan servermanager:deploy [domain] [type] [options]
```

**Supported Types:**
- `laravel` - Deploy Laravel application with PHP-FPM
- `poly-app` - Deploy Poly application (Laravel/Vue/Flutter)
- `ncore-app` - Deploy NCore application with reverse proxy
- `static` - Deploy static website
- `proxy` - Deploy reverse proxy configuration

**Command Options:**
```bash
--app-name=APP_NAME          # Application name for poly/ncore apps
--www-dir=PATH               # Custom web directory (default: /www/wwwroot/DOMAIN)
--php-version=VERSION        # PHP version (default: 8.2)
--proxy-target=URL           # Proxy target URL for reverse proxy
--ssl-provider=PROVIDER      # SSL provider (letsencrypt, dnspod, manual)
--ssl-email=EMAIL            # Email for SSL certificate
--force                      # Force update existing configuration
--dry-run                    # Show what would be done without executing
```

##### **2. SSL Management Commands**
```bash
php artisan servermanager:ssl:generate [domain] [options]
php artisan servermanager:ssl:renew [domain]
php artisan servermanager:ssl:list
php artisan servermanager:ssl:status [domain]
```

##### **3. Application Management Commands**
```bash
php artisan servermanager:app:list
php artisan servermanager:app:deploy [app-name]
php artisan servermanager:app:status [app-name]
php artisan servermanager:app:logs [app-name]
```

#### **Deployment Workflows**

##### **Laravel Application Deployment**
1. **Domain Setup**: Create nginx configuration with PHP-FPM
2. **SSL Certificate**: Auto-generate SSL certificate
3. **Configuration**:
   - Document root: `/www/wwwroot/DOMAIN/public`
   - PHP-FPM socket configuration
   - SSL certificate paths
   - Security headers

##### **Poly Application Deployment**
1. **Pre-deployment**: Execute `app/scripts/deploy.sh`
2. **Application Build**: Run build process if needed
3. **Nginx Configuration**:
   - Laravel: PHP-FPM configuration
   - Vue: Static file serving with SPA support
   - Flutter: Static file serving
4. **SSL Certificate**: Auto-generate and configure
5. **Service Integration**: Register with unified manager

##### **NCore Application Deployment**
1. **Application Deployment**: Use unified manager
2. **Service Detection**: Detect application port
3. **Reverse Proxy**: Configure nginx proxy_pass
4. **SSL Certificate**: Auto-generate and configure
5. **Health Checks**: Configure upstream health monitoring

##### **Static Website Deployment**
1. **Directory Setup**: Create/verify web directory
2. **Nginx Configuration**: Static file serving
3. **SSL Certificate**: Auto-generate and configure
4. **Optimization**: Enable gzip, caching headers

#### **SSL Certificate Management**

##### **Certificate Providers**
1. **Let's Encrypt (Default)**
   - HTTP-01 challenge
   - Automatic renewal
   - Free certificates

2. **DNSPod Integration**
   - DNS-01 challenge
   - Wildcard certificate support
   - API-based validation

3. **Manual Certificate**
   - Custom certificate upload
   - External certificate management

##### **Certificate Configuration System**

**Configuration File Location**: `/www/wwwroot/core_node/.secret_keys/.secret_ignore`

This file contains encrypted SSL provider configurations that are decrypted using `dd.sh` script.

**Configuration Structure**:
```json
{
    "ssl_config": {
        "default_provider": "letsencrypt",
        "default_email": "admin@example.com",
        "providers": {
            "letsencrypt": {
                "challenge_type": "http-01",
                "email": "admin@example.com",
                "staging": false,
                "enabled": true
            },
            "dnspod": {
                "challenge_type": "dns-01",
                "api_id": "your_dnspod_api_id",
                "api_token": "your_dnspod_api_token",
                "ttl": 600,
                "enabled": true
            },
            "cloudflare": {
                "challenge_type": "dns-01",
                "api_token": "your_cloudflare_api_token",
                "zone_id": "your_zone_id",
                "enabled": false
            }
        }
    }
}
```

**Decryption Process**:
1. CLI commands automatically read from `/www/wwwroot/core_node/.secret_keys/.secret_ignore`
2. If file doesn't exist or is encrypted, system prompts: "Please run dd.sh to decrypt SSL configuration"
3. After decryption, SSL providers are automatically configured
4. No manual SSL configuration needed in commands

**Updated Command Usage**:
```bash
# SSL configuration is automatic - no --ssl-email needed
php artisan servermanager:deploy example.com laravel

# SSL provider is read from config file
php artisan servermanager:ssl generate example.com
```

#### **Nginx Configuration Templates**

##### **Laravel Template**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_NAME;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_NAME;
    root /www/wwwroot/DOMAIN_NAME/public;
    index index.php index.html;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_NAME/privkey.pem;

    # PHP-FPM Configuration
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Laravel Configuration
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
}
```

##### **Reverse Proxy Template**
```nginx
upstream DOMAIN_NAME_backend {
    server 127.0.0.1:PORT_NUMBER;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_NAME;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_NAME;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_NAME/privkey.pem;

    # Reverse Proxy Configuration
    location / {
        proxy_pass http://DOMAIN_NAME_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

##### **Static Website Template**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_NAME;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_NAME;
    root /www/wwwroot/DOMAIN_NAME;
    index index.html index.htm;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_NAME/privkey.pem;

    # Static File Configuration
    location / {
        try_files $uri $uri/ =404;
    }

    # Optimization
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### **Implementation Phases**

##### **Phase 9: CLI Infrastructure (Priority 9)**
1. Create CLI command structure
2. Implement base command class
3. Create configuration templates
4. Set up logging and error handling

##### **Phase 10: Domain Deployment (Priority 10)**
1. Implement Laravel deployment command
2. Create nginx configuration management
3. Implement SSL certificate generation
4. Add configuration validation

##### **Phase 11: Application Integration (Priority 11)**
1. Implement Poly application deployment
2. Add NCore application support
3. Create static website deployment
4. Integrate with unified manager

##### **Phase 12: SSL Management (Priority 12)**
1. Implement Let's Encrypt integration
2. Add DNSPod API support
3. Create certificate renewal system
4. Add certificate monitoring

##### **Phase 13: Advanced Features (Priority 13)**
1. Add backup and restore functionality
2. Implement configuration rollback
3. Add health monitoring
4. Create deployment hooks

#### **CLI Usage Examples**

```bash
# Deploy Laravel application
php artisan servermanager:deploy example.com laravel --ssl-email=admin@example.com

# Deploy Poly Laravel app
php artisan servermanager:deploy api.example.com poly-app --app-name=laravel_main

# Deploy NCore application with reverse proxy
php artisan servermanager:deploy app.example.com ncore-app --app-name=DevOps

# Deploy static website
php artisan servermanager:deploy static.example.com static --www-dir=/custom/path

# Deploy reverse proxy
php artisan servermanager:deploy proxy.example.com proxy --proxy-target=http://localhost:3000

# SSL management
php artisan servermanager:ssl:generate example.com --provider=dnspod
php artisan servermanager:ssl:renew --all
php artisan servermanager:ssl:list

# Application management
php artisan servermanager:app:deploy laravel_main
php artisan servermanager:app:status --all
```

#### **Configuration Management**

##### **Domain Configuration Storage**
- **Database Table**: `servermanagerv1_domain_configs`
- **Configuration Files**: `/etc/nginx/sites-available/`
- **SSL Certificates**: `/etc/letsencrypt/live/`
- **Backup Location**: `/www/backup/nginx-configs/`

##### **Application Registry Integration**
- **Poly Apps**: Read from `/www/wwwroot/core_node/scripts/unified_manager/app_registry.json`
- **NCore Apps**: Detect from `/www/wwwroot/core_node/apps/`
- **Port Detection**: Automatic service port discovery
- **Health Checks**: Application availability monitoring

#### **Database Schema Extensions**

##### **Domain Configurations Table**
```sql
CREATE TABLE servermanagerv1_domain_configs (
    id INTEGER PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    domain_type ENUM('laravel', 'poly-app', 'ncore-app', 'static', 'proxy'),
    app_name VARCHAR(255),
    www_dir VARCHAR(500),
    php_version VARCHAR(10),
    proxy_target VARCHAR(500),
    ssl_provider VARCHAR(50),
    ssl_email VARCHAR(255),
    ssl_cert_path VARCHAR(500),
    ssl_key_path VARCHAR(500),
    nginx_config_path VARCHAR(500),
    is_enabled BOOLEAN DEFAULT true,
    last_deployed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### **SSL Certificates Extended Table**
```sql
ALTER TABLE servermanagerv1_certificates ADD COLUMN provider VARCHAR(50) DEFAULT 'letsencrypt';
ALTER TABLE servermanagerv1_certificates ADD COLUMN challenge_type VARCHAR(20) DEFAULT 'http-01';
ALTER TABLE servermanagerv1_certificates ADD COLUMN api_config JSON;
ALTER TABLE servermanagerv1_certificates ADD COLUMN wildcard BOOLEAN DEFAULT false;
```