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
use App\Http\EnvironmentApiInfo\DebugIndex;
use App\Http\EnvironmentApiInfo\ApiInfoIndex;
use App\Http\EnvironmentApiInfo\ApiParamsCache;
use App\Http\EnvironmentApiInfo\ClipboardController;
use App\Http\EnvironmentApiInfo\CodeBrowserController;
use App\Http\EnvironmentApiInfo\CodeBrowserFileOpsController;
use App\Http\EnvironmentApiInfo\StaticResourceController;
use App\Http\EnvironmentApiInfo\ChunkedUploadController;
use App\Http\EnvironmentApiInfo\OctaneTaskController;
use App\Http\Controllers\TranslationController;
use App\Http\Controllers\TTSController;
use App\Http\Controllers\AppInitializationController;
use App\Http\Controllers\StartupMonitorController;


/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

// Root route displays a complete HTML debugging interface (MUST be first to avoid conflicts)
Route::get('/', [DebugIndex::class, 'index']);

// This route is the single web entry point for debugging and must not be modified.
// It points to the ApiInfoIndex class which is responsible for gathering all information.
Route::get('/api_info', [ApiInfoIndex::class, 'index']);

// API parameters cache routes
Route::post('/api_params_cache/save', [ApiParamsCache::class, 'save']);
Route::get('/api_params_cache/load', [ApiParamsCache::class, 'load']);
Route::get('/api_params_cache/list', [ApiParamsCache::class, 'listByApp']);

// Debug assets serving routes
Route::get('/debug-assets/css/{file}', function ($file) {
    $path = public_path('debug-assets/css/' . $file);
    if (file_exists($path)) {
        return response()->file($path, ['Content-Type' => 'text/css']);
    }
    abort(404);
});

Route::get('/debug-assets/js/{file}', function ($file) {
    $path = public_path('debug-assets/js/' . $file);
    if (file_exists($path)) {
        return response()->file($path, [
            'Content-Type' => 'application/javascript',
            'Cache-Control' => 'no-cache, no-store, must-revalidate'
        ]);
    }
    abort(404);
});

// Debug tools HTML files serving routes
Route::get('/debug-assets/debug-tools/{path}', function ($path) {
    $filePath = public_path('debug-assets/debug-tools/' . $path);
    if (file_exists($filePath) && is_file($filePath)) {
        $extension = pathinfo($filePath, PATHINFO_EXTENSION);
        $contentType = match($extension) {
            'html' => 'text/html',
            'css' => 'text/css',
            'js' => 'application/javascript',
            default => 'text/plain'
        };
        return response()->file($filePath, ['Content-Type' => $contentType]);
    }
    abort(404);
})->where('path', '.*');

// Online Clipboard routes
Route::get('/clipboard/namespace', [ClipboardController::class, 'getOrCreateNamespace']);
Route::post('/clipboard/text', [ClipboardController::class, 'saveText']);
Route::get('/clipboard/data', [ClipboardController::class, 'getData']);
Route::post('/clipboard/upload', [ClipboardController::class, 'uploadFiles']);
Route::get('/clipboard/download', [ClipboardController::class, 'downloadFile']);
Route::post('/clipboard/delete-file', [ClipboardController::class, 'deleteFile']);
Route::post('/clipboard/new', [ClipboardController::class, 'createNew']);
Route::post('/clipboard/restore', [ClipboardController::class, 'restoreHistory']);

// Translation API routes
Route::post('/translation/translate', [TranslationController::class, 'translate']);
Route::post('/translation/batch', [TranslationController::class, 'batchTranslate']);
Route::post('/translation/detect', [TranslationController::class, 'detectAndTranslate']);
Route::post('/translation/learning', [TranslationController::class, 'translateForLearning']);
Route::post('/translation/simple/google', [TranslationController::class, 'simpleTranslateWithGoogle']);
Route::get('/translation/languages', [TranslationController::class, 'getLanguages']);
Route::get('/translation/types', [TranslationController::class, 'getTypes']);
Route::get('/translation/templates', [TranslationController::class, 'getLanguageTemplates']);
Route::get('/translation/models', [TranslationController::class, 'getModels']);
Route::get('/translation/task/{taskId}', [TranslationController::class, 'getTaskStatus']);
Route::post('/translation/process-next', [TranslationController::class, 'processNextTask']);

