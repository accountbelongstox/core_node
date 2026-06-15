<?php

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

Route::get('/static/{path}', [StaticFileController::class, 'serve'])
    ->where('path', '.*')
    ->name('static.fallback');
