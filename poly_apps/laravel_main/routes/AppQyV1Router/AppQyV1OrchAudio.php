<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio\AppQyV1BookAudioPlanCtl;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio\AppQyV1OrchAudioCtl;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio\AppQyV1OrchClientTaskCtl;
use App\Http\Middleware\ServerIdentityHeader;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

// Pycore audio-orchestration output. Contract: docs_fix/
// DESIGN_AUDIO_ORCHESTRATION.md section 10.
// Ingest takes the shared client key, like ai_tools/article/worker/*.
// Delivery diffs (formerly ingest/probe) live in AppQyV1Delivery.php (kind orch_output).
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->middleware([ServerIdentityHeader::class, 'client.key'])
    ->prefix('app_qy_v1/orch_audio/ingest')
    ->group(function () {
        Route::post('/tasks', [AppQyV1OrchAudioCtl::class, 'ingestTasks']);
        Route::post('/segment-audio', [AppQyV1OrchAudioCtl::class, 'ingestSegmentAudio']);
    });

Route::prefix('app_qy_v1/orch_audio')->middleware('auth:sanctum')->group(function () {
    Route::get('/tasks', [AppQyV1OrchAudioCtl::class, 'index']);
    Route::get('/tasks/{taskKey}', [AppQyV1OrchAudioCtl::class, 'show'])
        ->where('taskKey', '[a-f0-9]{40}');
    // Server-owned book audio plan: post once, follow status and ready ids by cursor
    // (audio_orchestration_contract book_plan).
    Route::middleware('schema.gate')->prefix('book_plans')->group(function () {
        Route::post('/', [AppQyV1BookAudioPlanCtl::class, 'plan']);
        Route::get('/{planId}', [AppQyV1BookAudioPlanCtl::class, 'status'])
            ->where('planId', '[a-f0-9]{40}');
        Route::get('/{planId}/ready', [AppQyV1BookAudioPlanCtl::class, 'ready'])
            ->where('planId', '[a-f0-9]{40}');
    });
    Route::get('/client_tasks', [AppQyV1OrchClientTaskCtl::class, 'index']);
    Route::post('/client_tasks/{clientTaskId}', [AppQyV1OrchClientTaskCtl::class, 'upsert'])
        ->where('clientTaskId', '[A-Za-z0-9._-]{1,64}');
    Route::delete('/client_tasks/{clientTaskId}', [AppQyV1OrchClientTaskCtl::class, 'destroy'])
        ->where('clientTaskId', '[A-Za-z0-9._-]{1,64}');
});