// TTS API routes
Route::post('/tts/generate', [TTSController::class, 'generate']);
Route::post('/tts/batch-generate', [TTSController::class, 'batchGenerate']);
Route::post('/tts/check', [TTSController::class, 'checkGeneration']);
Route::post('/tts/batch-check', [TTSController::class, 'batchCheck']);
Route::get('/tts/audio/{language}/{type}/{speed}/{filename}', [TTSController::class, 'serveAudioWithSpeed']);
Route::get('/tts/audio/{language}/{type}/{filename}', [TTSController::class, 'serveAudio']);
Route::get('/tts/sentence/{language}/{md5}', [TTSController::class, 'serveSentenceByMd5']);
Route::get('/tts/voices', [TTSController::class, 'getVoices']);
Route::get('/tts/cache/stats', [TTSController::class, 'getCacheStats']);
Route::post('/tts/cache/clear', [TTSController::class, 'clearCache']);

Route::prefix('system/init')->group(function () {
    Route::get('/status', [AppInitializationController::class, 'status']);
    Route::get('/apps', [AppInitializationController::class, 'listApps']);
    Route::post('/all', [AppInitializationController::class, 'initializeAll']);
    Route::post('/{appName}', [AppInitializationController::class, 'initialize']);
    Route::post('/{appName}/reset', [AppInitializationController::class, 'reset']);
});

Route::get('/csrf-token', function () {
    return response()->json(['csrf_token' => csrf_token()]);
});

