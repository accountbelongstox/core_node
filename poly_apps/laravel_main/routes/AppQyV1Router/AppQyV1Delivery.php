<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Delivery\AppQyV1DeliveryCtl;
use App\Http\Middleware\ServerIdentityHeader;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

// Pycore delivery: server identity, Laravel-side diff, batch upload. Contract:
// docs_fix/REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md "W7 contract".
// Runs at the pycore worker trust level of orch_audio/ingest/*.
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->middleware(ServerIdentityHeader::class)
    ->prefix('app_qy_v1/delivery')
    ->group(function () {
        Route::get('/info', [AppQyV1DeliveryCtl::class, 'info']);
        Route::post('/diff', [AppQyV1DeliveryCtl::class, 'diff']);
        Route::post('/batch', [AppQyV1DeliveryCtl::class, 'registerBatch']);
        Route::post('/batch/{batchId}/content', [AppQyV1DeliveryCtl::class, 'batchContent'])
            ->where('batchId', '[a-f0-9]{40}');
        Route::get('/batch/{batchId}', [AppQyV1DeliveryCtl::class, 'batchStatus'])
            ->where('batchId', '[a-f0-9]{40}');
    });
