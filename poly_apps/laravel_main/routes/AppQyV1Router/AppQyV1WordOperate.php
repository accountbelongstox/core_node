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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordLearningStatusController as WLearnedController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordReadingStatusController as WReadController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordWeightController as WWeightController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate\AppQyV1WordReviewStatusController as WReviewedController;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/' . $version;
Route::prefix($apiVersionPrefix)->group(function () {
    // Route::any('/query_words', [QueryWordsController::class, 'queryWords']);
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/up_learned', [WLearnedController::class, 'upLearned']);
        Route::any('/up_read', [WReadController::class, 'upRead']);
        Route::any('/up_weight', [WWeightController::class, 'upWeight']);
        Route::any('/up_reviewed', [WReviewedController::class, 'upReviewed']);
    });
});
