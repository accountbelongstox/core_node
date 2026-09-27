<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Dashboard\DatabaseViewerController;

// `dashboard.auth` = loopback debug bypass OR Sanctum (was a bare auth:sanctum);
// so on a same-machine debug session this viewer is also login-free.
// DEPRECATED for the dashboard: its Database Viewer page was merged into the
// Database Manager (which uses /api/dashboard/db-manager/* with the same
// structure/data shapes). These routes are kept for external/script consumers.
Route::prefix('dashboard/db-viewer')->middleware('dashboard.auth')->group(function () {
    Route::get('/tables', [DatabaseViewerController::class, 'tables']);
    Route::get('/tables/{table}/structure', [DatabaseViewerController::class, 'structure']);
    Route::get('/tables/{table}/data', [DatabaseViewerController::class, 'data']);
});
