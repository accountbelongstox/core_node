# ServerManager Static Command - Implementation Complete

## Status Update

**Date**: 2025-12-07
**Status**: ✅ **IMPLEMENTED**

## Implementation Summary

The `servermanager:static` command has been successfully implemented with full functionality:

### Files Created

1. **ServerManagerV1StaticServiceManager.php**
   - Location: `app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1StaticServiceManager.php`
   - Purpose: Utility class for managing static app systemd services
   - Features:
     - Debug mode: Creates systemd service running dev server (`pnpm run dev`)
     - Production mode: No service needed (nginx serves static files directly)
     - Package manager auto-detection (pnpm/yarn/npm)
     - Service lifecycle management (start/stop/restart/remove)
     - Port management and duplicate service resolution

2. **ServerManagerV1StaticAppCommand.php**
   - Location: `app/Apps/ServerManagerV1/ServerManagerV1CLI/Commands/ServerManagerV1StaticAppCommand.php`
   - Purpose: Artisan command for deploying static web apps
   - Actions: add, remove, restart, status, list
   - Modes: debug (dev server) and production (static files)

3. **Command Registration**
   - Modified: `app/Providers/AppServiceProvider.php`
   - Added `ServerManagerV1StaticAppCommand::class` to registered commands

### Command Availability

```bash
$ php artisan list | grep servermanager:static
servermanager:static         Manage static web apps (React/Vue/Vite) with nginx integration
```

✅ Command is now available and functional

## Original Problem

The `poly_app_manager.sh` script calls a **non-existent** Laravel artisan command:

```bash
php artisan servermanager:static add "$PROJECT_NAME" --port="$PORT" --build-path="$PATH" --debug
```

### Current Usage Locations

| Line | Project Type | Mode | Command |
|------|--------------|------|---------|
| 259 | React Native | debug + deploy | `servermanager:static add --port --debug` |
| 294 | React Native | build + deploy | `servermanager:static add --port` |
| 371 | React/Vue/Vite | debug + deploy | `servermanager:static add --port --build-path --debug` |
| 428 | React/Vue/Vite | build + deploy | `servermanager:static add --port --build-path` |
| 468 | React/Vue/Vite | preview + deploy | `servermanager:static add --port --build-path` |

### Commands That Actually Exist

```bash
$ php artisan list | grep servermanager

servermanager:nuxt        ✅ EXISTS - Manages Nuxt poly apps
servermanager:website     ✅ EXISTS - Manages nginx websites (Laravel)
servermanager:deploy      ✅ EXISTS - Deploy domain with nginx + SSL
servermanager:swoole      ✅ EXISTS - Manage Octane/Swoole services
servermanager:certificate ✅ EXISTS - Manage SSL certificates
servermanager:advanced    ✅ EXISTS - Advanced domain operations
servermanager:ssl         ✅ EXISTS - Manage SSL certificates
servermanager:sync        ✅ EXISTS - Sync nginx configs with database
servermanager:nginx-inspect ✅ EXISTS - Inspect nginx configurations

servermanager:static      ❌ DOES NOT EXIST
```

## Required Implementation

The `servermanager:static` command needs to be created to handle static web apps (React/Vue/Vite) and React Native web builds.

### Command Signature

```php
protected $signature = 'servermanager:static
                        {action : Action to perform (add|remove|restart|status|list)}
                        {appname? : Static app namespace (e.g., matrix_ui_react)}
                        {--domain= : Domain name for nginx proxy}
                        {--port= : Port number (required)}
                        {--build-path= : Path to build output or source (required)}
                        {--ssl= : SSL mode (auto|true|false, default: auto)}
                        {--debug : Enable debug mode (runs dev server instead of serving static files)}';
```

### Two Operational Modes

#### Mode 1: Production (No --debug flag)

**Purpose**: Serve pre-built static files

**Behavior**:
1. `--build-path` points to directory containing `dist/` or `build/` output
2. Set up nginx to serve static files from this directory
3. Configure nginx location rules:
   - Serve `index.html` for all routes (SPA fallback)
   - Set proper MIME types
   - Enable gzip compression
