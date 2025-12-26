<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyLibraryPublicController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('vocabulary')->group(function () {
        Route::get('/statistics', [AppQyV1VocabularyLibraryPublicController::class, 'getStatistics']);
        Route::get('/libraries/recommended', [AppQyV1VocabularyLibraryPublicController::class, 'getRecommended']);
        Route::get('/libraries/{libraryId}/words', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraryWords']);
        Route::get('/libraries', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraries']);
    });
});
