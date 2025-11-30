<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;

// AwyV0 Dashboard Routes
Route::prefix('awy-v0/dashboard')->middleware('auth:sanctum')->group(function () {
    Route::get('/stats', [App\Apps\AwyV0\AwyV0Controllers\AwyV0DashboardCtl::class, 'stats']);
    Route::get('/activity', [App\Apps\AwyV0\AwyV0Controllers\AwyV0DashboardCtl::class, 'activityTimeline']);
    Route::get('/insights', [App\Apps\AwyV0\AwyV0Controllers\AwyV0DashboardCtl::class, 'insights']);
});