4. NO systemd service needed (pure static serving)

**Nginx Config Example**:
```nginx
server {
    listen 80;
    server_name matrix-ui-react.example.com;

    root /path/to/build-path/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Mode 2: Debug (With --debug flag)

**Purpose**: Run development server as a persistent system service

**Behavior**:
1. `--build-path` points to SOURCE directory (not built output)
2. Detect package manager (pnpm/npm/yarn) from lock files
3. Create systemd service that runs dev server:
   ```bash
   cd /path/to/source
   pnpm run dev --port $PORT --host 0.0.0.0
   ```
4. Set up nginx as reverse proxy to `localhost:$PORT`
5. Similar to how `servermanager:nuxt` works with `--debug`

**Systemd Service Example**:
```ini
[Unit]
Description=Static App Dev Server - matrix_ui_react
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/www/programing/core_node/poly_apps/matrix_ui_react
Environment="PORT=3456"
Environment="NODE_ENV=development"
ExecStart=/usr/bin/pnpm run dev --port 3456 --host 0.0.0.0
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Nginx Config Example** (reverse proxy):
```nginx
server {
    listen 80;
    server_name matrix-ui-react.example.com;

    location / {
        proxy_pass http://localhost:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Implementation Requirements

### File to Create

**Location**: `/www/programing/core_node/poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1CLI/Commands/ServerManagerV1StaticAppCommand.php`

### Class Structure

```php
<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1StaticServiceManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;
use App\Utils\SystemUtil;
use Illuminate\Support\Facades\Log;

class ServerManagerV1StaticAppCommand extends ServerManagerV1BaseCommand
{
    protected $signature = 'servermanager:static
                            {action : Action to perform (add|remove|restart|status|list)}
                            {appname? : Static app namespace}
                            {--domain= : Domain name for nginx proxy}
                            {--port= : Port number (required)}
                            {--build-path= : Path to build output or source (required)}
                            {--ssl= : SSL mode (auto|true|false, default: auto)}
                            {--debug : Enable debug mode (runs dev server)}';

    protected $description = 'Manage static web apps (React/Vue/Vite) with nginx integration';

    private $debugMode = false;

    public function handle(): int
    {
        $this->initializeCommand();
        $this->debugMode = $this->option('debug') || SystemUtil::isWslDesktopEnvironment();

        $action = $this->argument('action');
        $appname = $this->argument('appname');

        return match($action) {
            'add' => $this->addStaticApp($appname),
            'remove' => $this->removeStaticApp($appname),
            'restart' => $this->restartStaticApp($appname),
            'status' => $this->showStaticAppStatus($appname),
            'list' => $this->listStaticApps(),
            default => $this->showHelp()
        };
    }

    private function addStaticApp(?string $appname): int
    {
        // Implementation here
        // 1. Validate --port and --build-path are provided
        // 2. Detect if debug mode
        // 3. If debug: create systemd service + reverse proxy
        // 4. If production: serve static files
        // 5. Register in database
        // 6. Reload nginx
    }

