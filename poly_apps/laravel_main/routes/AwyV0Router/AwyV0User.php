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

// AwyV0 User Management Routes
Route::prefix('awy-v0/user')->middleware('auth:sanctum')->group(function () {
    Route::get('/profile', [App\Apps\AwyV0\Controllers\AwyV0UserCtl::class, 'getUser']);
    Route::put('/profile', [App\Apps\AwyV0\Controllers\AwyV0UserCtl::class, 'updateUser']);
    Route::post('/change-password', [App\Apps\AwyV0\Controllers\AwyV0UserCtl::class, 'changePassword']);
    Route::post('/bind-phone', [App\Apps\AwyV0\Controllers\AwyV0UserCtl::class, 'bindPhone']);
    Route::post('/bind-email', [App\Apps\AwyV0\Controllers\AwyV0UserCtl::class, 'bindEmail']);
});
