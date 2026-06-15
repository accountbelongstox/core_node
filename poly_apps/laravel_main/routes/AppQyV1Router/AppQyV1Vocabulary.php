<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyDocumentController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyExportController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyLibraryPublicController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyValidityController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('vocabulary')->group(function () {
        Route::get('/statistics', [AppQyV1VocabularyLibraryPublicController::class, 'getStatistics']);
        Route::get('/libraries/recommended', [AppQyV1VocabularyLibraryPublicController::class, 'getRecommended']);
        Route::get('/libraries/{libraryId}/words', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraryWords']);
        Route::get('/libraries', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraries']);

        // Vocabulary export downloads (public, same data as statistics
        // include_words). Format whitelist (csv|json|anki|text|pdf) is
        // enforced in the controller with a 400 for anything else.
        Route::post('/export/{format}', [AppQyV1VocabularyExportController::class, 'export']);

        // Word validity intake for a third-party verification client.
        Route::get('/validity/pending', [AppQyV1VocabularyValidityController::class, 'getPending']);
        Route::post('/validity/report', [AppQyV1VocabularyValidityController::class, 'report']);
    });
});

// Document re-processing endpoints: documents are stored per user at upload
// time (POST /learning/upload), so these require the owning sanctum user.
Route::prefix($apiVersionPrefix)->middleware(['auth:sanctum'])->group(function () {
    Route::prefix('vocabulary')->group(function () {
        Route::post('/document/{id}/extract-words', [AppQyV1VocabularyDocumentController::class, 'extractWords']);
        Route::post('/document/{id}/extract-sentences', [AppQyV1VocabularyDocumentController::class, 'extractSentences']);
    });
});

