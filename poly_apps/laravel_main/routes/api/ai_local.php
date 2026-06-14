<?php

use App\Http\Controllers\Api\AiLocalController;
use Illuminate\Support\Facades\Route;

/**
 * Local AI gateway routes — the PHP twin of pycore's /api/local/ai/* surface.
 *
 * Public (no auth): the dashboard's AI Management page calls these from the
 * browser, and provider keys are never returned (only first4…last4 masks). Rate
 * counters are shared with pycore, so the same free-tier budget is enforced
 * regardless of which runtime served the request.
 *
 * A `throttle` bound is applied so an unauthenticated caller cannot flood the
 * gateway: the per-provider free-tier limiter already caps real token spend, and
 * this caps request rate on top (the UI only polls a couple GETs every 5s).
 */
Route::prefix('local/ai')->middleware('throttle:120,1')->group(function () {
    Route::get('catalog', [AiLocalController::class, 'catalog']);
    Route::get('probe', [AiLocalController::class, 'probe']);
    Route::post('chat', [AiLocalController::class, 'chat']);
    Route::get('gateway', [AiLocalController::class, 'gateway']);
    Route::get('rate-limits', [AiLocalController::class, 'rateLimits']);
    Route::get('usage', [AiLocalController::class, 'usage']);
    Route::post('image', [AiLocalController::class, 'image']);
    Route::get('image/history', [AiLocalController::class, 'imageHistory']);
    Route::get('image/history/file/{id}', [AiLocalController::class, 'imageHistoryFile']);
    Route::delete('image/history/{id}', [AiLocalController::class, 'imageHistoryDelete']);
    Route::post('image/history/clear', [AiLocalController::class, 'imageHistoryClear']);
    Route::get('info', [AiLocalController::class, 'info']);
});
