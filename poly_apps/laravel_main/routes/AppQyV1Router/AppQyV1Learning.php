<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1LearningController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1VocabularyUploadController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1VocabularyRecommendationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1QuizController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1UserStatsController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1DailyRecitationController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->middleware(['auth:sanctum'])->group(function () {

    Route::prefix('learning')->group(function () {
        Route::get('/languages', [AppQyV1LearningController::class, 'getUserLanguages']);
        Route::post('/languages', [AppQyV1LearningController::class, 'setUserLanguages']);

        Route::get('/libraries', [AppQyV1LearningController::class, 'getVocabularyLibraries']);
        Route::post('/libraries/select', [AppQyV1LearningController::class, 'selectVocabularyLibrary']);

        Route::post('/collections/select', [AppQyV1VocabularyRecommendationController::class, 'selectCollection']);
        Route::get('/collections/selected', [AppQyV1VocabularyRecommendationController::class, 'getSelectedCollections']);

        Route::get('/words', [AppQyV1LearningController::class, 'getWordCards']);
        Route::get('/review-queue', [AppQyV1LearningController::class, 'getReviewQueue']);
        Route::post('/progress', [AppQyV1LearningController::class, 'updateProgress']);
        Route::get('/stats', [AppQyV1LearningController::class, 'getLearningStats']);

        Route::post('/upload', [AppQyV1VocabularyUploadController::class, 'uploadDocument']);
        Route::delete('/libraries/{library_id}', [AppQyV1VocabularyUploadController::class, 'deleteLibrary']);
    });

    // Daily recitation: append-only per-day log driving the existing
    // personal_dicts counters. Same auth group as /learning/progress.
    Route::prefix('recitation')->group(function () {
        Route::post('/log', [AppQyV1DailyRecitationController::class, 'logRecitation']);
        Route::get('/today-plan', [AppQyV1DailyRecitationController::class, 'todayPlan']);
        Route::get('/summary', [AppQyV1DailyRecitationController::class, 'summary']);
        Route::get('/streak', [AppQyV1DailyRecitationController::class, 'streak']);
    });
});

Route::prefix($apiVersionPrefix)->middleware(['auth:sanctum'])->group(function () {
    Route::any('/quiz/generate', [AppQyV1QuizController::class, 'generate']);
    Route::any('/user/stats/retention', [AppQyV1UserStatsController::class, 'retention']);
});

// Public learning routes - no authentication required.
// Anonymous users get is_selected=false; logged-in users (sanctum token) get real flags.
Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('learning')->group(function () {
        Route::get('/recommendations', [AppQyV1VocabularyRecommendationController::class, 'getRecommendations']);
    });
});
