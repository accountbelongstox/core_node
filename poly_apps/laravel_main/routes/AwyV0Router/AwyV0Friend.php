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
use App\Apps\AwyV0\AwyV0Controllers\AwyV0FriendCtl;

// AwyV0 Friend Management Routes
Route::prefix('awy-v0/friend')->middleware('auth:sanctum')->group(function () {
    Route::get('/list', [AwyV0FriendCtl::class, 'list']);
    Route::post('/add', [AwyV0FriendCtl::class, 'add']);
    Route::delete('/remove', [AwyV0FriendCtl::class, 'remove']);
    Route::get('/info', [AwyV0FriendCtl::class, 'info']);
    Route::get('/health', [AwyV0FriendCtl::class, 'health']);
    Route::get('/search', [AwyV0FriendCtl::class, 'search']);
});
