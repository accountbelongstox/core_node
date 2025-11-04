<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;

require_once __DIR__ . '/api/auth.php';
require_once __DIR__ . '/api/system.php';

// AwyV0 Routes
require_once __DIR__ . '/AwyV0Router/AwyV0Auth.php';
require_once __DIR__ . '/AwyV0Router/AwyV0User.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Friend.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Device.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Chat.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Search.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Dashboard.php';

// ServerManagerV1 Routes
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1SystemInfoCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1ApiInfoCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1FileManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1CodeExecutorCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1NginxManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1UnifiedManagerCtl;

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
        Route::get('config', [ServerManagerV1NginxManagerCtl::class, 'getSiteConfig']);
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

});

// ItToolsV1 Routes
require_once __DIR__ . '/ItToolsV1Router/api.php';

// CodeMartV1 Routes
require_once __DIR__ . '/CodeMartV1Router/api.php';

// AChatV1 Routes
Route::prefix('achat/v1')->group(function () {
    require_once __DIR__ . '/achat_v1/api_info.php';
});

// VipClubV1 Routes
require_once __DIR__ . '/VipClubV1Router/api.php';

// AppQyV1 routes - app_qy vocabulary learning app
require_once __DIR__ . '/AppQyV1Router/AppQyV1Auth.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Words.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1User.php';