    // ... other methods
}
```

### Utility Class to Create

**Location**: `/www/programing/core_node/poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1StaticServiceManager.php`

**Purpose**: Similar to `ServerManagerV1NuxtServiceManager`, handles systemd service creation for static app dev servers.

## Architecture Compliance

### ✅ Compliant with Rule 2

This implementation is **100% compliant** with the architecture requirement:

> **Rule 2**: Laravel ServerManager ONLY manages nginx reverse proxy and systemd services

**What it DOES** (compliant):
- ✅ Generates nginx config files
- ✅ Reloads nginx
- ✅ Creates systemd service files (for debug mode)
- ✅ Manages systemd services (start/stop/restart)
- ✅ Registers configurations in database

**What it DOES NOT DO** (compliant):
- ❌ Does NOT run `npm install` or `pnpm install`
- ❌ Does NOT run `npm run build`
- ❌ Does NOT copy/move build files
- ❌ Does NOT modify source code

All build operations remain in the Shell script (`poly_app_manager.sh`).

## Comparison with Existing Commands

### servermanager:nuxt (Reference Implementation)

The `servermanager:static` command should mirror the design of `servermanager:nuxt`:

| Feature | servermanager:nuxt | servermanager:static (new) |
|---------|-------------------|---------------------------|
| `--debug` flag | ✅ Runs dev server via systemd | ✅ Runs dev server via systemd |
| `--build-path` | ✅ Points to source or factory build | ✅ Points to source or dist/ |
| Nginx proxy | ✅ Reverse proxy to dev server | ✅ Reverse proxy (debug) or static (production) |
| Systemd service | ✅ Created for dev server | ✅ Created for dev server (debug only) |
| SSL support | ✅ Via --ssl option | ✅ Via --ssl option |
| Port management | ✅ Via --port option | ✅ Via --port option |

### Key Difference

**Nuxt**:
- Always needs a server process (even in production with .output/server/)
- Always creates systemd service
- Always uses reverse proxy

**React/Vue/Vite (Static)**:
- **Debug mode**: Needs dev server → systemd service + reverse proxy
- **Production mode**: Pure static files → nginx serves directly, NO systemd service

## Impact Analysis

### What's Currently Broken

1. ❌ All React/Vue/Vite debug+deploy operations fail
2. ❌ All React/Vue/Vite build+deploy operations fail
3. ❌ All React Native web deployments fail
4. ❌ Preview mode deployments fail

**Error Message**:
```bash
Command "servermanager:static" is not defined.
```

### What Works

1. ✅ Nuxt deployments (uses `servermanager:nuxt`)
2. ✅ Local development (doesn't use ServerManager)
3. ✅ Manual build processes (doesn't use ServerManager)

## Implementation Priority

**Priority**: 🔥 **P0 - CRITICAL BLOCKER**

**Reasoning**:
1. Blocks all React/Vue/Vite deployments
2. User expects this to work based on the menu system
3. Recent changes to poly_app_manager.sh assume this command exists
4. Without this, debug+deploy fix is incomplete

## Estimated Effort

**Time**: 4-6 hours

**Breakdown**:
1. Create `ServerManagerV1StaticAppCommand.php` (2-3 hours)
   - Implement add/remove/restart/status/list actions
   - Handle --debug vs production logic
   - Validate parameters
2. Create `ServerManagerV1StaticServiceManager.php` (1-2 hours)
   - Systemd service generation for dev servers
   - Package manager detection
   - Service lifecycle management
3. Testing (1 hour)
   - Test debug mode (systemd service creation)
   - Test production mode (static file serving)
   - Test SSL integration
4. Documentation (30 minutes)

## Reference Implementation

Use `ServerManagerV1NuxtAppCommand.php` as the primary reference:
- Lines 16-23: Command signature pattern
- Lines 48-77: Action dispatch pattern
- Lines 90-180: Add action implementation
- Utility class: `ServerManagerV1NuxtServiceManager.php`

## Next Steps

1. **Read the reference implementation**:
   - `ServerManagerV1NuxtAppCommand.php`
   - `ServerManagerV1NuxtServiceManager.php`

2. **Create the new command**:
   - `ServerManagerV1StaticAppCommand.php`
   - `ServerManagerV1StaticServiceManager.php`

3. **Test the implementation**:
   - Test debug mode with matrix_ui_react
   - Test production mode with a built React app
   - Verify nginx configs are correct
   - Verify systemd services start correctly

4. **Update documentation**:
   - Add to `SERVERMANAGER_REFACTORING_GUIDE.md`
   - Update `VALIDATION_SYSTEM.md`

## User Impact

**Before Fix**:
```bash
User: Select debug + deploy_laravel for React app
System: ❌ Command "servermanager:static" is not defined
Result: Deployment fails completely
```

**After Fix**:
```bash
User: Select debug + deploy_laravel for React app
System: ✅ Creating systemd service for dev server...
        ✅ Configuring nginx reverse proxy...
        ✅ Service started successfully at http://localhost:3456
        ✅ Nginx proxy configured
Result: Dev server running persistently as system service
```

---

**Status**: 📝 Documented - Implementation Required
**Assigned**: Pending
**Due Date**: ASAP (blocking user workflow)
