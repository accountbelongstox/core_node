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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1MediaContentPublicController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1MoviePosterController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

// Public media content routes - no authentication required.
// NOTE: list endpoints (GET media/books, GET media/subtitles) are served by
// App\Http\Controllers\MediaBrowseController registered earlier in routes/api.php;
// duplicates here could never win and were removed. Only the sentence-content
// endpoint (no collision) lives here.
Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('media')->group(function () {
        Route::get('/content/{type}/{id}', [AppQyV1MediaContentPublicController::class, 'getContent'])
            ->whereNumber('id');

        // On-demand movie/TV poster fetch + backfill (TMDB -> OMDB, PHP).
        // Canonical contract: development-guides/MOVIE_POSTER_PIPELINE.md §7.
        Route::post('/poster/fetch', [AppQyV1MoviePosterController::class, 'fetch']);

        // Cheap, no-auth poster-pipeline status snapshot (provider key config +
        // masked keys + per-type poster_status counts) for the laravel-manager
        // "Movie Poster" panel. Never throws.
        Route::get('/poster/status', [AppQyV1MoviePosterController::class, 'status']);
    });
});
