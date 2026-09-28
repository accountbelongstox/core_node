<?php

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

        // Move a movie/TV poster to the mcp-chrome search queue head.
        Route::post('/poster/fetch', [AppQyV1MoviePosterController::class, 'fetch']);

        // Cheap, no-auth mcp-chrome poster queue snapshot.
        Route::get('/poster/status', [AppQyV1MoviePosterController::class, 'status']);
    });
});
