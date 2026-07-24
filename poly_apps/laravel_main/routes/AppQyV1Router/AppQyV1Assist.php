<?php

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1AssistController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1AssistRequestController;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

/*
|--------------------------------------------------------------------------
| mcp-chrome media assist protocol
|--------------------------------------------------------------------------
|
| mcp-chrome claims vocabulary covers and media posters, searches for suitable
| images, and reports artifacts back under a 60-minute lease.
|
| TRUST LEVEL: NO-AUTH, deliberately matching the existing local worker pull
| surfaces. mcp-chrome is a trusted local caller without a user token;
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
        Route::post('/poster/priority', [AppQyV1AssistController::class, 'posterPriority']);
        // Discard unsatisfactory covers (delete file + re-queue) and recover
        // covers whose file is missing on disk.
        Route::post('/cover/clear', [AppQyV1AssistController::class, 'coverClear']);
        Route::post('/cover/reconcile', [AppQyV1AssistController::class, 'coverReconcile']);
        Route::get('/status', [AppQyV1AssistController::class, 'status']);
        // Cheap cache-backed cross-queue snapshot, warmed by
        // the Octane cover timer — third parties + dashboard poll this freely.
        Route::get('/pending', [AppQyV1AssistController::class, 'pending']);
        // Rich aggregate snapshot for pycore's Queue Center overview (SHARED
        // CONTRACT v2): all 8 assist categories + worker roster, cache-backed
        // (30s), ?fresh=1 bypass.
        Route::get('/overview', [AppQyV1AssistController::class, 'overview']);
        Route::get('/overview/items', [AppQyV1AssistController::class, 'overviewItems']);

        // Record-scoped assist requests (CoreBook §6): a thin per-record request
        // layer on top of the worker-pull pool. Filed by the Task Center modal
        // (human selection) or pycore (partial CoreBook submit); claimed/finished
        // by the existing assist/global-task workers via request_type.
        Route::prefix('requests')->group(function () {
            Route::get('', [AppQyV1AssistRequestController::class, 'index']);
            Route::post('', [AppQyV1AssistRequestController::class, 'create']);
            Route::post('/claim', [AppQyV1AssistRequestController::class, 'claim']);
            Route::post('/submit', [AppQyV1AssistRequestController::class, 'submit']);
            Route::post('/release', [AppQyV1AssistRequestController::class, 'release']);
            Route::delete('/{id}', [AppQyV1AssistRequestController::class, 'destroy']);
        });
    });
