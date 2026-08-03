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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1WordMediaController;
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

// Word-media on-demand resolution (P2). No auth — browser UI and workers consume it; the
// same public trust level as words/public. FILE-FIRST: image_url/audio_url only
// when on disk, else enqueue + bump the word_media task and report 'pending'.
//   GET /api/app_qy_v1/word/{lang}/{word}/media
Route::get('/word/{lang}/{word}/media', [AppQyV1WordMediaController::class, 'media'])
    ->where('lang', '[A-Za-z][A-Za-z0-9_-]*');

// FE-generated word audio upload (Puter.js): persist a synthesized clip for a
// dictionary row matched by (lang, md5). Public trust level matches the media
// resolve endpoint above; validated + fill-missing server-side.
//   POST /api/app_qy_v1/word/audio/upload  { md5, lang, audio_base64, provider? }
Route::post('/word/audio/upload', [AppQyV1WordMediaController::class, 'uploadAudio']);

// Missing-audio word batch for the browser-side Puter.js generator (pycore-manager
// Queue Center persistent bar). Returns up to limit words with has_audio=false;
// backend-marked invalid words (is_valid=false) are excluded.
//   GET /api/app_qy_v1/word/audio/missing-batch?limit=1000&language=en
Route::get('/word/audio/missing-batch', [AppQyV1WordMediaController::class, 'missingBatch']);

// Fix garbled word text detected during browser-side audio generation.
// Writes the cleaned form back to the content column (HTML/garbage -> '-').
//   POST /api/app_qy_v1/word/fix-text  { md5, lang, cleaned_word }
Route::post('/word/fix-text', [AppQyV1WordMediaController::class, 'fixWordText']);

// Boost a word's tts_priority to move it to the front of the audio queue.
// Move-to-front ticket (MAX+1, atomic): the newest boost always sorts strictly
// ahead of every other row. Called directly from the browser UI.
//   POST /api/app_qy_v1/word/boost-priority  { md5, lang }
Route::post('/word/boost-priority', [AppQyV1WordMediaController::class, 'boostPriority']);
Route::post('/word/boost-priority/batch', [AppQyV1WordMediaController::class, 'boostPriorityBatch']);
});
