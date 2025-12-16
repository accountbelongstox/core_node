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
use Illuminate\Http\JsonResponse;

// Health Check Endpoint (for Nuxt API endpoints monitoring)
Route::get('/health', function (): JsonResponse {
    $startTime = microtime(true);
    $response = response()->json([
        'status' => 'healthy',
        'service' => 'Laravel API',
        'timestamp' => now()->toIso8601String(),
        'version' => app()->version()
    ]);

    $responseTime = (microtime(true) - $startTime) * 1000;

    return $response
        ->header('X-Go-Version', 'go1.21')
        ->header('X-Framework', 'Gin')
        ->header('X-Response-Time', number_format($responseTime, 10) . 'ms')
        ->header('X-Runtime', 'go' . round($responseTime) . 'ms');
});

require_once __DIR__ . '/api/auth.php';
require_once __DIR__ . '/api/system.php';
require_once __DIR__ . '/files.php';

// Octane Timer Status API Routes
require_once __DIR__ . '/api/octane_timer.php';

// OCR API Routes (for MCP bridge)
require_once __DIR__ . '/api_ocr.php';

// McpV1 Routes
require_once __DIR__ . '/McpV1Router/api.php';

// AwyV0 Routes
require_once __DIR__ . '/AwyV0Router/AwyV0Auth.php';
require_once __DIR__ . '/AwyV0Router/AwyV0User.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Friend.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Device.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Chat.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Search.php';
require_once __DIR__ . '/AwyV0Router/AwyV0Dashboard.php';

// InviteCode Controller
use App\Http\Controllers\InviteCodeController;

// Invite Code Routes
Route::post('/invite-codes/validate', [InviteCodeController::class, 'validate']);

Route::middleware('auth:sanctum')->prefix('admin')->group(function () {
    Route::get('/invite-codes', [InviteCodeController::class, 'index']);
    Route::post('/invite-codes', [InviteCodeController::class, 'create']);
    Route::post('/invite-codes/{id}/deactivate', [InviteCodeController::class, 'deactivate']);
});

// ServerManagerV1 Routes
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1SystemInfoCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1ApiInfoCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1FileManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1CodeExecutorCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1NginxManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1UnifiedManagerCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1CertificateManagerCtl;

// ServerManagerV1 API Routes
Route::prefix('servermanager/v1')->group(function () {

    // API Information Route (Public)
    Route::get('info', [ServerManagerV1ApiInfoCtl::class, 'getApiInfo']);

    // System Information Routes (Public for basic info, protected for sensitive ops)
    Route::prefix('system')->group(function () {
        Route::get('info', [ServerManagerV1SystemInfoCtl::class, 'getSystemInfo']);

        // Protected system routes
        Route::middleware('auth:sanctum')->group(function () {
            Route::get('processes', [ServerManagerV1SystemInfoCtl::class, 'getProcesses']);
            Route::get('services', [ServerManagerV1SystemInfoCtl::class, 'getServices']);
            Route::get('permissions', [ServerManagerV1SystemInfoCtl::class, 'getPermissions']);
            Route::get('storage', [ServerManagerV1SystemInfoCtl::class, 'getStorage']);
        });
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
require_once __DIR__ . '/AppQyV1Router/AppQyV1System.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Words.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Wordqurey.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1User.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Vocabulary.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Learning.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1AITools.php';

// McpV1 routes - MCP application
require_once __DIR__ . '/McpV1Router/api.php';

// Global Task System Routes
use App\Http\Controllers\TaskController;
use App\Http\Controllers\WorkerController;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->group(function () {
    Route::prefix('task')->group(function () {
        Route::post('create', [TaskController::class, 'create']);
        Route::get('{taskId}/status', [TaskController::class, 'status']);
        Route::get('list', [TaskController::class, 'list']);
        Route::get('stats', [TaskController::class, 'stats']);
        Route::post('clean-invalid', [TaskController::class, 'cleanInvalid']);
        Route::post('reset-assigned', [TaskController::class, 'resetAssigned']);
    });

    Route::prefix('worker')->group(function () {
        Route::post('register', [WorkerController::class, 'register']);
        Route::post('heartbeat', [WorkerController::class, 'heartbeat']);
        Route::get('tasks/pull', [WorkerController::class, 'pullTasks']);
        Route::post('tasks/accept', [WorkerController::class, 'acceptTask']);
        Route::post('tasks/result', [WorkerController::class, 'submitResult']);
        Route::get('list', [WorkerController::class, 'list']);
        Route::get('stats', [WorkerController::class, 'stats']);
    });
});

use App\Http\Controllers\PathConfigController;

Route::prefix('config')->group(function () {
    Route::get('paths', [PathConfigController::class, 'getPaths']);
    Route::get('paths/{name}', [PathConfigController::class, 'getPathMapping']);
});

// Debug route - test if api routes are loaded
Route::get('debug/test', function () {
    return response()->json(['message' => 'API routes loaded successfully']);
});
