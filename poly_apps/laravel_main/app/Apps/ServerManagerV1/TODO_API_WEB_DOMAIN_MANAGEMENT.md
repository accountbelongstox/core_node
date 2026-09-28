# TODO: API-Web Domain Management Features

## Current Status
- ✅ Command Line Interface (CLI) - Fully implemented
- ❌ API-Web Interface - Needs development

## Required API-Web Endpoints

### 1. Domain Deployment API (Enhanced with Wildcard SSL)
**Endpoint:** `POST /api/servermanager/v1/domains/deploy`

**Parameters:**
```json
{
    "domain": "example.com",
    "type": "laravel|static|proxy|php",
    "config": {
        "www_dir": "/www/wwwroot/example.com",
        "php_version": "8.2",
        "proxy_target": "http://localhost:3000",
        "create_index": true,
        "ssl_wildcard": true,
        "subdomain_prefixes": ["si", "sz", "local", "api"]
    },
    "options": {
        "force": true,
        "no_ssl": false,
        "dry_run": false,
        "expand_certificate": true
    }
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "domain": "example.com",
        "deployment_id": "deploy_abc123",
        "nginx_deployed": true,
        "ssl_generated": true,
        "ssl_certificate_id": "cert_example_com",
        "expanded_domains": [
            "example.com", "*.example.com",
            "si.example.com", "*.si.example.com",
            "api.example.com", "*.api.example.com"
        ],
        "index_file_created": true,
        "status": "active"
    },
    "message": "Domain deployed successfully with wildcard SSL coverage"
}
```

### 2. Domain List API
**Endpoint:** `GET /api/servermanager/v1/domains`

**Response:**
```json
{
    "success": true,
    "data": {
        "domains": [
            {
                "domain": "example.com",
                "type": "laravel",
                "nginx_enabled": true,
                "ssl_enabled": true,
                "status": "active",
                "created_at": "2024-01-01 12:00:00",
                "updated_at": "2024-01-01 12:05:00"
            }
        ],
        "total": 1
    }
}
```

### 3. Domain Status API
**Endpoint:** `GET /api/servermanager/v1/domains/{domain}/status`

**Response:**
```json
{
    "success": true,
    "data": {
        "domain": "example.com",
        "nginx_status": "enabled",
        "ssl_status": "active",
        "certificate_expires": "2024-04-01",
        "last_deployment": "2024-01-01 12:00:00",
        "deployment_history": [...]
    }
}
```

### 4. Domain SSL Management API
**Endpoint:** `POST /api/servermanager/v1/domains/{domain}/ssl`

**Parameters:**
```json
{
    "action": "generate|renew",
    "provider": "dnspod",
    "staging": false
}
```

### 5. Domain Removal API
**Endpoint:** `DELETE /api/servermanager/v1/domains/{domain}`

**Parameters:**
```json
{
    "remove_files": false,
    "backup_config": true
}
```

### 6. Certificate Management API
**Endpoint:** `GET /api/servermanager/v1/certificates`

**Response:**
```json
{
    "success": true,
    "data": {
        "total_certificates": 2,
        "active_certificates": 2,
        "expired_certificates": 0,
        "expiring_soon": 0,
        "certificates": [
            {
                "id": "cert_example_com",
                "base_domain": "example.com",
                "domains": ["example.com", "*.example.com", "api.example.com"],
                "status": "active",
                "expires_at": "2024-04-01 12:00:00",
                "auto_renew": true
            }
        ]
    }
}
```

### 7. Certificate Expansion API
**Endpoint:** `POST /api/servermanager/v1/certificates/{domain}/expand`

**Parameters:**
```json
{
    "new_domain": "a.new.example.com",
    "auto_expand": true
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "expansion_needed": true,
        "new_base_domain": "new.example.com",
        "certificate_updated": true,
        "new_domains_added": ["new.example.com", "*.new.example.com"]
    }
}
```

### 8. Domain Summary API
**Endpoint:** `GET /api/servermanager/v1/domains/summary`

