<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationQueueController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSQueueController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSWorkerController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1ArticleController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1AIStatusController;
use App\Providers\PathMapper;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::prefix('app_qy_v1')->group(function () {
    Route::get('/invitation-code', function() {
        $invitationCodeFile = PathMapper::getLaravelDataDir() . '/app_qy_v1_invitation_code.json';
        
        if (file_exists($invitationCodeFile)) {
            $data = json_decode(file_get_contents($invitationCodeFile), true);
            $code = $data['invitation_code'] ?? '';
            
            if (strlen($code) >= 3) {
                $first = substr($code, 0, 2);
                $last = substr($code, -1);
                $masked = $first . str_repeat('*', strlen($code) - 3) . $last;
                
                return response()->json([
                    'success' => true,
                    'masked_code' => $masked
                ]);
            }
        }
        
        return response()->json([
            'success' => false,
            'masked_code' => 'AP**********5'
        ]);
    });
});

Route::prefix('app_qy_v1/ai_tools')->group(function () {
    
    Route::prefix('translation')->group(function () {
        Route::get('/languages', [AppQyV1TranslationController::class, 'getLanguages']);
        Route::get('/types', [AppQyV1TranslationController::class, 'getTypes']);
        Route::get('/models', [AppQyV1TranslationController::class, 'getModels']);
        Route::get('/templates', [AppQyV1TranslationController::class, 'getTemplates']);
    });

    // AI provider status (health-style, public). Live availability of the
    // translation fallback providers. JSON aligned with pycore /api/local/ai/probe.
    Route::prefix('ai')->group(function () {
        Route::get('/status', [AppQyV1AIStatusController::class, 'status']);
        Route::post('/test', [AppQyV1AIStatusController::class, 'test']);
    });

    // Vocabulary cover pipeline panel (dashboard). Same trust level as
    // /ai/status: public health-style endpoints, no user data exposed.
    Route::get('/cover-status', [AppQyV1AIStatusController::class, 'coverStatus']);
    Route::post('/cover-retry', [AppQyV1AIStatusController::class, 'coverRetry']);
    
    Route::prefix('tts')->group(function () {
        Route::get('/languages', [AppQyV1TTSController::class, 'getLanguages']);
        Route::get('/voices', [AppQyV1TTSController::class, 'getVoices']);
        Route::get('/options', [AppQyV1TTSController::class, 'getOptions']);
        Route::get('/queue/stats', [AppQyV1TTSQueueController::class, 'getStatistics']);
        Route::get('/queue/metrics', [AppQyV1TTSQueueController::class, 'getMetrics']);
        Route::get('/queue/performance', [AppQyV1TTSQueueController::class, 'getPerformanceMetrics']);
        Route::get('/queue/logs', [AppQyV1TTSQueueController::class, 'getLogs']);
        Route::get('/audio/{language}/{type}/{speed}/{filename}', [AppQyV1TTSController::class, 'serveAudioWithSpeed']);
        Route::get('/audio/{language}/{type}/{filename}', [AppQyV1TTSController::class, 'serveAudio']);
        Route::post('/queue/batch/add', [AppQyV1TTSQueueController::class, 'batchAddTasks']);
        Route::post('/queue/batch/get', [AppQyV1TTSQueueController::class, 'batchGetTasks']);
        
        // Legacy queue endpoints (backward compatibility)
        Route::post('/queue_batch', [AppQyV1TTSController::class, 'queueBatch']);
        Route::get('/queue/status', [AppQyV1TTSController::class, 'checkQueueStatus']);
        Route::post('/queue/check_batch', [AppQyV1TTSController::class, 'checkBatchStatus']);

        // External worker surface (pycore): claim pending words from the
        // canonical dictionary tables + validated result report-back.
        Route::post('/worker/claim', [AppQyV1TTSWorkerController::class, 'claim']);
        Route::post('/worker/report', [AppQyV1TTSWorkerController::class, 'report']);
    });

    Route::prefix('article')->group(function () {
        Route::get('/task/{taskId}', [AppQyV1ArticleController::class, 'getTaskStatus']);
    });
});

// Async word-translation pipeline (FE-facing). Uses custom.authenticate per the
// shared contract. queue/batch/add enqueues visible words at HIGH priority into
// global_tasks(word_translation); queue/batch/status reads dictionary state.
Route::prefix('app_qy_v1/ai_tools')->middleware('custom.authenticate')->group(function () {
    Route::prefix('translation/queue')->group(function () {
        Route::post('/batch/add', [AppQyV1TranslationQueueController::class, 'batchAdd']);
        Route::post('/batch/status', [AppQyV1TranslationQueueController::class, 'batchStatus']);
    });
});

// Translation-queue CONTROL plane (Phase-B contract, consumed by pycore's queue
// monitor). pycore is a server-side caller with no user token, so these mirror
// the /api/worker/* approach: NO-AUTH (only Sanctum stateful boot is stripped to
// keep them cheap). list/priority/stack operate over the same word_translation
// global_tasks substrate as batch/add. Reachable at
// /api/app_qy_v1/ai_tools/translation/queue/{list,priority,stack}.
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix('app_qy_v1/ai_tools/translation/queue')
    ->group(function () {
        Route::get('/list', [AppQyV1TranslationQueueController::class, 'controlList']);
        Route::post('/priority', [AppQyV1TranslationQueueController::class, 'controlPriority']);
        Route::post('/stack', [AppQyV1TranslationQueueController::class, 'controlStack']);
    });

Route::prefix('app_qy_v1/ai_tools')->middleware('auth:sanctum')->group(function () {

    Route::prefix('translation')->group(function () {
        Route::post('/translate', [AppQyV1TranslationController::class, 'translate']);
        Route::post('/batch', [AppQyV1TranslationController::class, 'batchTranslate']);
        Route::post('/simple/google', [AppQyV1TranslationController::class, 'simpleTranslateWithGoogle']);
        Route::post('/learning', [AppQyV1TranslationController::class, 'learningMode']);
        Route::get('/task/{taskId}', [AppQyV1TranslationController::class, 'getTaskStatus']);
        Route::post('/process-next', [AppQyV1TranslationController::class, 'processNextTask']);
    });
    
    Route::prefix('tts')->group(function () {
        Route::post('/generate', [AppQyV1TTSController::class, 'generate']);
        Route::post('/batch-generate', [AppQyV1TTSController::class, 'batchGenerate']);

        // Unified queue endpoints (new API)
        Route::post('/queue/add', [AppQyV1TTSQueueController::class, 'addTask']);
        Route::post('/queue/batch/query', [AppQyV1TTSQueueController::class, 'intelligentBatchQuery']);
        Route::get('/queue/summary', [AppQyV1TTSQueueController::class, 'getQueueSummary']);
        Route::get('/queue/completed', [AppQyV1TTSQueueController::class, 'getCompletedTasks']);
        Route::get('/queue/task/{taskId}', [AppQyV1TTSQueueController::class, 'getTask']);
        Route::post('/queue/requeue-failed', [AppQyV1TTSQueueController::class, 'requeueFailedTasks']);
        Route::post('/queue/add-at-position', [AppQyV1TTSQueueController::class, 'addTaskAtPosition']);
    });

    Route::prefix('article')->group(function () {
        Route::post('/submit', [AppQyV1ArticleController::class, 'submitArticle']);
        Route::post('/preview', [AppQyV1ArticleController::class, 'previewParsing']);
    });
});
