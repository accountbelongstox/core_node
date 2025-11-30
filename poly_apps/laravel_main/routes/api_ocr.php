<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\OCRController;

/**
 * OCR API Routes
 *
 * Public OCR endpoints for MCP bridge integration.
 * No authentication required for local MCP bridge access.
 */

Route::prefix('ocr')->group(function () {
    // Health check
    Route::get('/health', [OCRController::class, 'health']);

    // OCR recognition
    Route::post('/recognize', [OCRController::class, 'recognize']);
    Route::post('/recognize-batch', [OCRController::class, 'recognizeBatch']);

    // Model information
    Route::get('/models', [OCRController::class, 'getModels']);
    Route::get('/engine-info', [OCRController::class, 'getEngineInfo']);
});
