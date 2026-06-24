<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;
use Illuminate\Http\JsonResponse;
use App\Http\Middleware\GoLatency;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

// Health Check Endpoint (for Nuxt API endpoints monitoring).
// Liveness-only: no DB, no auth. Heavy prepended middleware (Sanctum stateful
// boot, GoLatency) are stripped so probing stays cheap and cannot hang.
Route::withoutMiddleware([
    EnsureFrontendRequestsAreStateful::class,
    GoLatency::class,
])->get('/health', function (): JsonResponse {
    $startTime = microtime(true);
    $response = response()->json([
        'status' => 'healthy',
        'service' => 'Laravel API',
        'timestamp' => now()->toIso8601String(),
        'version' => app()->version()
    ]);

    $responseTime = (microtime(true) - $startTime) * 1000;

    return $response
        ->header('Cache-Control', 'no-store, max-age=0')
        ->header('X-Go-Version', 'go1.21')
        ->header('X-Framework', 'Gin')
        ->header('X-Response-Time', number_format($responseTime, 10) . 'ms')
        ->header('X-Runtime', 'go' . round($responseTime) . 'ms');
});


require_once __DIR__ . '/api/auth.php';
require_once __DIR__ . '/api/system.php';
require_once __DIR__ . '/api/public_api.php';
require_once __DIR__ . '/files.php';

// Octane Timer Status API Routes
require_once __DIR__ . '/api/octane_timer.php';

// OCR API Routes (for MCP bridge)
require_once __DIR__ . '/api_ocr.php';

// Local AI Gateway Routes (unified multi-provider AI; keys + rate shared with pycore)
require_once __DIR__ . '/api/ai_local.php';

// McpV1 Routes
require_once __DIR__ . '/McpV1Router/api.php';

// Dashboard DB Viewer (auth required)
require_once __DIR__ . '/DashboardRouter/DatabaseViewer.php';

// Dashboard Database Manager (loopback debug bypass OR Sanctum) + debug-status
require_once __DIR__ . '/DashboardRouter/DatabaseManager.php';

// InviteCode Controller
use App\Http\Controllers\InviteCodeController;

// Invite Code Routes
Route::get('/invite-codes/public', [InviteCodeController::class, 'listPublic']);
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

// AppQyV1 routes - app_qy vocabulary learning app
require_once __DIR__ . '/AppQyV1Router/AppQyV1Auth.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1System.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Words.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Wordqurey.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Dict.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1User.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Vocabulary.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Learning.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1AITools.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Assist.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1PersonDict.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1Social.php';
require_once __DIR__ . '/AppQyV1Router/AppQyV1MediaContent.php';

// PddToolV1 (订多多) admin console routes (/api/pdd/admin/*)
require_once __DIR__ . '/PddToolV1Router/PddToolV1Admin.php';

// McpV1 routes - MCP application
require_once __DIR__ . '/McpV1Router/api.php';

