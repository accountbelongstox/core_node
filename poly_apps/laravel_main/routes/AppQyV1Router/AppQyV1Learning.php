<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1LearningController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning\AppQyV1VocabularyUploadController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/' . $version;

Route::prefix($apiVersionPrefix)->middleware(['auth:sanctum'])->group(function () {
    
    Route::prefix('learning')->group(function () {
        Route::get('/languages', [AppQyV1LearningController::class, 'getUserLanguages']);
        Route::post('/languages', [AppQyV1LearningController::class, 'setUserLanguages']);
        
        Route::get('/libraries', [AppQyV1LearningController::class, 'getVocabularyLibraries']);
        Route::post('/libraries/select', [AppQyV1LearningController::class, 'selectVocabularyLibrary']);
        
        Route::get('/words', [AppQyV1LearningController::class, 'getWordCards']);
        Route::post('/progress', [AppQyV1LearningController::class, 'updateProgress']);
        Route::get('/stats', [AppQyV1LearningController::class, 'getLearningStats']);
        
        Route::post('/upload', [AppQyV1VocabularyUploadController::class, 'uploadDocument']);
        Route::delete('/libraries/{library_id}', [AppQyV1VocabularyUploadController::class, 'deleteLibrary']);
    });
});
