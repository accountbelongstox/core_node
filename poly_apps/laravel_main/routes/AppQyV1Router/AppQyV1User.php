<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User\AppQyV1UserInitializationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User\AppQyV1ProfileController;

/*
|--------------------------------------------------------------------------
| AppQyV1 User Routes
|--------------------------------------------------------------------------
|
| Routes for user progress, stats, and profile management
| Base path: /api/user/
|
*/

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('user')->middleware('auth:sanctum')->group(function () {

        Route::get('/initialization-status', [AppQyV1UserInitializationController::class, 'status']);
        Route::post('/initialize', [AppQyV1UserInitializationController::class, 'initialize']);

        // User learning progress
        Route::get('/progress', function () {
            return response()->json([
                'success' => true,
                'data' => [
                    'totalWords' => 150,
                    'learnedWords' => 45,
                    'reviewedWords' => 30,
                    'studyStreak' => 7,
                    'lastStudyDate' => now()->toDateString()
                ]
            ]);
        });

        // User statistics
        Route::get('/stats', function () {
            return response()->json([
                'success' => true,
                'data' => [
                    'studyDays' => 25,
                    'totalWords' => 150,
                    'completionRate' => 30.0,
                    'averageAccuracy' => 85.5,
                    'totalStudyTime' => 1200 // minutes
                ]
            ]);
        });

        // User profile
        Route::get('/profile', [AppQyV1ProfileController::class, 'getProfile']);
        Route::put('/profile', [AppQyV1ProfileController::class, 'updateProfile']);
        Route::post('/profile', [AppQyV1ProfileController::class, 'updateProfile']);
    });
});
