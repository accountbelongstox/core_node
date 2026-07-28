<?php

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1SentenceAudioController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1WordImageController;
use App\Http\Controllers\StaticFileController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| /static fallback (bare Octane)
|--------------------------------------------------------------------------
|
| Production nginx intercepts /static/ and serves PathMapper::getStaticPath()
| directly - Laravel never receives those requests there. This route is the
| bare-Octane fallback so the SAME URLs (vocabulary covers, media clips, ...)
| resolve when no nginx front sits in between (local dev / WSL).
|
| Registered through bootstrap/app.php `then:` so it carries NO middleware
| group (no session, no CSRF, no Sanctum) - it is a pure file responder.
| Companion of routes/files.php (which serves the /api/files/* surface).
|
*/

// Shared sentence-library audio is stored at
// PathMapper::getAppQyV1SentenceSoundsDir() (under external_data), NOT the
// static root — so the generic /static/{path} responder below cannot reach it.
// This dedicated route maps the public sentence-audio URL produced by
// AppQyV1SentenceAudioUrl back onto the sentence_sounds dir. Registered BEFORE
// the catch-all so it wins the match. (Production nginx maps this prefix the
// same way; this is the bare-Octane fallback.)
Route::get('/static/app_qy_v1/sentence_sounds/{language}/{filename}', [AppQyV1SentenceAudioController::class, 'serve'])
    ->name('static.appqyv1.sentence_sounds');

// SMART word-image serve ("request by word, not filename"):
//   GET /static/app_qy_v1/word_images/{lang}/{word}
// {word} is a single no-slash segment, so this 2-segment pattern never shadows
// the 3-segment md5 path "{lang}/word/{md5}.{ext}" below. File-first: 302 to the
// resolved md5 file when ready; on a miss it enqueues + bumps the word_media
// task and returns a 1x1 transparent PNG (HTTP 202). Registered BEFORE the
// generic {path} responder so the by-word form wins for 2-segment requests.
Route::get('/static/app_qy_v1/word_images/{lang}/{word}', [AppQyV1WordImageController::class, 'serveByWord'])
    ->where('lang', '[A-Za-z][A-Za-z0-9_-]*')
    ->where('word', '[^/]+')
    ->name('static.appqyv1.word_images.by_word');

// Bing-assist word images are stored at PathMapper::getAppQyV1WordImagesDir()
// (the unified static tree), served via the public URL produced by
// AppQyV1ImageUrl. This dedicated route maps that URL back onto the word-images
// dir. Registered BEFORE the catch-all so it wins the match (production nginx
// maps it the same way).
Route::get('/static/app_qy_v1/word_images/{path}', [AppQyV1WordImageController::class, 'serve'])
    ->where('path', '.*')
    ->name('static.appqyv1.word_images');

// Social Center post media (images + videos) are written under the Laravel data
// static dir (PathMapper::getLaravelStaticDir), NOT the external wwwroot static
// path the generic catch-all below serves. These dedicated routes map the public
// '/static/app_qy_v1/post_images|post_videos/...' URLs back onto that dir.
// Registered BEFORE the catch-all so they win the match. (Production nginx maps
// these prefixes the same way; this is the bare-Octane fallback.)
Route::get('/static/app_qy_v1/post_images/{path}', function (\Illuminate\Http\Request $request, string $path) {
    return app(StaticFileController::class)->serveLaravelStatic($request, 'app_qy_v1/post_images/' . $path);
})->where('path', '.*')->name('static.appqyv1.post_images');
Route::get('/static/app_qy_v1/post_videos/{path}', function (\Illuminate\Http\Request $request, string $path) {
    return app(StaticFileController::class)->serveLaravelStatic($request, 'app_qy_v1/post_videos/' . $path);
})->where('path', '.*')->name('static.appqyv1.post_videos');

// Agent-history / worker article audio (e.g. /static/app_qy_v1/audio/agent_history/en/{id}.mp3)
// is written under PathMapper::getAppQyV1AudioBaseDir() == getLaravelStaticDir('app_qy_v1/audio')
// (the laravel_db static tree), NOT the external wwwroot static path the generic
// catch-all below serves — without this dedicated route every article audio URL
// 404s under bare Octane. Registered BEFORE the catch-all so it wins the match.
// (Production nginx maps this prefix the same way.)
Route::get('/static/app_qy_v1/audio/{path}', function (\Illuminate\Http\Request $request, string $path) {
    return app(StaticFileController::class)->serveLaravelStatic($request, 'app_qy_v1/audio/' . $path);
})->where('path', '.*')->name('static.appqyv1.audio');

Route::get('/static/{path}', [StaticFileController::class, 'serve'])
    ->where('path', '.*')
    ->name('static.fallback');
