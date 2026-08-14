<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationQueueController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSQueueController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSWorkerController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1WordImageQueueController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1SentenceAudioController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TtsVariantSpecController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1ArticleController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1ArticleManagementCtl;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1AIStatusController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TaskEnqueueController;
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
    Route::get('/articles', [AppQyV1ArticleManagementCtl::class, 'index']);
    Route::delete('/articles/{articleId}', [AppQyV1ArticleManagementCtl::class, 'destroy'])
        ->middleware('dashboard.auth');
    Route::post('/articles/batch-delete', [AppQyV1ArticleManagementCtl::class, 'destroyMany'])
        ->middleware('dashboard.auth');
    
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
        // Direct synthesis used by the TTS tool UI (FE calls POST /ai_tools/tts/generate);
        // the controller methods existed but the routes were never registered -> 404.
        Route::post('/generate', [AppQyV1TTSController::class, 'generate']);
        Route::post('/batch-generate', [AppQyV1TTSController::class, 'batchGenerate']);
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

        // Sentence-library audio surface (pycore worker + FE resolve). File on
        // disk is the source of truth; see
        // development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md §4.1-§4.3.
        // Same NO-AUTH trust level as /worker/* — pycore has no user token and
        // every reported artifact is validated (MP3 magic + on-disk verify).
        Route::post('/sentence/claim', [AppQyV1SentenceAudioController::class, 'claim']);
        Route::post('/sentence/report', [AppQyV1SentenceAudioController::class, 'report']);
        Route::get('/sentence/audio', [AppQyV1SentenceAudioController::class, 'audio']);
        Route::post('/sentence/audio/head', [AppQyV1SentenceAudioController::class, 'moveAudioToHead']);
        Route::get('/sentence/missing', [AppQyV1SentenceAudioController::class, 'missing']);

        // Voice-variant specs CRUD (per-lang accent/gender voices). Drives the
        // "N voices per sentence/word" default; count is dynamic via
        // variantsForLanguage(). Browser UI and pycore workers share this API.
        Route::get('/variant-specs', [AppQyV1TtsVariantSpecController::class, 'index']);
        Route::post('/variant-specs', [AppQyV1TtsVariantSpecController::class, 'store']);
        Route::delete('/variant-specs', [AppQyV1TtsVariantSpecController::class, 'destroy']);
    });

    Route::prefix('article')->group(function () {
        Route::get('/task/{taskId}', [AppQyV1ArticleController::class, 'getTaskStatus']);
        Route::post('/worker/submit', [AppQyV1ArticleController::class, 'workerSubmit']);
        Route::get('/worker/recent', [AppQyV1ArticleController::class, 'workerRecent']);
        // Short/daily-sentences aliases (type=short | article_type=short).
        // Replaces /api/app_qy_v1/daily-sentences/*; old routes remain as wrappers.
        Route::get('/list', [AppQyV1ArticleController::class, 'listArticles']);
        Route::get('/recommend', [AppQyV1ArticleController::class, 'recommendArticle']);
        Route::get('/audio/{id}', [AppQyV1ArticleController::class, 'shortAudio']);
    });

    // Word-image queue intake (P3). Mirrors the TTS queue batch/add: a re-request
    // with priority 'front' moves the word to the head (PRIORITY_FRONT=100);
    // state lives on the canonical dictionary row's image_* columns. Audio
    // enqueue REUSES the existing tts/queue/batch/add (not duplicated).
    //   POST /api/app_qy_v1/ai_tools/word_image/queue/add
    Route::prefix('word_image')->group(function () {
        Route::post('/queue/add', [AppQyV1WordImageQueueController::class, 'add']);
    });
});

// Async word-translation pipeline (FE-facing). Uses Sanctum bearer authentication.
// shared contract. queue/batch/add enqueues visible words at HIGH priority into
// global_tasks(word_translation); queue/batch/status reads dictionary state.
Route::prefix('app_qy_v1/ai_tools')->middleware('auth:sanctum')->group(function () {
    Route::prefix('translation/queue')->group(function () {
        Route::post('/batch/add', [AppQyV1TranslationQueueController::class, 'batchAdd']);
        Route::post('/batch/status', [AppQyV1TranslationQueueController::class, 'batchStatus']);
    });
});

// Translation-queue CONTROL plane (Phase-B contract, consumed directly by the
// browser UI and by pycore workers). Workers have no user token, so these mirror
// the /api/worker/* approach: NO-AUTH (only Sanctum stateful boot is stripped to
// keep them cheap). list/priority/stack operate over the same word_translation
// global_tasks substrate as batch/add. Reachable at
// /api/app_qy_v1/ai_tools/translation/queue/{list,priority,stack}.
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix('app_qy_v1/ai_tools/translation/queue')
    ->group(function () {
        Route::get('/list', [AppQyV1TranslationQueueController::class, 'controlList']);
        // Dictionary-driven pending view (untranslated, non-invalid words) + the
        // matching enqueue action — feeds the chrome-mcp Bing-assist panel's
        // two-step "Load queue" / "Confirm & Start" flow.
        Route::get('/pending-words', [AppQyV1TranslationQueueController::class, 'controlPendingWords']);
        Route::post('/enqueue-pending', [AppQyV1TranslationQueueController::class, 'controlEnqueuePending']);
        // Public chrome-assist intake: the MCP-driven chrome extension pushes
        // scraped Bing results straight into the dictionary via the canonical
        // write-back (no global-task worker round-trip). Same no-auth group as
        // pending-words. Body: { language, target_language?, source?,
        // translations:[...], invalidWords:[...], regionRedirectWords:[...] }.
        Route::post('/submit-bing', [AppQyV1TranslationQueueController::class, 'submitBing']);
        // Detailed processing-history view over terminal word_translation tasks
        // (completed + failed) — feeds the laravel-manager "Translation History".
        Route::get('/history', [AppQyV1TranslationQueueController::class, 'controlHistory']);
        Route::post('/priority', [AppQyV1TranslationQueueController::class, 'controlPriority']);
        Route::post('/stack', [AppQyV1TranslationQueueController::class, 'controlStack']);
    });

// Task Center manual enqueue (control plane). Same NO-AUTH trust level as the
// translation-queue control plane and the /api/worker/* surface — pycore /
// chrome-mcp callers have no user token, only Sanctum's stateful boot is
// stripped. Creates AppQyV1 global tasks (notebooklm / gemini_image / word_*)
// so the chrome Task Center has work to pull.
//   POST /api/app_qy_v1/ai_tools/task/enqueue
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix('app_qy_v1/ai_tools/task')
    ->group(function () {
        Route::post('/enqueue', [AppQyV1TaskEnqueueController::class, 'enqueue']);
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
        // Idempotent backfill: map existing article(s) into the shared library (§13.2).
        Route::post('/backfill-library', [AppQyV1ArticleController::class, 'backfillLibrary']);
    });
});