**Response:**
```json
{
    "success": true,
    "data": {
        "total_domains": 5,
        "active_domains": 4,
        "ssl_enabled_domains": 4,
        "nginx_enabled_domains": 5,
        "laravel_domains": 3,
        "static_domains": 2,
        "php_versions": {
            "8.2": 3,
            "8.1": 2
        }
    }
}
```

## Implementation Requirements

### 1. Controller Methods Needed
- `ServerManagerV1DomainController::deployDomain()` - Deploy with wildcard SSL and index.html creation
- `ServerManagerV1DomainController::listDomains()` - List with detailed information
- `ServerManagerV1DomainController::getDomainStatus()` - Include certificate and PHP info
- `ServerManagerV1DomainController::manageDomainSSL()` - Handle certificate expansion
- `ServerManagerV1DomainController::removeDomain()` - Clean removal with backup
- `ServerManagerV1DomainController::getDomainsSummary()` - Statistics and overview
- `ServerManagerV1CertificateController::listCertificates()` - Certificate management
- `ServerManagerV1CertificateController::expandCertificate()` - Handle domain expansion

### 2. Route Definitions
Add to `ServerManagerV1Routes.php`:
```php
// Domain Management Routes
Route::prefix('domains')->group(function () {
    Route::get('/', [ServerManagerV1DomainController::class, 'listDomains']);
    Route::get('summary', [ServerManagerV1DomainController::class, 'getDomainsSummary']);
    Route::post('deploy', [ServerManagerV1DomainController::class, 'deployDomain']);
    Route::get('{domain}/status', [ServerManagerV1DomainController::class, 'getDomainStatus']);
    Route::post('{domain}/ssl', [ServerManagerV1DomainController::class, 'manageDomainSSL']);
    Route::delete('{domain}', [ServerManagerV1DomainController::class, 'removeDomain']);
});

// Certificate Management Routes (Enhanced)
Route::prefix('certificates')->group(function () {
    Route::get('/', [ServerManagerV1CertificateController::class, 'listCertificates']);
    Route::get('summary', [ServerManagerV1CertificateController::class, 'getCertificatesSummary']);
    Route::post('{domain}/expand', [ServerManagerV1CertificateController::class, 'expandCertificate']);
    Route::get('{domain}/coverage', [ServerManagerV1CertificateController::class, 'checkDomainCoverage']);
});
```

### 3. Integration with Existing Systems
- Use `ServerManagerV1DomainManager` for JSON file operations (✅ Implemented)
- Use `ServerManagerV1CertificateManager` for certificate management (✅ Implemented)
- Integrate with existing `ServerManagerV1DeployCommand` logic
- Reuse `ServerManagerV1CertificateManagerCtl` SSL functionality
- Maintain compatibility with shell script deployment (✅ Enhanced in 132_setup_domains.sh)
- Support wildcard certificate generation with expanded domain coverage (✅ Implemented)
- Automatic index.html file creation (✅ Implemented)
- Certificate expansion for new subdomains (✅ Implemented)

### 4. Validation and Security
- Domain name validation
- Rate limiting for deployment operations
- Authentication/authorization checks
- Input sanitization for file paths

### 5. Error Handling
- Standardized error responses
- Detailed error logging
- Rollback mechanisms for failed deployments
- Graceful handling of system command failures

## Development Priority
1. **High Priority:** Domain deployment API (POST /domains/deploy)
2. **Medium Priority:** Domain list and status APIs
3. **Low Priority:** Advanced management features

## Testing Requirements
- Unit tests for all controller methods
- Integration tests with actual nginx/certbot
- API endpoint testing
- Error scenario testing

## Documentation Needs
- API documentation updates
- Postman collection
- Usage examples
- Migration guide from CLI to API

## Notes
- Current shell script (132_setup_domains.sh) should remain functional
- API should provide same functionality as CLI commands
- JSON database structure already implemented in `ServerManagerV1DomainManager`
- Consider implementing WebSocket for real-time deployment status updates
