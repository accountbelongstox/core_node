<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyDocumentController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyExportController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyLibraryPublicController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyValidityController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyStatsController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1DictionaryWordManagementController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('vocabulary')->group(function () {
        Route::get('/statistics', [AppQyV1VocabularyLibraryPublicController::class, 'getStatistics']);
        Route::get('/libraries/recommended', [AppQyV1VocabularyLibraryPublicController::class, 'getRecommended']);
        Route::get('/libraries/{libraryId}/words', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraryWords']);
        Route::get('/libraries', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraries']);

        // Vocabulary page stats drill-down (dashboard, read-only). Powers the
        // "Language Breakdown" panel + per-language drilldown.
        Route::get('/language-breakdown', [AppQyV1VocabularyStatsController::class, 'languageBreakdown']);

        // Vocabulary export downloads (public, same data as statistics
        // include_words). Format whitelist (csv|json|anki|text|pdf) is
        // enforced in the controller with a 400 for anything else.
        Route::post('/export/{format}', [AppQyV1VocabularyExportController::class, 'export']);

        // Word validity intake for a third-party verification client.
        Route::get('/validity/pending', [AppQyV1VocabularyValidityController::class, 'getPending']);
        Route::post('/validity/report', [AppQyV1VocabularyValidityController::class, 'report']);
    });

    // Per-language dictionary drill-down (Vocabulary page stats). Read-only,
    // paginated rows from app_qy_v1_tts_cache_<lang> with a coverage filter.
    Route::get('/dictionary/words', [AppQyV1VocabularyStatsController::class, 'dictionaryWords']);
    // Validity breakdown (valid/invalid/unchecked + invalid-by-source) for the
    // dashboard's Word Validity management panel.
    Route::get('/dictionary/validity-summary', [AppQyV1VocabularyStatsController::class, 'validitySummary']);
    // Example sentences from the shared sentence library containing a word
    // (lazy-loaded when a word row is expanded).
    Route::get('/dictionary/sentences', [AppQyV1VocabularyStatsController::class, 'wordSentences']);

    // TTS queue items drill-down (Vocabulary page stats). Paginated view over
    // the unified TTS queue (canonical tables).
    Route::get('/tts/queue/items', [AppQyV1VocabularyStatsController::class, 'ttsQueueItems']);

    // Dictionary word MANAGEMENT (dashboard Words tab): create / update / delete
    // a single word and batch actions (delete / mark valid|invalid / requeue tts).
    Route::post('/dictionary/words', [AppQyV1DictionaryWordManagementController::class, 'create']);
    Route::post('/dictionary/words/batch', [AppQyV1DictionaryWordManagementController::class, 'batch']);
    Route::put('/dictionary/words/{md5}', [AppQyV1DictionaryWordManagementController::class, 'update']);
    Route::delete('/dictionary/words/{md5}', [AppQyV1DictionaryWordManagementController::class, 'destroy']);
});

// Document re-processing endpoints: documents are stored per user at upload
// time (POST /learning/upload), so these require the owning sanctum user.
Route::prefix($apiVersionPrefix)->middleware(['auth:sanctum'])->group(function () {
    Route::prefix('vocabulary')->group(function () {
        Route::post('/document/{id}/extract-words', [AppQyV1VocabularyDocumentController::class, 'extractWords']);
        Route::post('/document/{id}/extract-sentences', [AppQyV1VocabularyDocumentController::class, 'extractSentences']);
    });
});

