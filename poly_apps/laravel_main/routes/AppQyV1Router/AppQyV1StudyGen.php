<?php

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1StudyGen\AppQyV1StudyGenController;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

/*
|--------------------------------------------------------------------------
| Book Study-Content Generation pipeline (mcp-chrome worker surface)
|--------------------------------------------------------------------------
|
| The mcp-chrome "Book Study Generator" panel lists sources with progress,
| claims one ~500-char segment at a time under a 60-minute lease, drives a
| web-AI chat (Gemini / ChatGPT / Grok / Copilot) to produce multi-language
| comparison sentences + explanations + short-phrase intros + grammar points,
| and posts the parsed result back. Canonical contract:
| development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md.
|
| TRUST LEVEL: NO-AUTH, deliberately matching the existing pycore/chrome worker
| pull surfaces - /assist/*, submit-bing, /api/worker/tasks/{pull,result}.
| chrome is a server-side caller without a user token; only Sanctum's stateful
| boot is stripped to keep the routes cheap, and every submitted artifact is
| validated server-side before touching state. Feature gate
| APPQYV1_STUDY_GEN_ENABLED (default true) backs the write endpoints off cleanly
| when disabled.
|
*/

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix('app_qy_v1/study-gen')
    ->group(function () {
        Route::get('/sources', [AppQyV1StudyGenController::class, 'sources']);
        Route::post('/claim', [AppQyV1StudyGenController::class, 'claim']);
        Route::post('/submit', [AppQyV1StudyGenController::class, 'submit']);
        Route::post('/release', [AppQyV1StudyGenController::class, 'release']);
        Route::get('/status', [AppQyV1StudyGenController::class, 'status']);
        // Retrieval hook: a reader loading a passage finds its study aids by
        // segment_index or by a covering seq.
        Route::get('/segment-content', [AppQyV1StudyGenController::class, 'segmentContent']);
    });