Route::prefix('code-browser')->group(function () {
    Route::get('/auth-check', [CodeBrowserController::class, 'checkAuth']);
    Route::get('/file-tree', [CodeBrowserController::class, 'getFileTree']);
    Route::get('/read-file', [CodeBrowserController::class, 'readFile']);
    Route::post('/save-file', [CodeBrowserController::class, 'saveFile']);
    Route::post('/delete-file', [CodeBrowserFileOpsController::class, 'deleteFile']);
    Route::post('/restore-file', [CodeBrowserFileOpsController::class, 'restoreFile']);
    Route::post('/rename-item', [CodeBrowserFileOpsController::class, 'renameItem']);
    Route::post('/auto-rename-to-english', [CodeBrowserFileOpsController::class, 'autoRenameToEnglish']);
    Route::post('/clean-broken-symlinks', [CodeBrowserFileOpsController::class, 'cleanBrokenSymlinks']);
    Route::get('/prompts', [CodeBrowserFileOpsController::class, 'getPrompts']);

    Route::post('/prompts/create', function (\Illuminate\Http\Request $request) {
        \Log::info('[PROMPT_CREATE] Route hit', ['timestamp' => date('Y-m-d H:i:s'), 'input' => $request->all()]);

        // Check authentication
        $userToken = $request->header('Auth-User-Token');
        $authToken = $request->bearerToken();
        if (!($userToken || $authToken || \Illuminate\Support\Facades\Auth::check())) {
            \Log::warning('[PROMPT_CREATE] Unauthorized access attempt');
            return response()->json([
                'error' => 'Please login to create tasks',
                'authenticated' => false
            ], 401);
        }

        $name = $request->input('name');
        if (!$name) {
            \Log::error('[PROMPT_CREATE] Name is required');
            return response()->json(['error' => 'Name is required'], 400);
        }

        $processedName = trim($name);
        $processedName = preg_replace('/\s+/', ' ', $processedName);

        if (strpos($processedName, ' ') !== false) {
            $words = explode(' ', $processedName);
            $words = array_map(function($word) {
                return ucfirst(strtolower($word));
            }, $words);
            $processedName = implode(' ', $words);
        } else {
            $processedName = ucfirst(strtolower($processedName));
        }

        if (!preg_match('/\.md$/i', $processedName)) {
            $processedName .= '.md';
        }

        if (preg_match('/[<>:"|?*\x00-\x1F]/', $processedName)) {
            \Log::error('[PROMPT_CREATE] Invalid characters in filename');
            return response()->json(['error' => 'Filename contains invalid characters'], 400);
        }

        \Log::info('[PROMPT_CREATE] Processed name', ['name' => $processedName]);

        $coreNodeDir = \App\Providers\PathMapper::getCoreNodeDir();
        $promptsDir = $coreNodeDir . DIRECTORY_SEPARATOR . '_prompts';
        $filePath = $promptsDir . DIRECTORY_SEPARATOR . $processedName;

        \Log::info('[PROMPT_CREATE] File path', ['path' => $filePath]);

        if (file_exists($filePath)) {
            \Log::warning('[PROMPT_CREATE] File already exists', ['path' => $filePath]);
            return response()->json(['error' => 'Prompt already exists'], 409);
        }

        \Log::info('[PROMPT_CREATE] Writing file via FileSystemManager');

        $result = \App\Utils\FileSystemManager::writeFile($filePath, '');

        \Log::info('[PROMPT_CREATE] Write result', ['success' => $result]);

        if ($result) {
            return response()->json([
                'success' => true,
                'message' => 'Prompt created successfully',
                'path' => '_prompts' . DIRECTORY_SEPARATOR . $processedName,
                'name' => $processedName
            ], 200);
        } else {
            \Log::error('[PROMPT_CREATE] Write failed');
            return response()->json(['error' => 'Failed to create prompt'], 500);
        }
    });

    Route::post('/prompts/translate', [CodeBrowserFileOpsController::class, 'translatePrompt']);
    Route::post('/prompts/translate-name', [CodeBrowserFileOpsController::class, 'translatePromptName']);
    Route::post('/prompts/translate-line', [CodeBrowserFileOpsController::class, 'translateSingleLine']);
});

// McpV1 Task Dispatch System (MCP + Web API)
// Following Laravel 12.x MCP specifications
// @see https://laravel.com/docs/12.x/mcp
Route::prefix('api/mcp/v1/task-dispatch')->group(function () {
    // Task Categories
    Route::get('/categories', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'getCategories']);
    Route::get('/categories/{categoryId}/files', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'getCategoryFiles']);
    Route::post('/categories', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'createCategory']);

    // Task Queue
    Route::post('/queue/add-file', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'addFileToQueue']);
    Route::get('/queue/{categoryId}/tasks', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'getTasks']);
    Route::get('/queue/{categoryId}/last-task', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'getLastTask']);
    Route::get('/queue/{categoryId}/has-latest', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'hasLatestTask']);
    Route::get('/queue/{categoryId}/search', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'searchTasks']);
    Route::put('/queue/{categoryId}/tasks/{taskId}/status', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'updateTaskStatus']);
    Route::get('/queue/{categoryId}/stats', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'getQueueStats']);

    // Prompt Mappings
    Route::get('/mappings', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'getAllMappings']);
    Route::get('/mappings/{categoryId}', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'getCategoryMapping']);
    Route::put('/mappings/{categoryId}', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'updateCategoryMapping']);
    Route::post('/mappings/{categoryId}/reset', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'resetCategoryMapping']);
    Route::delete('/mappings/{categoryId}', [\App\Apps\McpV1\McpV1Controllers\McpV1TaskDispatchCtl::class, 'deleteCategoryMapping']);
});

