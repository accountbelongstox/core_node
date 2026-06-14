<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

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
