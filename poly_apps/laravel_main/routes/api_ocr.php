<?php

use App\Support\ApiComputeCatalog;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\OCRController;

/**
 * OCR API Routes
 *
 * OCR endpoints for MCP bridge integration. Recognition creates pycore
 * tasks: client-key signature or user session plus the compute throttle
 * (ApiComputeCatalog::AUTH_MIDDLEWARE); reads stay public.
 */

Route::prefix('ocr')->group(function () {
    // Health check
    Route::get('/health', [OCRController::class, 'health']);

    // OCR recognition
    Route::post('/recognize', [OCRController::class, 'recognize'])->middleware(ApiComputeCatalog::AUTH_MIDDLEWARE);
    Route::post('/recognize-batch', [OCRController::class, 'recognizeBatch'])->middleware(ApiComputeCatalog::AUTH_MIDDLEWARE);

    // Model information
    Route::get('/models', [OCRController::class, 'getModels']);
    Route::get('/engine-info', [OCRController::class, 'getEngineInfo']);
});
