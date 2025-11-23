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
use App\Http\Controllers\TranslationController;
use App\Http\Controllers\TTSController;
use App\Http\Controllers\AppInitializationController;

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

// This route is the single web entry point for debugging and must not be modified.
// It points to the ApiInfoIndex class which is responsible for gathering all information.
Route::get('/api_info', [ApiInfoIndex::class, 'index']);

// Root route displays a complete HTML debugging interface
Route::get('/', [DebugIndex::class, 'index']);

// API parameters cache routes
Route::post('/api_params_cache/save', [ApiParamsCache::class, 'save']);
Route::get('/api_params_cache/load', [ApiParamsCache::class, 'load']);
Route::get('/api_params_cache/list', [ApiParamsCache::class, 'listByApp']);

// Debug assets serving routes
Route::get('/debug-assets/css/{file}', function ($file) {
    $path = __DIR__ . '/../app/Http/EnvironmentApiInfo/assets/css/' . $file;
    if (file_exists($path)) {
        return response()->file($path, ['Content-Type' => 'text/css']);
    }
    abort(404);
});

Route::get('/debug-assets/js/{file}', function ($file) {
    $path = __DIR__ . '/../app/Http/EnvironmentApiInfo/assets/js/' . $file;
    if (file_exists($path)) {
        return response()->file($path, ['Content-Type' => 'application/javascript']);
    }
    abort(404);
});

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
