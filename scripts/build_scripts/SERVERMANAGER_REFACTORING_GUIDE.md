# Servermanager Refactoring Guide

## Overview
This guide documents the changes needed to make Servermanager comply with the architecture rule:
**"Servermanager只负责nginx反代和systemd服务创建"**

## Current Status

### ✅ Shell Script (poly_app_manager.sh)
**Status: COMPLETED - Fully refactored**

Shell now handles:
- Building projects (pnpm/npm build)
- Preparing deployment directories
- Copying build outputs
- Setting permissions
- Passing prepared paths to Servermanager via `--build-path`

### ⚠️ Servermanager (ServerManagerV1NuxtAppCommand.php)
**Status: NEEDS REFACTORING**

## Required Changes to Servermanager

### 1. Add `--build-path` Option

```php
protected $signature = 'servermanager:nuxt
                        {action : Action to perform (add|remove|rebuild|restart|status|list|fix|watch)}
                        {appname? : Nuxt app namespace (e.g., ittools, pymatrix)}
                        {--domain= : Domain name for nginx proxy}
                        {--port= : Port number (default: auto-assign)}
                        {--ssl= : SSL mode (auto|true|false, default: auto)}
                        {--build-path= : Path to prepared build directory}  // ← ADD THIS
                        {--debug : Enable debug mode (runs from source instead of factory build)}';
```

### 2. Remove Build-Related Operations

**Operations to REMOVE:**

#### Line 133: Remove factory cleanup
```php
// BEFORE - REMOVE THIS:
if (is_dir($factoryPath)) {
    $this->comment("Removing old factory directory...");
    Process::run("rm -rf $factoryPath");
}

// AFTER - Remove entirely, Shell handles this
```

#### Line 302-309: Remove package manager detection
```php
// BEFORE - REMOVE THIS:
private function detectPackageManager(): string
{
    $checkPnpm = Process::run('which pnpm');
    if ($checkPnpm->successful()) {
        return 'pnpm';
    }
    // ...
}

// AFTER - Remove entirely, not needed
```

#### Line 425: Remove cache cleanup
```php
// BEFORE - REMOVE THIS:
$result = Process::run("rm -rf " . escapeshellarg($path));

// AFTER - Remove entirely, Shell handles this
```

#### Line 458: Remove directory creation
```php
// BEFORE - REMOVE THIS:
Process::run("mkdir -p $cacheDir");

// AFTER - Remove entirely, Shell handles this
```

#### Line 554: Remove symlink creation
```php
// BEFORE - REMOVE THIS:
$symlinkResult = Process::run($symlinkCmd);

// AFTER - Remove entirely, Shell handles this
```

#### Line 571: Remove compile cache cleanup
```php
// BEFORE - REMOVE THIS:
$cleanResult = Process::run("rm -rf $compileCache");

// AFTER - Remove entirely, Shell handles this
```

#### Line 749/783: Remove factory cleanup (multiple locations)
```php
// BEFORE - REMOVE THIS:
Process::run("rm -rf $factoryPath");

// AFTER - Remove entirely, Shell handles this
```

### 3. Use `--build-path` Parameter

**Modify `addPolyApp` method:**

```php
private function addPolyApp(?string $appname): int
{
    // ... existing validation ...

    // Get build path from option or use default
    $buildPath = $this->option('build-path');

    if (!$buildPath) {
        if ($this->debugMode) {
            // Debug mode: use source directory
            $buildPath = "$this->nuxtMainPath/apps/app_$appname";
        } else {
            // Production: expect Shell to provide build path
            $this->error("Error: --build-path is required for production deployment");
            $this->info("Shell script should prepare build and pass --build-path");
            return 1;
        }
    }

    // Validate build path exists
    if (!is_dir($buildPath)) {
        $this->error("Build path does not exist: $buildPath");
        return 1;
    }

    $this->info("Using build path: $buildPath");

    // Continue with service creation...
    $this->createService($appname, $port, $buildPath);  // Pass buildPath
    $this->configureNginx($appname, $domain, $port, $sslMode);
    $this->startService($appname);

    return 0;
}
```

