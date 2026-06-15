<?php

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1AssistController;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

/*
|--------------------------------------------------------------------------
| Third-party assist protocol (pycore worker surface)
|--------------------------------------------------------------------------
|
| pycore claims work (vocabulary covers, TTS words), generates it with its
| local AI providers and reports artifacts back under a 60-minute lease.
|
| TRUST LEVEL: NO-AUTH, deliberately matching the existing pycore worker
| pull surfaces - /api/worker/tasks/{pull,result} (word translations),
| /api/app_qy_v1/ai_tools/tts/worker/{claim,report} and the translation
| queue control plane. pycore is a server-side caller without a user token;
| only Sanctum's stateful boot is stripped to keep the routes cheap, and
| every submitted artifact is validated server-side before touching state.
|
*/

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix('app_qy_v1/assist')
    ->group(function () {
        Route::post('/claim', [AppQyV1AssistController::class, 'claim']);
        Route::post('/submit', [AppQyV1AssistController::class, 'submit']);
        Route::post('/release', [AppQyV1AssistController::class, 'release']);
        Route::post('/cover/retry', [AppQyV1AssistController::class, 'coverRetry']);
        Route::get('/status', [AppQyV1AssistController::class, 'status']);
        // Cheap cache-backed pending snapshot (cover/tts/translation), warmed by
        // the Octane cover timer — third parties + dashboard poll this freely.
        Route::get('/pending', [AppQyV1AssistController::class, 'pending']);
    });
