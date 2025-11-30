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
    });
    
    // File Management Routes
    Route::prefix('files')->group(function () {
        Route::get('browse', [ServerManagerV1FileManagerCtl::class, 'browse']);
        Route::get('download', [ServerManagerV1FileManagerCtl::class, 'download']);
        Route::get('info', [ServerManagerV1FileManagerCtl::class, 'getFileInfo']);
        Route::get('preview', [ServerManagerV1FileManagerCtl::class, 'preview']);
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
        Route::post('enable', [ServerManagerV1NginxManagerCtl::class, 'enableSite']);
        Route::post('disable', [ServerManagerV1NginxManagerCtl::class, 'disableSite']);
        Route::post('test', [ServerManagerV1NginxManagerCtl::class, 'testConfig']);
        Route::post('reload', [ServerManagerV1NginxManagerCtl::class, 'reloadNginx']);
    });
    
    // Unified Manager Routes
    Route::prefix('unified')->group(function () {
        Route::get('apps', [ServerManagerV1UnifiedManagerCtl::class, 'listApps']);
        Route::post('deploy', [ServerManagerV1UnifiedManagerCtl::class, 'deployApp']);
        Route::get('status', [ServerManagerV1UnifiedManagerCtl::class, 'getAppStatus']);
        Route::get('logs', [ServerManagerV1UnifiedManagerCtl::class, 'getAppLogs']);
    });
    
    // SSL Certificate Management Routes
    Route::prefix('certificates')->group(function () {
        Route::get('/', [ServerManagerV1CertificateManagerCtl::class, 'listCertificates']);
        Route::post('generate', [ServerManagerV1CertificateManagerCtl::class, 'generateCertificate']);
        Route::post('renew', [ServerManagerV1CertificateManagerCtl::class, 'renewCertificates']);
        Route::get('status', [ServerManagerV1CertificateManagerCtl::class, 'getCertificateStatus']);
        Route::post('install-certbot', [ServerManagerV1CertificateManagerCtl::class, 'installCertbot']);
        Route::get('detect-certbot', [ServerManagerV1CertificateManagerCtl::class, 'detectCertbot']);
    });
    
});
