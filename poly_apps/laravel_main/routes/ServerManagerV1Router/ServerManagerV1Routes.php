<?php

use Illuminate\Support\Facades\Route;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1SystemInfoCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1ApiInfoCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1FileManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1CodeExecutorCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1NginxManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1UnifiedManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1CertificateManagerCtl;

// ServerManagerV1 API Routes
Route::prefix('servermanager/v1')->group(function () {

    // API Information Route
    Route::get('info', [ServerManagerV1ApiInfoCtl::class, 'getApiInfo']);

    // System Information Routes
    Route::prefix('system')->group(function () {
        Route::get('info', [ServerManagerV1SystemInfoCtl::class, 'getSystemInfo']);
        Route::get('processes', [ServerManagerV1SystemInfoCtl::class, 'getProcesses']);
        Route::get('services', [ServerManagerV1SystemInfoCtl::class, 'getServices']);
        Route::get('permissions', [ServerManagerV1SystemInfoCtl::class, 'getPermissions']);
        Route::get('storage', [ServerManagerV1SystemInfoCtl::class, 'getStorage']);
        Route::get('static-resources', [ServerManagerV1SystemInfoCtl::class, 'getStaticResources']);
        Route::get('static-resources/files', [ServerManagerV1SystemInfoCtl::class, 'listStaticResourceFiles']);

        // System Service Management Routes
        Route::prefix('service')->group(function () {
            Route::get('list', [ServerManagerV1UnifiedManagerCtl::class, 'listServices']);
            Route::get('search', [ServerManagerV1UnifiedManagerCtl::class, 'searchServices']);
            Route::get('status', [ServerManagerV1UnifiedManagerCtl::class, 'getServiceStatus']);
            Route::get('start', [ServerManagerV1UnifiedManagerCtl::class, 'startService']);
            Route::get('stop', [ServerManagerV1UnifiedManagerCtl::class, 'stopService']);
            Route::get('restart', [ServerManagerV1UnifiedManagerCtl::class, 'restartService']);
            Route::get('restart-by-keyword', [ServerManagerV1UnifiedManagerCtl::class, 'restartServicesByKeyword']);
            Route::get('restart-by-appname', [ServerManagerV1UnifiedManagerCtl::class, 'restartServiceByAppName']);
        });
    });

    // File Management Routes
    Route::prefix('files')->group(function () {
        Route::get('browse', [ServerManagerV1FileManagerCtl::class, 'browse']);
        Route::get('download', [ServerManagerV1FileManagerCtl::class, 'download']);
        Route::get('info', [ServerManagerV1FileManagerCtl::class, 'getFileInfo']);
        Route::get('preview', [ServerManagerV1FileManagerCtl::class, 'preview']);
        Route::post('write', [ServerManagerV1FileManagerCtl::class, 'write']);
        Route::post('elevated-auth', [ServerManagerV1FileManagerCtl::class, 'elevatedAuth']);
        Route::delete('elevated-auth', [ServerManagerV1FileManagerCtl::class, 'revokeElevatedAuth']);
    });
    
    // Code Execution Routes
    Route::prefix('executor')->group(function () {
        Route::get('scripts', [ServerManagerV1CodeExecutorCtl::class, 'listScripts']);
        Route::post('run', [ServerManagerV1CodeExecutorCtl::class, 'executeScript']);
        Route::get('logs', [ServerManagerV1CodeExecutorCtl::class, 'getLogs']);
        Route::get('status', [ServerManagerV1CodeExecutorCtl::class, 'getStatus']);
    });
    
    // Nginx Management Routes
    Route::prefix('nginx')->group(function () {
        Route::get('sites', [ServerManagerV1NginxManagerCtl::class, 'listSites']);
        Route::post('sites', [ServerManagerV1NginxManagerCtl::class, 'createSite']);
        Route::get('config', [ServerManagerV1NginxManagerCtl::class, 'getSiteConfig']);
        Route::put('sites/{site_name}', [ServerManagerV1NginxManagerCtl::class, 'updateSite']);
        Route::delete('sites/{site_name}', [ServerManagerV1NginxManagerCtl::class, 'deleteSite']);
        // Purge a site's actual web-root files (destructive: root password + "delete" confirm in the body).
        Route::post('sites/{site_name}/delete-files', [ServerManagerV1NginxManagerCtl::class, 'deleteSiteFiles']);
        Route::post('enable', [ServerManagerV1NginxManagerCtl::class, 'enableSite']);
        Route::post('disable', [ServerManagerV1NginxManagerCtl::class, 'disableSite']);
        Route::post('test', [ServerManagerV1NginxManagerCtl::class, 'testConfig']);
        Route::post('reload', [ServerManagerV1NginxManagerCtl::class, 'reloadNginx']);
        // Idempotently repair + reset all nginx config (ensure log/run dirs, quarantine broken site configs, reload).
        Route::post('repair', [ServerManagerV1NginxManagerCtl::class, 'repairConfig']);
        Route::get('status', [ServerManagerV1NginxManagerCtl::class, 'statusOverview']);
        Route::post('service', [ServerManagerV1NginxManagerCtl::class, 'serviceControl']);
        Route::get('logs', [ServerManagerV1NginxManagerCtl::class, 'logs']);
        Route::post('install', [ServerManagerV1NginxManagerCtl::class, 'install']);
        Route::get('backups', [ServerManagerV1NginxManagerCtl::class, 'listBackups']);
        Route::post('backups/restore', [ServerManagerV1NginxManagerCtl::class, 'restoreBackup']);
        Route::get('main-config', [ServerManagerV1NginxManagerCtl::class, 'mainConfig']);
        Route::get('port-check', [ServerManagerV1NginxManagerCtl::class, 'portCheck']);
        Route::get('metrics', [ServerManagerV1NginxManagerCtl::class, 'metrics']);
        Route::post('sites/batch', [ServerManagerV1NginxManagerCtl::class, 'batchSites']);
    });
    
    // Unified Manager Routes
    Route::prefix('unified')->group(function () {
        // App listing and status
        Route::get('apps', [ServerManagerV1UnifiedManagerCtl::class, 'listApps']);
        Route::get('status', [ServerManagerV1UnifiedManagerCtl::class, 'getAppStatus']);
        Route::get('logs', [ServerManagerV1UnifiedManagerCtl::class, 'getAppLogs']);

        // App service management
        Route::post('start', [ServerManagerV1UnifiedManagerCtl::class, 'startApp']);
        Route::post('stop', [ServerManagerV1UnifiedManagerCtl::class, 'stopApp']);
        Route::post('restart', [ServerManagerV1UnifiedManagerCtl::class, 'restartApp']);
        Route::post('deploy', [ServerManagerV1UnifiedManagerCtl::class, 'deployApp']);

        // Octane server management
        Route::post('octane/restart', [ServerManagerV1UnifiedManagerCtl::class, 'restartOctane']);
        Route::post('octane/reload', [ServerManagerV1UnifiedManagerCtl::class, 'reloadOctane']);
    });
    
    // SSL Certificate Management Routes
    Route::prefix('certificates')->group(function () {
        Route::get('/', [ServerManagerV1CertificateManagerCtl::class, 'listCertificates']);
        Route::post('generate', [ServerManagerV1CertificateManagerCtl::class, 'generateCertificate']);
        Route::post('renew', [ServerManagerV1CertificateManagerCtl::class, 'renewCertificates']);
        // Idempotent: generate if missing, renew if present (with 5m cooldown). Async with progress polling.
        Route::post('ensure', [ServerManagerV1CertificateManagerCtl::class, 'ensureCertificate']);
        Route::get('progress/{request_id}', [ServerManagerV1CertificateManagerCtl::class, 'certificateProgress']);
        Route::get('status', [ServerManagerV1CertificateManagerCtl::class, 'getCertificateStatus']);
        Route::post('install-certbot', [ServerManagerV1CertificateManagerCtl::class, 'installCertbot']);
        Route::get('detect-certbot', [ServerManagerV1CertificateManagerCtl::class, 'detectCertbot']);
    });
    
});
