<?php

use Illuminate\Support\Facades\Route;
use App\Apps\McpV1\McpV1Controllers\McpV1OCRCtl;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Controllers\VoiceSubtitleV1MainController;

Route::prefix('mcp/v1')->group(function () {
    Route::prefix('ocr')->group(function () {
        Route::post('/recognize', [McpV1OCRCtl::class, 'recognize']);
        Route::post('/smart-recognize', [McpV1OCRCtl::class, 'smartRecognize']);
        Route::post('/batch', [McpV1OCRCtl::class, 'batch']);
        Route::get('/engines', [McpV1OCRCtl::class, 'getEngines']);
        Route::get('/engine-info', [McpV1OCRCtl::class, 'getEngineInfo']);
    });

    Route::prefix('voice-subtitle')->group(function () {
        Route::post('/add', [VoiceSubtitleV1MainController::class, 'addToQueue']);
        Route::get('/queue', [VoiceSubtitleV1MainController::class, 'getQueue']);
        Route::get('/current', [VoiceSubtitleV1MainController::class, 'getCurrent']);
        Route::post('/next', [VoiceSubtitleV1MainController::class, 'next']);
        Route::post('/previous', [VoiceSubtitleV1MainController::class, 'previous']);
        Route::post('/set-index', [VoiceSubtitleV1MainController::class, 'setIndex']);
        Route::delete('/remove', [VoiceSubtitleV1MainController::class, 'removeItem']);
        Route::delete('/clear', [VoiceSubtitleV1MainController::class, 'clearQueue']);
        Route::get('/stats', [VoiceSubtitleV1MainController::class, 'getStats']);
        Route::get('/audio/{filename}', [VoiceSubtitleV1MainController::class, 'serveAudio'])->name('mcp.v1.voice-subtitle.audio');

        Route::post('/update-group', [VoiceSubtitleV1MainController::class, 'updateItemGroup']);
        Route::get('/groups', [VoiceSubtitleV1MainController::class, 'getAllGroups']);
        Route::get('/queue/group/{group?}', [VoiceSubtitleV1MainController::class, 'getQueueByGroup']);
        Route::get('/tasks', [VoiceSubtitleV1MainController::class, 'listTasks']);
        Route::post('/tasks/delete', [VoiceSubtitleV1MainController::class, 'deleteTasks']);
        Route::get('/tasks/{taskId}', [VoiceSubtitleV1MainController::class, 'getTaskStatus']);

        Route::get('/settings', [VoiceSubtitleV1MainController::class, 'getUserSettings']);
        Route::post('/settings', [VoiceSubtitleV1MainController::class, 'updateUserSettings']);
        Route::get('/languages', [VoiceSubtitleV1MainController::class, 'getSupportedLanguages']);
    });

    Route::get('/health', function () {
        return response()->json([
            'success' => true,
            'application' => 'McpV1',
            'status' => 'healthy',
            'timestamp' => now()->toIso8601String()
        ]);
    });
});
