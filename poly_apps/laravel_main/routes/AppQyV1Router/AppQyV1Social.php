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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1SocialController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->middleware(['custom.authenticate'])->group(function () {

    Route::prefix('social')->group(function () {
        Route::get('/friends', [AppQyV1SocialController::class, 'getFriends']);
        Route::get('/friends/search', [AppQyV1SocialController::class, 'searchUsers']);
        Route::post('/friends/follow', [AppQyV1SocialController::class, 'follow']);
        Route::post('/friends/unfollow', [AppQyV1SocialController::class, 'unfollow']);
        Route::get('/leaderboard', [AppQyV1SocialController::class, 'getLeaderboard']);
        Route::get('/activities', [AppQyV1SocialController::class, 'getActivities']);
    });
});
