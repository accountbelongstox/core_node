<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\System\TokenSessionController;
use App\Http\System\StatusController;
use App\Http\Controllers\ServerManagerController;
use App\Http\Middleware\LocalAccessOnly;

$apiVersionPrefix = '';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::any('/get_system_status', [StatusController::class, 'index']);
    Route::post('/store_session', [TokenSessionController::class, 'store']);
    Route::get('/retrieve_session', [TokenSessionController::class, 'retrieve']);
    Route::post('/broadcast_session', [TokenSessionController::class, 'broadcast']);
});

Route::prefix('server-manager')->middleware(LocalAccessOnly::class)->group(function () {
    Route::get('/services', [ServerManagerController::class, 'listServices']);
    Route::get('/services/{serviceName}/status', [ServerManagerController::class, 'getStatus']);
    Route::post('/services/{serviceName}/start', [ServerManagerController::class, 'startService']);
    Route::post('/services/{serviceName}/stop', [ServerManagerController::class, 'stopService']);
    Route::post('/services/{serviceName}/restart', [ServerManagerController::class, 'restartService']);
    Route::get('/services/{serviceName}/logs', [ServerManagerController::class, 'getLogs']);
    Route::post('/services/{serviceName}/toggle-autostart', [ServerManagerController::class, 'toggleAutoStart']);

    Route::match(['get', 'post'], '/restart', [ServerManagerController::class, 'restartCurrent']);
});

