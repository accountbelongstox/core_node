<?php

use App\Http\Controllers\Api\WordAudioLocalController;
use Illuminate\Support\Facades\Route;

/**
 * Local word-audio routes — the PHP twin of pycore's /api/local/word-audio/*
 * surface.
 *
 * Public (no auth): the dashboard's Word Audio page calls these from the
 * browser. /status never returns the Forvo key (only a present/absent bool),
 * and /test returns base64-encoded audio bytes — no secrets are exposed, so
 * this mirrors ai_local.php and deliberately does NOT add dashboard.auth.
 *
 * A `throttle` bound is applied so an unauthenticated caller cannot flood the
 * live pronunciation fetch (mirrors ai_local.php's rate cap).
 */
Route::prefix('local/word-audio')->middleware('throttle:120,1')->group(function () {
    Route::get('status', [WordAudioLocalController::class, 'status']);
    Route::post('test', [WordAudioLocalController::class, 'test']);
});