### 4. Update Service Creation

**Modify `createService` to use provided path:**

```php
private function createService(string $appname, int $port, string $buildPath): bool
{
    $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);

    $serviceContent = <<<SERVICE
[Unit]
Description=Nuxt PolyApp - $appname
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$buildPath
ExecStart=/usr/bin/node $buildPath/.output/server/index.mjs
Environment="NUXT_HOST=0.0.0.0"
Environment="NUXT_PORT=$port"
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE;

    $serviceFile = "/etc/systemd/system/$serviceName.service";
    file_put_contents($serviceFile, $serviceContent);

    Process::run('systemctl daemon-reload');

    $this->comment("✓ Service created: $serviceName");
    return true;
}
```

### 5. Keep Only nginx and systemd Operations

**Operations to KEEP:**

```php
// ✅ KEEP: nginx configuration
private function configureNginx(string $appname, string $domain, int $port, string $sslMode): bool
{
    // Create nginx config file
    // Test nginx config
    // Reload nginx
}

// ✅ KEEP: service management
private function startService(string $appname): bool
{
    Process::run('systemctl start ' . $serviceName);
    Process::run('systemctl enable ' . $serviceName);
}

private function stopService(string $appname): bool
{
    Process::run('systemctl stop ' . $serviceName);
}

private function restartService(string $appname): bool
{
    Process::run('systemctl restart ' . $serviceName);
}

// ✅ KEEP: nginx operations
Process::run("$nginxBinary -t");  // Test config
Process::run('systemctl reload nginx');  // Reload nginx
```

## New Architecture Flow

```
┌─────────────────────────────────────────┐
│ User selects project via Python menu    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Shell Script (poly_app_manager.sh)      │
│ ┌─────────────────────────────────────┐ │
│ │ 1. Build project (pnpm build)        │ │
│ │ 2. Prepare deployment directory      │ │
│ │ 3. Copy build outputs                │ │
│ │ 4. Set permissions                   │ │
│ │ 5. Get BUILD_PATH                    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Call Servermanager with prepared path   │
│                                          │
│ php artisan servermanager:nuxt add \    │
│   $APP_NAME \                            │
│   --port=$PORT \                         │
│   --build-path=$BUILD_PATH               │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Servermanager (ServerManagerV1)         │
│ ┌─────────────────────────────────────┐ │
│ │ 1. Validate build-path exists        │ │
│ │ 2. Create nginx config               │ │
│ │ 3. Test nginx config                 │ │
│ │ 4. Reload nginx                      │ │
│ │ 5. Create systemd service            │ │
│ │ 6. Start service                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Testing

### Before refactoring:
```bash
# Old way - Servermanager does everything
php artisan servermanager:nuxt add ittools --port=10000
```

### After refactoring:
```bash
# New way - Shell prepares, Servermanager deploys
./scripts/build_scripts/poly_app_manager.sh
# Select project → Build → Deploy
# Shell will:
#   1. Build
#   2. Prepare at /www/_build_dir/nuxt_factory/linux/_app_ittools
#   3. Call: php artisan servermanager:nuxt add ittools --port=10000 --build-path=/www/_build_dir/nuxt_factory/linux/_app_ittools
```

## Benefits

1. **Clear separation of concerns**
   - Shell: Build and prepare
   - Servermanager: Deploy and manage

2. **Easier testing**
   - Can test build preparation separately
   - Can test service management separately

3. **Better error handling**
   - Build errors happen in Shell
   - Service errors happen in Servermanager

4. **More flexible**
   - Can prepare build anywhere
   - Can use different build strategies
   - Servermanager doesn't care about build process

## Summary

- ✅ Shell script: COMPLETED
- ⚠️ Servermanager: Needs refactoring as documented above
- 📝 Main changes: Add --build-path option, remove build operations
- 🎯 Goal: Servermanager only manages nginx + systemd
