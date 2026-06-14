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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordLearningStatusController as WLearnedController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordReadingStatusController as WReadController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordWeightController as WWeightController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordReviewStatusController as WReviewedController;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';
Route::prefix($apiVersionPrefix)->group(function () {
    // Route::any('/query_words', [QueryWordsController::class, 'queryWords']);
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/up_learned', [WLearnedController::class, 'upLearned']);
        Route::any('/up_read', [WReadController::class, 'upRead']);
        Route::any('/up_weight', [WWeightController::class, 'upWeight']);
        Route::any('/up_reviewed', [WReviewedController::class, 'upReviewed']);
    });
});