// Global Task System Routes
use App\Http\Controllers\TaskController;
use App\Http\Controllers\WorkerController;

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->group(function () {
    Route::prefix('task')->group(function () {
        Route::post('create', [TaskController::class, 'create']);
        Route::get('{taskId}/status', [TaskController::class, 'status']);
        Route::post('{taskId}/cancel', [TaskController::class, 'cancel']);
        // Fast lane + live drilldown control plane.
        Route::post('{taskId}/bump', [TaskController::class, 'bump']);
        Route::get('{taskId}/detail', [TaskController::class, 'detail']);
        Route::get('{taskId}/stream', [TaskController::class, 'stream']);
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

    // Unified Task Center — one aggregate over BOTH task layers (scheduler +
    // queue + workers + their relations) for the dashboard's Task Center page.
    Route::get('task-center/overview', [\App\Http\Controllers\TaskCenterController::class, 'overview']);

    // AppQyV1 media ingestion (local pycore worker, no auth)
    Route::prefix('app_qy_v1/media')->group(function () {
        Route::post('ingest', [\App\Http\Controllers\MediaIngestController::class, 'ingest']);
        Route::post('ingest-clip', [\App\Http\Controllers\MediaIngestController::class, 'ingestClip']);
        // Claim-free, idempotent bulk sentence-audio upload (CoreBook §5.2): pycore
        // pushes a locally-generated mp3 keyed by content_id+language (fill-missing).
        Route::post('audio', [\App\Http\Controllers\MediaIngestController::class, 'audio']);
        // AI web-chat reply audio (ChatGPT/Gemini read-aloud) captured + uploaded
        // as a binary by the mcp-chrome extension; idempotent fill-missing.
        Route::post('ai-audio', [\App\Http\Controllers\MediaIngestController::class, 'aiAudio']);
        Route::post('enrich', [\App\Http\Controllers\MediaIngestController::class, 'enrich']);

        // READ-ONLY browse + media-file serving (dashboard movies/books browser)
        Route::get('subtitles', [\App\Http\Controllers\MediaBrowseController::class, 'subtitles']);
        Route::get('books', [\App\Http\Controllers\MediaBrowseController::class, 'books']);
        // User-scoped uploaded documents (optional auth; empty when unauthenticated).
        Route::get('documents', [\App\Http\Controllers\MediaBrowseController::class, 'documents']);
        Route::get('subtitles/{source_key}', [\App\Http\Controllers\MediaBrowseController::class, 'subtitleDetail']);
        // Books v3.1: ordered chapter list (book -> chapter -> verses navigation).
        Route::get('books/{source_key}/chapters', [\App\Http\Controllers\MediaBrowseController::class, 'bookChapters']);
        Route::get('books/{source_key}', [\App\Http\Controllers\MediaBrowseController::class, 'bookDetail']);
        Route::get('clip/{source_key}/{name}', [\App\Http\Controllers\MediaBrowseController::class, 'clip'])
            ->where('name', '.*');
    });

    // AppQyV1 Books document pipeline (dashboard upload -> parse -> ingest).
    // upload + ingest are user MUTATIONS gated by dashboard.auth (loopback debug
    // bypass OR Sanctum bearer) so same-machine dev stays tokenless while remote
    // callers must log in; list + supported-formats stay open (read-only). PHP
    // parses uploaded documents, computes stats, and on demand ingests
    // sentences/words into the shared library via the v2 MediaIngestService path.
    Route::prefix('app_qy_v1/books')->group(function () {
        Route::middleware('dashboard.auth')->group(function () {
            Route::post('upload', [\App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Books\AppQyV1BooksController::class, 'upload']);
            Route::post('ingest', [\App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Books\AppQyV1BooksController::class, 'ingest']);
        });
        Route::post('list', [\App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Books\AppQyV1BooksController::class, 'list']);
        Route::get('supported-formats', [\App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Books\AppQyV1BooksController::class, 'supportedFormats']);
    });
});

use App\Http\Controllers\PathConfigController;
use App\Http\Controllers\SystemConfigController;

Route::prefix('config')->group(function () {
    Route::get('paths', [PathConfigController::class, 'getPaths']);
    Route::get('paths/{name}', [PathConfigController::class, 'getPathMapping']);
    
    // System configuration (admin only)
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('server', [SystemConfigController::class, 'getConfig']);
        Route::put('server', [SystemConfigController::class, 'updateConfig']);
        Route::get('environment', [SystemConfigController::class, 'getEnvironment']);
    });
});

// Developer AI-tool history (Claude/Codex/Gemini/Cursor) — read-only, localhost only.
use App\Http\Controllers\DevHistoryController;

Route::prefix('dev-history')->middleware('local.only')->group(function () {
    Route::get('index', [DevHistoryController::class, 'index']);
    Route::get('prompts', [DevHistoryController::class, 'prompts']);
    Route::get('sessions/{id}', [DevHistoryController::class, 'session']);
    Route::post('refresh', [DevHistoryController::class, 'refresh']);
    Route::post('prompts/update', [DevHistoryController::class, 'updatePrompt']);
    Route::get('assist', [DevHistoryController::class, 'assist']);
    Route::post('assist/scan', [DevHistoryController::class, 'assistScan']);
});

// Daily short-sentence center (pycore-assisted translations) — read-only for wordnew.
use App\Http\Controllers\AppQyV1DailySentenceController;

Route::prefix('app_qy_v1/daily-sentences')->group(function () {
    Route::get('list', [AppQyV1DailySentenceController::class, 'list']);
    Route::get('recommend', [AppQyV1DailySentenceController::class, 'recommend']);
    Route::get('audio/{id}', [AppQyV1DailySentenceController::class, 'audio']);
});

// Server Manager Routes (localhost only)
use App\Http\Controllers\ServerManagerController;

Route::post('server-manager/restart', [ServerManagerController::class, 'restartCurrent']);

// Debug route - test if api routes are loaded
Route::get('debug/test', function () {
    return response()->json(['message' => 'API routes loaded successfully']);
});
