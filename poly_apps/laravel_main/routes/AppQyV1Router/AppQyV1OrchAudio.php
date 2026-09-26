<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio\AppQyV1OrchAudioCtl;
use App\Http\Middleware\ServerIdentityHeader;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

// Pycore audio-orchestration output. Contract: docs_fix/
// REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md "W5 contract".
// Ingest runs at the pycore worker trust level of ai_tools/article/worker/*.
// Delivery diffs (formerly ingest/probe) live in AppQyV1Delivery.php (kind orch_output).
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->middleware(ServerIdentityHeader::class)
    ->prefix('app_qy_v1/orch_audio/ingest')
    ->group(function () {
        Route::post('/tasks', [AppQyV1OrchAudioCtl::class, 'ingestTasks']);
        Route::post('/segment-audio', [AppQyV1OrchAudioCtl::class, 'ingestSegmentAudio']);
    });

Route::prefix('app_qy_v1/orch_audio')->middleware('auth:sanctum')->group(function () {
    Route::get('/tasks', [AppQyV1OrchAudioCtl::class, 'index']);
    Route::get('/tasks/{taskKey}', [AppQyV1OrchAudioCtl::class, 'show'])
        ->where('taskKey', '[a-f0-9]{40}');
});
