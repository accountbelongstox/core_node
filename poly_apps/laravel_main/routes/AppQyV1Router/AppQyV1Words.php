<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1WordQueryController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordLearningStatusController;
use Illuminate\Support\Facades\Route;

$apiVersionPrefix = 'app_qy_v1';

/*
|--------------------------------------------------------------------------
| AppQyV1 Words Routes
|--------------------------------------------------------------------------
|
| Routes for word management and learning features
| Base path: /api/app_qy_v1/words/
|
*/

Route::prefix($apiVersionPrefix)->group(function () {
Route::prefix('words')->middleware('auth:sanctum')->group(function () {

    // Daily words
    Route::get('/daily', [AppQyV1WordQueryController::class, 'getDailyWords']);

    // Word details
    Route::get('/{id}', [AppQyV1WordQueryController::class, 'getWordDetails']);

    // Mark word as learned
    Route::post('/{id}/learn', [AppQyV1WordLearningStatusController::class, 'markAsLearned']);

    // Word operations
    Route::post('/{id}/review', [AppQyV1WordLearningStatusController::class, 'markAsReviewed']);
    Route::post('/{id}/favorite', [AppQyV1WordQueryController::class, 'toggleFavorite']);

    // Search words
    Route::get('/search/{query}', [AppQyV1WordQueryController::class, 'searchWords']);

});

// Public word endpoints (no auth required)
Route::prefix('words/public')->group(function () {

    // Basic word lookup
    Route::get('/{word}', [AppQyV1WordQueryController::class, 'publicWordLookup']);

});
});