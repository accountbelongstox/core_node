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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User\AppQyV1UserInitializationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User\AppQyV1ProfileController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User\AppQyV1BookReadingProgressController;

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
    Route::get('/user/daily-reading/{articleId}/resource-preview.json', [
        AppQyV1BookReadingProgressController::class,
        'showDailyReadingResourcePreview',
    ])->middleware('signed:relative')
        ->name('app_qy_v1.daily-reading.resource-preview-json');

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

        // User statistics (single source of truth for both clients).
        // qy_capacitor calls /statistics; the dashboard calls /stats.
        Route::get('/statistics', [AppQyV1ProfileController::class, 'getStatistics']);
        Route::get('/stats', [AppQyV1ProfileController::class, 'getStatistics']);

        // User profile
        Route::get('/profile', [AppQyV1ProfileController::class, 'getProfile']);
        Route::put('/profile', [AppQyV1ProfileController::class, 'updateProfile']);
        Route::post('/profile', [AppQyV1ProfileController::class, 'updateProfile']);

        // Avatar upload (multipart FormData, field name "avatar"); consumed by
        // the WordNew profile editor (WfProfileEditPage). Returns
        // { avatar, avatar_url } inside the standard envelope.
        Route::post('/avatar', [AppQyV1ProfileController::class, 'uploadAvatar']);

        // User preferences
        Route::get('/preferences', [AppQyV1ProfileController::class, 'getPreferences']);
        Route::put('/preferences', [AppQyV1ProfileController::class, 'updatePreferences']);
        Route::post('/preferences', [AppQyV1ProfileController::class, 'updatePreferences']);

        // Book reading progress (per source_key; many books per user)
        Route::get('/book-progress', [AppQyV1BookReadingProgressController::class, 'list']);
        Route::get('/book-progress/{sourceKey}', [AppQyV1BookReadingProgressController::class, 'get']);
        Route::put('/book-progress/{sourceKey}', [AppQyV1BookReadingProgressController::class, 'save']);
        Route::post('/book-progress/{sourceKey}', [AppQyV1BookReadingProgressController::class, 'save']);

        // Daily-reading playback progress (one row per authenticated user)
        Route::get('/daily-reading-progress', [AppQyV1BookReadingProgressController::class, 'getDailyReading']);
        Route::put('/daily-reading-progress', [AppQyV1BookReadingProgressController::class, 'saveDailyReading']);
        Route::post('/daily-reading-progress', [AppQyV1BookReadingProgressController::class, 'saveDailyReading']);
        Route::post('/daily-reading/{articleId}/resource-preview', [AppQyV1BookReadingProgressController::class, 'previewDailyReadingResources']);
    });
});
