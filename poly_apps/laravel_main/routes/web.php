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
        return response()->file($path, [
            'Content-Type' => 'application/javascript',
            'Cache-Control' => 'no-cache, no-store, must-revalidate'
        ]);
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

Route::get('/learning', function () {
    return response()->file(public_path('learning.html'));
});

Route::get('/learning/demo', function () {
    return response()->file(public_path('learning-demo.html'));
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
    Route::get('/prompts', [CodeBrowserFileOpsController::class, 'getPrompts']);

    Route::post('/prompts/create', function (\Illuminate\Http\Request $request) {
        $debugInfo = [];
        $debugInfo['route_hit'] = true;
        $debugInfo['timestamp'] = date('Y-m-d H:i:s');
        $debugInfo['request_all'] = $request->all();
        $debugInfo['request_name'] = $request->input('name');

        $debugInfo['php_user'] = posix_getpwuid(posix_geteuid())['name'];
        $debugInfo['php_uid'] = posix_geteuid();
        $debugInfo['php_gid'] = posix_getegid();
        $debugInfo['process_user'] = get_current_user();

        $coreNodeDir = \App\Providers\PathMapper::getCoreNodeDir();
        $debugInfo['core_node_dir'] = $coreNodeDir;
        $debugInfo['core_node_exists'] = is_dir($coreNodeDir);

        $promptsDir = $coreNodeDir . DIRECTORY_SEPARATOR . '_prompts';
        $debugInfo['prompts_dir'] = $promptsDir;
        $debugInfo['prompts_dir_exists'] = is_dir($promptsDir);
        $debugInfo['prompts_dir_writable'] = is_writable($promptsDir);

        $promptsDirStat = stat($promptsDir);
        $debugInfo['prompts_dir_owner_uid'] = $promptsDirStat['uid'];
        $debugInfo['prompts_dir_owner_gid'] = $promptsDirStat['gid'];
        $debugInfo['prompts_dir_perms'] = substr(sprintf('%o', fileperms($promptsDir)), -4);

        $name = $request->input('name');
        if (!$name) {
            $debugInfo['error'] = 'Name is required';
            return response()->json($debugInfo, 400);
        }

        $processedName = trim($name);
        $processedName = preg_replace('/\s+/', ' ', $processedName);
        $words = explode(' ', $processedName);
        $words = array_map(function($word) {
            return ucfirst(strtolower($word));
        }, $words);
        $processedName = implode(' ', $words);

        if (!preg_match('/\.md$/i', $processedName)) {
            $processedName .= '.md';
        }

        $debugInfo['processed_name'] = $processedName;

        \App\Utils\FileSystemManager::ensureDirectoryExists($promptsDir);

        $filePath = $promptsDir . DIRECTORY_SEPARATOR . $processedName;
        $debugInfo['file_path'] = $filePath;
        $debugInfo['file_exists_before'] = file_exists($filePath);

        if (file_exists($filePath)) {
            $debugInfo['error'] = 'Prompt already exists';
            return response()->json($debugInfo, 409);
        }

        clearstatcache(true, $filePath);
        clearstatcache(true, $promptsDir);

        $handle = @fopen($filePath, 'w');
        $debugInfo['fopen_result'] = ($handle !== false);
        if ($handle !== false) {
            @fwrite($handle, '');
            @fclose($handle);
        }
        $debugInfo['fopen_exists_after'] = file_exists($filePath);

        $writeResult = @file_put_contents($filePath, '', LOCK_EX);
        $debugInfo['write_result'] = $writeResult;
        $debugInfo['write_result_type'] = gettype($writeResult);
        $debugInfo['file_exists_after'] = file_exists($filePath);
        $debugInfo['last_error'] = error_get_last();

        exec('whoami', $whoamiOutput);
        $debugInfo['exec_whoami'] = implode('', $whoamiOutput);

        $debugInfo['disable_functions'] = ini_get('disable_functions');
        $debugInfo['open_basedir'] = ini_get('open_basedir');

        if (file_exists($filePath)) {
            $debugInfo['success'] = true;
            $debugInfo['message'] = 'Prompt created successfully (via fopen)';
            $debugInfo['path'] = '_prompts' . DIRECTORY_SEPARATOR . $processedName;
            $debugInfo['name'] = $processedName;
            return response()->json($debugInfo, 200);
        }

        if ($writeResult === false && !file_exists($filePath)) {
            $debugInfo['error'] = 'Failed to write file';
            $debugInfo['parent_dir'] = dirname($filePath);
            $debugInfo['parent_exists'] = is_dir(dirname($filePath));
            $debugInfo['parent_writable'] = is_writable(dirname($filePath));

            $testPath = $promptsDir . DIRECTORY_SEPARATOR . 'debug_test_' . time() . '.txt';
            $testResult = @file_put_contents($testPath, 'test content');
            $debugInfo['test_ascii_write'] = $testResult;
            $debugInfo['test_ascii_path'] = $testPath;
            $debugInfo['test_ascii_exists'] = file_exists($testPath);

            @chmod($promptsDir, 0777);
            $debugInfo['after_chmod_writable'] = is_writable($promptsDir);

            $testPath2 = $promptsDir . DIRECTORY_SEPARATOR . 'debug_test2_' . time() . '.txt';
            $testResult2 = @file_put_contents($testPath2, 'test after chmod');
            $debugInfo['test_after_chmod'] = $testResult2;

            try {
                \Illuminate\Support\Facades\Storage::disk('local')->put('test_storage.txt', 'test via Storage');
                $debugInfo['storage_test'] = 'success';
                $debugInfo['storage_path'] = storage_path('app/test_storage.txt');
            } catch (\Exception $e) {
                $debugInfo['storage_test'] = 'failed: ' . $e->getMessage();
            }

            $execTestPath = $promptsDir . DIRECTORY_SEPARATOR . 'exec_test_' . time() . '.txt';
            $execCmd = sprintf('touch %s 2>&1', escapeshellarg($execTestPath));
            $execOutput = [];
            $execReturnVar = 0;
            @exec($execCmd, $execOutput, $execReturnVar);
            $debugInfo['exec_test_cmd'] = $execCmd;
            $debugInfo['exec_test_return'] = $execReturnVar;
            $debugInfo['exec_test_output'] = implode("\n", $execOutput);
            $debugInfo['exec_test_exists'] = file_exists($execTestPath);

            $shellCmd = sprintf('/bin/bash -c "echo test > %s" 2>&1', escapeshellarg($execTestPath . '.sh'));
            $shellOutput = shell_exec($shellCmd);
            $debugInfo['shell_cmd'] = $shellCmd;
            $debugInfo['shell_output'] = $shellOutput;
            $debugInfo['shell_exists'] = file_exists($execTestPath . '.sh');

            $procOpen = proc_open(
                sprintf('touch %s', escapeshellarg($execTestPath . '.proc')),
                [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
                $pipes
            );
            if (is_resource($procOpen)) {
                $procOutput = stream_get_contents($pipes[1]);
                $procError = stream_get_contents($pipes[2]);
                $procReturn = proc_close($procOpen);
                $debugInfo['proc_return'] = $procReturn;
                $debugInfo['proc_output'] = $procOutput;
                $debugInfo['proc_error'] = $procError;
                $debugInfo['proc_exists'] = file_exists($execTestPath . '.proc');
            }

            return response()->json($debugInfo, 500);
        }

        $debugInfo['success'] = true;
        $debugInfo['message'] = 'Prompt created successfully';
        $debugInfo['path'] = '_prompts' . DIRECTORY_SEPARATOR . $processedName;
        $debugInfo['name'] = $processedName;

        return response()->json($debugInfo, 200);
    });

    Route::post('/prompts/translate', [CodeBrowserFileOpsController::class, 'translatePrompt']);
    Route::post('/prompts/translate-name', [CodeBrowserFileOpsController::class, 'translatePromptName']);
});
