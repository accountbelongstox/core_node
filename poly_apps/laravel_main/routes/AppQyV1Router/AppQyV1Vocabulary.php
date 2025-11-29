<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyLibraryPublicController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/' . $version;

Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('vocabulary')->group(function () {
        Route::get('/libraries/recommended', [AppQyV1VocabularyLibraryPublicController::class, 'getRecommended']);
        Route::get('/libraries', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraries']);
    });
});
