<?php

use Illuminate\Support\Facades\Route;
use App\Apps\McpV1\McpV1Controllers\McpV1OCRCtl;

Route::prefix('mcp/v1')->group(function () {
    Route::prefix('ocr')->group(function () {
        Route::post('/recognize', [McpV1OCRCtl::class, 'recognize']);
        Route::post('/smart-recognize', [McpV1OCRCtl::class, 'smartRecognize']);
        Route::post('/batch', [McpV1OCRCtl::class, 'batch']);
        Route::get('/engines', [McpV1OCRCtl::class, 'getEngines']);
        Route::get('/engine-info', [McpV1OCRCtl::class, 'getEngineInfo']);
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
