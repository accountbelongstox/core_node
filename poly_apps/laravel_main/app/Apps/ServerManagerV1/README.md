# ServerManagerV1

## System Overview

ServerManagerV1 is a server management application for domain management, SSL certificates, Nginx configuration, and related operations. It is environment-aware and adapts to WSL development and production through unified path mapping for cross-environment consistency.

## Design Approach

### Core Design Principles

1. **Environment-aware architecture**
   - Automatically detects runtime environment (WSL / Production / Development)
   - Unified path mapping via `PathMapper` for transparent cross-environment access
   - No hard-coded paths; all paths resolved dynamically through config classes

2. **Configuration separated from code**
   - Configuration stored in JSON files, not a database
   - Config lives under environment-aware paths
   - Backup and restore for config files

3. **Unified path management**
   - All path access goes through `ServerManagerV1PathConfig`
   - Path config is environment-aware via `PathMapper`
   - Consistent paths across environments

4. **Security first**
   - Secrets (API keys, certificates, etc.) via `GlobalSecretReader`
   - File access whitelist limits reachable paths
   - Command execution limited to predefined safe scripts

## Directory Structure

### ServerManagerV1CLI
CLI layer wrapping Artisan commands.

**Commands/**
- `ServerManagerV1BaseCommand`: Base command with shared behavior
- `ServerManagerV1CertificateCommand`: SSL certificate management
- `ServerManagerV1WebsiteCommand`: Website management (domain conflict detection built in)
- `ServerManagerV1DeployCommand`: Deployment management
- `ServerManagerV1DeploySelfCommand`: Quick deploy of this project (`poly` shortcut)
- `ServerManagerV1SSLCommand`: SSL configuration management
- `ServerManagerV1SyncCommand`: Bidirectional sync (nginx ↔ database)
- `ServerManagerV1NginxInspectCommand`: Nginx config inspection (read-only; does not modify database)
- `ServerManagerV1AdvancedCommand`: Advanced ops (search, validate, backup, batch, etc.)

**Templates/**
- Nginx config templates for different site types

### ServerManagerV1Config
Configuration layer for paths and constants.

- `ServerManagerV1PathConfig`: Environment-aware path accessors

### ServerManagerV1Controllers
Web API controller layer.

- `ServerManagerV1BaseCtl`: Base controller and response format
- `ServerManagerV1CertificateManagerCtl`: Certificate management API
- `ServerManagerV1DomainManagerCtl`: Domain management API (via DomainManager)
- `ServerManagerV1NginxManagerCtl`: Nginx configuration API
- `ServerManagerV1SystemInfoCtl`: System information API
- `ServerManagerV1FileManagerCtl`: File management API
- `ServerManagerV1CodeExecutorCtl`: Constrained code execution API
- `ServerManagerV1UnifiedManagerCtl`: Unified manager API

### ServerManagerV1Utils
Utility layer with core business logic.

- `ServerManagerV1DomainManager`: Domain config in JSON files
- `ServerManagerV1CertificateManager`: Certificates with wildcard/subdomain expansion
- `ServerManagerV1SSLConfigReader`: Reads SSL config from encrypted storage
- `ServerManagerV1Utils`: Shared helpers
- `ServerManagerV1PathResolver`: Deprecated; use PathMapper
- `ServerManagerV1SecretReader`: Deprecated; use GlobalSecretReader

### ServerManagerV1Gvar
Global variables and constants.

- `ServerManagerV1Constants`: App constants, security config, path whitelist, etc.

### ServerManagerV1TablesMaps
Table map definitions (for possible future DB migration).

## Path Mapping

### Design Approach

Environment-aware mapping via `PathMapper`:

1. **Base path mappings**
   - `wwwroot`: Web root
   - `nginxconfig`: Nginx config directory
   - `shared-data`: Shared data directory
   - `backup`: Backup directory
   - `laravel_data_dir`: Laravel data directory

2. **Environment detection**
   - WSL: `/mnt/c/Users` exists
   - Production: not WSL and no desktop session
   - Development: otherwise

3. **Resolution flow**
   - `PathMapper::getCoreNodeDir()` for core directory
   - `PathMapper::mapWebPath()` for concrete paths
   - All access via `ServerManagerV1PathConfig` methods

### Path configuration rules

- Access paths only through config classes; no hard-coding
- System paths (e.g. `/etc/nginx`) via `findActualPath()`
- App paths via `mapWebPath()` for cross-environment consistency

## Configuration Management

### Config file storage

1. **Domain config**
   - Location: `laravel_data_dir/servermanager/domains/domains.json`
   - JSON: domains, SSL, deployment metadata, etc.

2. **Certificate config**
   - Location: `laravel_data_dir/servermanager/certificates/certificates.json`
   - JSON: certificate info, domain list, expiry, etc.

3. **SSL config**
   - Location: encrypted files under `.secret_keys/.secret_ignore/`
   - Read via `GlobalSecretReader` (encrypted files supported)

### Config read flow

1. SSL via `ServerManagerV1SSLConfigReader`
2. Domains via `ServerManagerV1DomainManager`
3. Certificates via `ServerManagerV1CertificateManager`
4. Caching supported for all config reads

## Security Design

### File access control

1. **Whitelist**
   - Allowed paths from `ServerManagerV1Constants::getAllowedDownloadPaths()`
   - Verify path is whitelisted before access
   - Environment-aware path validation

2. **Command restrictions**
   - Only predefined scripts may run
   - Allowed commands in `ServerManagerV1Constants::SYSTEM_COMMANDS`
   - Validate arguments before execution

3. **Secrets**
   - All secrets via `GlobalSecretReader`
   - Encrypted storage with transparent decrypt on read
   - Key files under `.secret_keys`

## Extensibility

### Adding features

1. **New CLI command**
   - Extend `ServerManagerV1BaseCommand`
   - Implement business logic
   - Register in `routes/console.php`

2. **New API endpoint**
   - Extend `ServerManagerV1BaseCtl`
   - Use standard response format
   - Register route in `routes/api.php`

3. **New utility class**
   - Place under `ServerManagerV1Utils`
   - Single responsibility
   - Shared path config and error handling

### Path extensions

1. **New path mapping**
   - Add rule in `PathMapper::mapWebPath()`
   - Add accessor on `ServerManagerV1PathConfig`
   - Update whitelist if needed

2. **Environment adaptation**
   - Extend environment detection in `PathMapper`
   - Verify mapping in all environments

## Data Storage Strategy

### JSON file storage

Config is stored as JSON files instead of a database because:

1. **Simpler deploy**: no DB migration; configs are easy to back up
2. **Version control**: configs can live in git
3. **Debugging**: inspect and edit files directly
4. **Performance**: small config sets; file I/O is sufficient

### Storage location

- All config under `laravel_data_dir/servermanager/`
- Paths resolved via `PathMapper` per environment
- Auto-create config files and directories

## Error Handling

### Unified error responses

1. **API errors**
   - Standard format from `ServerManagerV1BaseCtl`
   - Error code, message, details
   - Exception capture and logging

2. **CLI errors**
   - Standard output from `ServerManagerV1BaseCommand`
   - Detailed messages and stack traces
   - Remediation hints where applicable

### Logging

- Log all critical operations
- Errors include context
- Multiple log levels

## Dependencies

### Core dependencies

1. **PathMapper**: environment-aware path resolution
2. **GlobalSecretReader**: unified secret access
3. **ServerManagerV1PathConfig**: unified path accessors

### Deprecated classes

Do not use these deprecated classes:

- `ServerManagerV1PathResolver`: replaced by `PathMapper`
- `ServerManagerV1SecretReader`: replaced by `GlobalSecretReader`

## Development Guidelines

### Path access

- No hard-coded paths; use `ServerManagerV1PathConfig`
- New paths need matching accessors on `ServerManagerV1PathConfig`
- Check path exists before use

### Config access

- Use DomainManager / CertificateManager for config
- Call save after config changes
- Reads are cached to limit file I/O

### Security

- Whitelist paths before file access
- Verify command is allowed before execution
- Read secrets only via `GlobalSecretReader`

## Command Examples

**Updated: 2025-01-27**

### SSL certificate management

```bash
# Add certificate (auto wildcard + subdomain certs)
php artisan servermanager:certificate add example.com

# Add certificate with subdomain prefixes
php artisan servermanager:certificate add example.com --prefixes=si,sz,local,api

# Find certificate
php artisan servermanager:certificate find api.example.com

# List all certificates
php artisan servermanager:certificate list

# Certificate summary
php artisan servermanager:certificate summary

# Update certificate status
php artisan servermanager:certificate update example.com --status=active
```

### Website management

#### Website types

ServerManagerV1 supports three site types:

- **html**: Static HTML site
  - Pure static content (HTML, CSS, JS, images, etc.)
  - Document root: `/www/wwwroot/domain/`
  - No PHP required

- **laravel**: Standalone Laravel project
  - Deploy a separate Laravel app
  - Document root: `/www/wwwroot/domain/public/`
  - Requires full Laravel project layout
  - PHP-FPM or Swoole/Octane

- **poly**: Laravel Main project (this repo)
  - Deploy this ServerManagerV1 Laravel project as a site
  - Document root: `/www/programing/core_node/poly_apps/laravel_main/public/`
  - All `poly` domains share one Laravel codebase
  - Good for API endpoints and admin UIs
  - PHP-FPM or Swoole/Octane

#### PHP modes

Two PHP runtime modes:

- **fpm**: PHP-FPM (default)
  - Classic PHP-FPM process model
  - Traditional PHP apps
  - One request per worker lifecycle

- **swoole**: Swoole/Octane
  - Long-lived Swoole workers
  - Laravel Octane
  - High-concurrency APIs
  - Manages Swoole systemd service
  - Multiple domains can share one Swoole service (by directory)
  - Ports 9000–9999 (auto-assigned)

#### Basic operations

```bash
# Add Laravel site (standalone, default PHP-FPM)
php artisan servermanager:website add example.com --type=laravel

# Add Laravel site (Swoole/Octane)
php artisan servermanager:website add example.com --type=laravel --php-mode=swoole

# Add static HTML site
php artisan servermanager:website add local.example.com --type=html

# Add poly site (Laravel Main; Swoole recommended)
php artisan servermanager:website add api.example.com --type=poly --php-mode=swoole

# Add site with SSL (auto)
php artisan servermanager:website add example.com --type=laravel --ssl=auto

# Example: API site (poly + Swoole + SSL)
php artisan servermanager:website add api.example.com --type=poly --php-mode=swoole --ssl=auto

# List all sites
php artisan servermanager:website list

# Site status
php artisan servermanager:website status example.com

# Site summary
php artisan servermanager:website summary

# Remove site
php artisan servermanager:website remove example.com
```

**Options:**
- `--type`: Site type (`html`|`laravel`|`poly`; default `laravel`)
- `--php-mode`: PHP mode (`fpm`|`swoole`; default `fpm`)
- `--ssl`: SSL mode (`auto`|`true`|`false`; default `auto`)

**Notes:**
- With `--php-mode=swoole`, Swoole systemd service is managed automatically
- Domains with the same directory share one Swoole service
- Swoole port auto-assigned in 9000–9999
- Re-run `add` to switch modes (e.g. FPM → Swoole); Laravel handles the transition

### SSL configuration

```bash
# Generate SSL certificate
php artisan servermanager:ssl generate example.com --email=admin@example.com

# Renew one certificate
php artisan servermanager:ssl renew example.com

# Renew all certificates
php artisan servermanager:ssl renew --all

# List all certificates
php artisan servermanager:ssl list

# Certificate status
php artisan servermanager:ssl status example.com

# Show SSL config
php artisan servermanager:ssl config
```

### Deployment

#### Quick deploy this project

```bash
# Deploy Laravel Main as nginx site (default FPM)
# Shortcut for `--type=poly`
php artisan servermanager:deploy-self api.example.com

# Deploy with Swoole/Octane (recommended for APIs)
php artisan servermanager:deploy-self api.example.com --php-mode=swoole

# Example: Swoole + SSL
php artisan servermanager:deploy-self api.example.com --php-mode=swoole --ssl=auto

# Dry-run deploy
php artisan servermanager:deploy-self api.example.com --dry-run

# Deploy without nginx reload
php artisan servermanager:deploy-self api.example.com --no-reload
```

**Notes:**
- `deploy-self` is shorthand for `website add --type=poly`
- Points domain at this Laravel project's `public/`
- All `deploy-self` domains share one Laravel app
- Good for APIs and admin backends
- Prefer `--php-mode=swoole` for performance

**Options:**
- `--php-mode`: PHP mode (`fpm`|`swoole`; default `fpm`)
- `--ssl`: SSL mode (`auto`|`true`|`false`; default `auto`)
- `--dry-run`: Preview only
- `--no-reload`: Skip nginx reload

#### Deploy other apps

```bash
# Deploy standalone Laravel app (new directory)
php artisan servermanager:deploy example.com laravel

# Deploy poly app
php artisan servermanager:deploy example.com poly-app

# Deploy Ncore app
php artisan servermanager:deploy example.com ncore-app

# Deploy static site
php artisan servermanager:deploy example.com static

# Deploy proxy site
php artisan servermanager:deploy example.com proxy
```

### Config sync and Nginx inspection

**Updated: 2025-01-27**

Bidirectional config sync and read-only Nginx inspection.

#### Bidirectional sync

Two sync directions:

1. **DATABASE → NGINX**: Regenerate all nginx configs from DB (default)
2. **NGINX → DATABASE**: Import existing nginx configs into DB

```bash
# Show sync status
php artisan servermanager:sync --status

# ========================================
# Direction 1: DATABASE → NGINX (default)
# ========================================

# DB → nginx (dry run)
php artisan servermanager:sync --dry-run

# DB → nginx (apply)
php artisan servermanager:sync
# Or specify direction explicitly
php artisan servermanager:sync --to-nginx

# This will:
# 1. Remove existing nginx configs (except default)
# 2. Regenerate nginx from domain records
# 3. Enable sites with `nginx_enabled=true`

# ========================================
# Direction 2: NGINX → DATABASE (new)
# ========================================

# nginx → DB (dry run)
php artisan servermanager:sync --from-nginx --dry-run

# nginx → DB (merge; skip existing domains)
php artisan servermanager:sync --from-nginx

# nginx → DB (overwrite existing domains)
php artisan servermanager:sync --from-nginx --overwrite

# This will:
# 1. Scan nginx sites-available
# 2. Parse server_name, root, SSL, PHP version, etc.
# 3. Import into database
# 4. Default merge skips existing domains
# 5. `--overwrite` updates existing domains
```

#### Nginx inspection (standalone)

`servermanager:nginx-inspect` inspects nginx without changing the database.

```bash
# List all nginx configs (table)
php artisan servermanager:nginx-inspect

# Summary
php artisan servermanager:nginx-inspect --summary

# Detailed view (includes summary)
php artisan servermanager:nginx-inspect --detailed

# Details for one domain
php artisan servermanager:nginx-inspect local.api.12gm.com

# Filter by type
php artisan servermanager:nginx-inspect --type=laravel
php artisan servermanager:nginx-inspect --type=poly
php artisan servermanager:nginx-inspect --type=html

# Filter by SSL
php artisan servermanager:nginx-inspect --ssl         # SSL-enabled sites only
php artisan servermanager:nginx-inspect --no-ssl      # Non-SSL sites only

# Filter by enabled state
php artisan servermanager:nginx-inspect --enabled     # Enabled sites only
php artisan servermanager:nginx-inspect --disabled    # Disabled sites only

# Combined filters
php artisan servermanager:nginx-inspect --type=poly --ssl --enabled

# JSON output
php artisan servermanager:nginx-inspect --json
php artisan servermanager:nginx-inspect local.api.12gm.com --json
```

#### Typical workflows

##### Scenario 1: Import existing nginx config from scratch

```bash
# 1. Inspect current nginx
php artisan servermanager:nginx-inspect --summary

# 2. Preview import
php artisan servermanager:sync --from-nginx --dry-run

# 3. Run import
php artisan servermanager:sync --from-nginx

# 4. Verify domains
php artisan servermanager:website list
```

##### Scenario 2: Rebuild all nginx from database

```bash
# 1. Backup (optional)
php artisan servermanager:advanced backup

# 2. Sync status
php artisan servermanager:sync --status

# 3. Preview sync
php artisan servermanager:sync --dry-run

# 4. Run sync
php artisan servermanager:sync

# 5. Reload nginx
sudo systemctl reload nginx
```

##### Scenario 3: Compare nginx vs database

```bash
# Sync status (orphan/missing configs)
php artisan servermanager:sync --status

# All nginx configs
php artisan servermanager:nginx-inspect

# All domains in database
php artisan servermanager:website list
```

#### Config parsing

`parseNginxConfig()` extracts:

- **Domain**: from filename
- **server_name**: from directive
- **root**: document root
- **SSL**: `listen 443 ssl`
- **Cert paths**: `ssl_certificate` / `ssl_certificate_key`
- **PHP version**: from `fastcgi_pass` socket path
- **Site type**:
  - `try_files $uri $uri/ /index.php` → `laravel`
  - path contains `/poly_apps/laravel_main` → `poly`
  - default → `html`
- **Listen port**: from `listen`

#### Notes

1. **DATABASE → NGINX deletes existing configs** (except default/ssl-challenges). Use `--dry-run` first.

2. **NGINX → DATABASE** defaults to merge; `--overwrite` updates existing domains.

3. **Reload nginx** after sync: `sudo systemctl reload nginx`.

4. **`nginx-inspect` is read-only** — safe for diagnostics.

### Advanced management

**Updated: 2025-01-27**

`servermanager:advanced` supports search, validation, backup, and batch ops.

#### Domain search

```bash
# Search Laravel sites
php artisan servermanager:advanced search --type=laravel

# Active sites with SSL
php artisan servermanager:advanced search --status=active --ssl=true

# Sites by PHP version
php artisan servermanager:advanced search --php-version=8.4

# Keyword search (domain or directory)
php artisan servermanager:advanced search --search=example

# Combined search
php artisan servermanager:advanced search --type=poly --status=active --ssl=true

# Domains grouped by site directory
php artisan servermanager:advanced grouped
```

#### Validation

```bash
# Validate all domain configs
# Checks: directories, nginx files, SSL certs, PHP-FPM sockets, etc.
php artisan servermanager:advanced validate
```

#### Backup and restore

```bash
# Backup all domain configs
php artisan servermanager:advanced backup

# List backups (shown when restore omits --file)
php artisan servermanager:advanced restore

# Restore from backup (replace all domains)
php artisan servermanager:advanced restore --file=/path/to/backup.json

# Restore from backup (merge)
php artisan servermanager:advanced restore --file=/path/to/backup.json --merge
```

#### Import and export

```bash
# Export JSON
php artisan servermanager:advanced export --format=json

# Export CSV
php artisan servermanager:advanced export --format=csv

# Export nginx list format
php artisan servermanager:advanced export --format=nginx

# Import file (merge)
php artisan servermanager:advanced import --file=/path/to/domains.json --format=json --merge

# Import file (replace)
php artisan servermanager:advanced import --file=/path/to/domains.json --format=json
```

#### Batch operations

```bash
# Batch enable domains
php artisan servermanager:advanced batch-enable \
    --domains=example.com \
    --domains=test.com \
    --domains=staging.com

# Batch disable (keep files; remove nginx links)
php artisan servermanager:advanced batch-disable \
    --domains=example.com \
    --domains=test.com \
    --reason="Maintenance"

# Notes: after batch disable:
#   - nginx config files remain
#   - sites-enabled symlinks removed
#   - site files untouched
#   - domain status → disabled
```

#### Domain history

```bash
# Last 50 domain operations
php artisan servermanager:advanced history

# History for one domain
php artisan servermanager:advanced history --search=example.com

# More history rows
php artisan servermanager:advanced history --limit=100
```

#### Aliases and redirects

```bash
# www redirect (301 permanent)
php artisan servermanager:advanced alias \
    --source=www.example.com \
    --target=example.com \
    --redirect-code=301

# Temporary redirect (302)
php artisan servermanager:advanced alias \
    --source=old.example.com \
    --target=new.example.com \
    --redirect-code=302

# Notes:
#   - Auto-generates nginx redirect config
#   - HTTP and HTTPS redirects
#   - Source uses target SSL cert when target has SSL
```

#### Site templates

```bash
# List templates
php artisan servermanager:advanced templates

# Available templates:
#   - laravel_api: Laravel API (API + CORS + rate limits)
#   - laravel_full: Full-stack Laravel (web + API + auth)
#   - static_spa: Static SPA (Vue/React)
#   - wordpress: WordPress CMS
```

## Extended Features

### Domain conflict detection

`ServerManagerV1WebsiteCommand` includes automatic conflict detection:

```bash
# Conflicts checked when adding a domain
php artisan servermanager:website add example.com --type=laravel

# If domain exists, the CLI will:
# 1. Show current config
# 2. Analyze impact (site migration?)
# 3. Check whether old site has other domains
# 4. Prompt to continue
```

**Conflict scenarios:**

1. **Config update** (same directory):
   - Update domain record only
   - Other domains unchanged

2. **Site migration** (different directory):
   - Domain moves to new site directory
   - Warns if old site had only this domain
   - Old site files are kept

### Multi-domain sites

Multiple domains can share one site directory:

```bash
# example.com and www.example.com share one directory
php artisan servermanager:website add example.com --type=laravel
php artisan servermanager:website add www.example.com --type=laravel

# Domains grouped by directory
php artisan servermanager:advanced grouped

# Example output:
# 📁 /www/wwwroot/example.com (laravel)
#    Domains: 2
#    ✅ 🔒 example.com
#    ✅ 🔒 www.example.com
```

### Enable / disable sites

Enable/disable via `ServerManagerV1DomainManager`:

```php
// Disable site (keep files; remove nginx enable link)
ServerManagerV1DomainManager::disableSite('example.com', [
    'reason' => 'Maintenance'
]);

// Re-enable site (regenerate nginx config and link)
ServerManagerV1DomainManager::enableSite('example.com');
```

### Configuration validation

Validates all domain configurations:

- ✅ `www_dir` exists
- ✅ nginx config file exists
- ✅ sites-enabled symlink
- ✅ SSL certificate files
- ✅ PHP-FPM socket

### Data consistency

Extended features follow these rules:

1. **Path mapping**: `PathMapper::mapWebPath()`
2. **Unified config**: `ServerManagerV1PathConfig`
3. **Logging**: Laravel log for all operations
4. **History**: critical ops in `history.json`
5. **Atomic writes**: validate then save

### API usage

All features are callable via `ServerManagerV1DomainManager`:

```php
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;

// Domain conflict check
$conflict = ServerManagerV1DomainManager::checkDomainConflict('example.com');

// Find all domains for a site directory
$domains = ServerManagerV1DomainManager::findSitesByDirectory('/www/wwwroot/example.com');

// Search domains
$results = ServerManagerV1DomainManager::searchDomains([
    'type' => 'laravel',
    'status' => 'active',
    'ssl_enabled' => true
]);

// Batch operations
$results = ServerManagerV1DomainManager::batchEnableSites(['domain1.com', 'domain2.com']);
$results = ServerManagerV1DomainManager::batchDisableSites(['domain3.com'], ['reason' => 'Test']);

// Backup and restore
$backup = ServerManagerV1DomainManager::backupDomains();
$restore = ServerManagerV1DomainManager::restoreDomains('/path/to/backup.json', true);

// Import / export
$export = ServerManagerV1DomainManager::exportDomains('csv');
$import = ServerManagerV1DomainManager::importDomains('/path/to/file.json', 'json', true);

// Validate configs
$validation = ServerManagerV1DomainManager::validateAllConfigurations();

// Domain history
$history = ServerManagerV1DomainManager::getHistory('example.com', 50);

// Domain alias
ServerManagerV1DomainManager::addDomainAlias('www.example.com', 'example.com', 301);

// Site templates
$templates = ServerManagerV1DomainManager::getTemplates();
ServerManagerV1DomainManager::applyTemplate('api.example.com', 'laravel_api');
```

## Roadmap

1. **Database migration**: table defs in `ServerManagerV1TablesMaps` for future DB storage
2. **Stronger validation**
3. **Performance**: config read/cache tuning
4. **Monitoring and alerts**

