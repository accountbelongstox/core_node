<?php

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1SentenceAudioController;
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

Route::get('/static/{path}', [StaticFileController::class, 'serve'])
    ->where('path', '.*')
    ->name('static.fallback');
