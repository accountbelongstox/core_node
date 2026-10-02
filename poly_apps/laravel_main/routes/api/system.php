<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\System\TokenSessionController;
use App\Http\System\StatusController;
use App\Http\System\CodeSyncController;
use App\Http\Controllers\ServerManagerController;
use App\Http\Middleware\LocalAccessOnly;

$apiVersionPrefix = '';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::any('/get_system_status', [StatusController::class, 'index']);
    Route::middleware('client.key_or_dashboard')->group(function () {
        Route::post('/store_session', [TokenSessionController::class, 'store']);
        Route::get('/retrieve_session', [TokenSessionController::class, 'retrieve']);
        Route::post('/broadcast_session', [TokenSessionController::class, 'broadcast']);
    });
});

Route::prefix('system/code-sync')->middleware('client.key')->group(function () {
    Route::post('/', [CodeSyncController::class, 'start']);
    Route::get('/status', [CodeSyncController::class, 'status']);
    Route::get('/history', [CodeSyncController::class, 'history']);
});

Route::prefix('server-manager')->middleware(LocalAccessOnly::class)->group(function () {
    Route::get('/services', [ServerManagerController::class, 'listServices']);
    Route::get('/services/{serviceName}/status', [ServerManagerController::class, 'getStatus']);
    Route::post('/services/{serviceName}/start', [ServerManagerController::class, 'startService']);
    Route::post('/services/{serviceName}/stop', [ServerManagerController::class, 'stopService']);
    Route::post('/services/{serviceName}/restart', [ServerManagerController::class, 'restartService'])->middleware('idempotent');
    Route::get('/services/{serviceName}/logs', [ServerManagerController::class, 'getLogs']);
    Route::post('/services/{serviceName}/toggle-autostart', [ServerManagerController::class, 'toggleAutoStart'])->middleware('idempotent');

    Route::match(['get', 'post'], '/restart', [ServerManagerController::class, 'restartCurrent']);
});

