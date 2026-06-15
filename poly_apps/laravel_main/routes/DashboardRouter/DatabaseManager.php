<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Dashboard\DatabaseManagerController;
use App\Http\Controllers\Dashboard\DebugAuthController;

// Open endpoint: lets the dashboard frontend learn whether the same-machine
// (loopback) debug login bypass applies, so it can skip its login gate locally.
Route::get('dashboard/auth/debug-status', [DebugAuthController::class, 'status']);

// Database Manager: every endpoint requires EITHER a loopback debug session OR a
// valid Sanctum token (the `dashboard.auth` middleware decides).
Route::prefix('dashboard/db-manager')->middleware('dashboard.auth')->group(function () {
    Route::get('/connections', [DatabaseManagerController::class, 'connections']);
    Route::get('/status', [DatabaseManagerController::class, 'status']);
    Route::get('/tables', [DatabaseManagerController::class, 'tables']);
    Route::get('/tables/{table}/structure', [DatabaseManagerController::class, 'structure']);
    Route::get('/tables/{table}/data', [DatabaseManagerController::class, 'data']);
    Route::get('/tables/{table}/export', [DatabaseManagerController::class, 'export']);
    Route::post('/tables/{table}/import', [DatabaseManagerController::class, 'import']);
    Route::post('/backup', [DatabaseManagerController::class, 'backup']);
    Route::get('/backups', [DatabaseManagerController::class, 'backups']);
    Route::post('/backups/{id}/restore', [DatabaseManagerController::class, 'restore']);
    Route::delete('/backups/{id}', [DatabaseManagerController::class, 'deleteBackup']);
    Route::get('/backups/{id}/download', [DatabaseManagerController::class, 'downloadBackup']);

    // Credential management (driver-aware; pgsql/mysql only — sqlite has no
    // accounts). Changing the CONFIGURED superuser's password re-syncs it into
    // Laravel's own credential store; other accounts never touch the store.
    Route::get('/credentials', [DatabaseManagerController::class, 'credentials']);
    Route::post('/credentials/change', [DatabaseManagerController::class, 'changePassword']);
    Route::post('/credentials/reset', [DatabaseManagerController::class, 'resetPassword']);
    Route::post('/credentials/users', [DatabaseManagerController::class, 'createUser']);
    Route::delete('/credentials/users/{username}', [DatabaseManagerController::class, 'dropUser']);
});