// McpV1 Screenshot Management System (MCP + Web API)
// Following Laravel 12.x MCP specifications
// @see https://laravel.com/docs/12.x/mcp
Route::prefix('api/mcp/v1/screenshots')->group(function () {
    Route::post('/upload', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'upload']);
    Route::post('/upload-merge', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'uploadAndMerge']);
    Route::post('/upload-batch', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'uploadBatch']);
    Route::get('/latest', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'getLatest']);
    Route::get('/search', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'search']);
    Route::get('/stats', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'getStats']);
    Route::get('/', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'getAll']);
    // Support URLs with image extension for AI recognition: /screenshots/{id}.jpg, /screenshots/{id}.png, etc.
    Route::get('/{id}.{ext}', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'streamFileWithExt'])->where('ext', 'jpg|jpeg|png|gif|webp|bmp');
    Route::get('/{id}', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'getById'])->where('id', '[A-Za-z0-9_\-]+');
    Route::get('/{id}/file', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'streamFile'])->where('id', '[A-Za-z0-9_\-]+');
    Route::delete('/{id}', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'delete']);
    Route::delete('/clear-all/confirm', [\App\Apps\McpV1\McpV1Controllers\McpV1ScreenshotCtl::class, 'clearAll']);
});

// McpV1 Placeholder Image Generator (MCP + Web API)
// Generate placeholder images with customizable text and real/simple modes
Route::prefix('api/mcp/v1/placeholders')->group(function () {
    Route::post('/generate', [\App\Apps\McpV1\McpV1Controllers\McpV1PlaceholderCtl::class, 'generate']);
    Route::get('/', [\App\Apps\McpV1\McpV1Controllers\McpV1PlaceholderCtl::class, 'list']);
    Route::get('/stats', [\App\Apps\McpV1\McpV1Controllers\McpV1PlaceholderCtl::class, 'stats']);
    Route::post('/cleanup', [\App\Apps\McpV1\McpV1Controllers\McpV1PlaceholderCtl::class, 'cleanup']);
    Route::get('/{uuid}/download', [\App\Apps\McpV1\McpV1Controllers\McpV1PlaceholderCtl::class, 'download']);
    Route::delete('/{uuid}', [\App\Apps\McpV1\McpV1Controllers\McpV1PlaceholderCtl::class, 'delete']);
});

Route::prefix('static-resources')->group(function () {
    Route::get('/file-tree', [StaticResourceController::class, 'getFileTree']);
    Route::get('/read-file', [StaticResourceController::class, 'readFile']);
    Route::get('/stream-file', [StaticResourceController::class, 'streamFile']);
    Route::post('/upload', [StaticResourceController::class, 'uploadFiles']);
    Route::post('/rename', [StaticResourceController::class, 'renameItem']);
    Route::post('/create-directory', [StaticResourceController::class, 'createDirectory']);
    Route::post('/delete-preview', [StaticResourceController::class, 'previewDelete']);
    Route::post('/delete', [StaticResourceController::class, 'deleteItem']);

    Route::post('/chunked-upload/init', [ChunkedUploadController::class, 'initUpload']);
    Route::post('/chunked-upload/chunk', [ChunkedUploadController::class, 'uploadChunk']);
    Route::post('/chunked-upload/check', [ChunkedUploadController::class, 'checkProgress']);
    Route::post('/chunked-upload/merge', [ChunkedUploadController::class, 'mergeChunks']);
    Route::post('/chunked-upload/cancel', [ChunkedUploadController::class, 'cancelUpload']);
});

Route::prefix('startup-monitor')->group(function () {
    Route::get('/logs', [StartupMonitorController::class, 'getLogs']);
    Route::get('/view', [StartupMonitorController::class, 'viewLogs']);
    Route::get('/health', [StartupMonitorController::class, 'healthCheck']);
});

Route::prefix('octane-tasks')->group(function () {
    Route::get('/status', [OctaneTaskController::class, 'getAllStatus']);
    Route::get('/task/{taskName}', [OctaneTaskController::class, 'getTaskDetail']);
    Route::get('/basic', [OctaneTaskController::class, 'getBasicObjects']);
    Route::get('/verify', [OctaneTaskController::class, 'verifyInitialization']);
});
