<?php

use App\Support\ApiComputeCatalog;
use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationQueueController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSQueueController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSWorkerController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1AudioBundleCtl;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1AudioLookupCtl;
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
    // The live test spends provider quota, so it is an operator action.
    Route::prefix('ai')->group(function () {
        Route::get('/status', [AppQyV1AIStatusController::class, 'status']);
        Route::post('/test', [AppQyV1AIStatusController::class, 'test'])->middleware('dashboard.auth');
    });

    // Vocabulary cover pipeline panel (dashboard): public status read, retry
    // for operators and machines.
    Route::get('/cover-status', [AppQyV1AIStatusController::class, 'coverStatus']);
    Route::post('/cover-retry', [AppQyV1AIStatusController::class, 'coverRetry'])->middleware('client.key_or_dashboard');
    
    Route::prefix('tts')->group(function () {
        Route::get('/languages', [AppQyV1TTSController::class, 'getLanguages']);
        Route::get('/voices', [AppQyV1TTSController::class, 'getVoices']);
        Route::get('/options', [AppQyV1TTSController::class, 'getOptions']);
        // Direct synthesis used by the TTS tool UI and flutter (signed-in users);
        // batch synthesis is also called by the pycore agent-history pipeline.
        Route::post('/generate', [AppQyV1TTSController::class, 'generate'])->middleware('dashboard.auth:user');
        Route::post('/batch-generate', [AppQyV1TTSController::class, 'batchGenerate'])->middleware('client.key_or_dashboard');
        Route::get('/queue/stats', [AppQyV1TTSQueueController::class, 'getStatistics']);
        Route::get('/queue/metrics', [AppQyV1TTSQueueController::class, 'getMetrics']);
        Route::get('/queue/performance', [AppQyV1TTSQueueController::class, 'getPerformanceMetrics']);
        Route::get('/queue/logs', [AppQyV1TTSQueueController::class, 'getLogs']);
        Route::get('/audio/{language}/{type}/{speed}/{filename}', [AppQyV1TTSController::class, 'serveAudioWithSpeed']);
        Route::get('/audio/{language}/{type}/{filename}', [AppQyV1TTSController::class, 'serveAudio']);
        Route::post('/queue/batch/add', [AppQyV1TTSQueueController::class, 'batchAddTasks'])->middleware('client.key_or_dashboard');
        Route::post('/queue/batch/get', [AppQyV1TTSQueueController::class, 'batchGetTasks']);
        
        // Legacy queue endpoints (backward compatibility)
        Route::post('/queue_batch', [AppQyV1TTSController::class, 'queueBatch'])->middleware('client.key_or_dashboard');
        Route::get('/queue/status', [AppQyV1TTSController::class, 'checkQueueStatus']);
        Route::post('/queue/check_batch', [AppQyV1TTSController::class, 'checkBatchStatus']);

        // pycore word-audio result report-back (client key); work comes from the
        // word_audio lane, never from a row claim.
        Route::post('/worker/report', [AppQyV1TTSWorkerController::class, 'report'])->middleware(['client.key', 'schema.gate']);

        // Sentence-library audio surface (pycore worker + FE resolve). File on
        // disk is the source of truth; see
        // development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md §4.1-§4.3.
        // Reports come from pycore (client key); the claim summary is also
        // read by laravel-manager. Every artifact is validated server-side.
        Route::post('/sentence/claim', [AppQyV1SentenceAudioController::class, 'claim'])->middleware(['client.key_or_dashboard', 'schema.gate']);
        Route::post('/sentence/report', [AppQyV1SentenceAudioController::class, 'report'])->middleware(['client.key', 'schema.gate']);
        Route::get('/sentence/audio', [AppQyV1SentenceAudioController::class, 'audio'])->middleware('schema.gate');
        Route::post('/sentence/audio/head', [AppQyV1SentenceAudioController::class, 'moveAudioToHead'])->middleware(ApiComputeCatalog::AUTH_MIDDLEWARE);
        // Many word / sentence clips in one framed response (clip bundle, shared with pycore).
        Route::post('/audio/bundle', [AppQyV1AudioBundleCtl::class, 'bundle']);
        // Read-only word / sentence audio URL lookup (no queue write, no head move).
        Route::post('/audio/lookup', [AppQyV1AudioLookupCtl::class, 'lookup'])->middleware('client.key_or_dashboard:user');
        Route::get('/sentence/missing', [AppQyV1SentenceAudioController::class, 'missing'])->middleware('schema.gate');
        Route::get('/sentence/without_audio', [AppQyV1SentenceAudioController::class, 'withoutAudio'])->middleware('schema.gate');

        // Voice-variant specs CRUD (per-lang accent/gender voices). Drives the
        // "N voices per sentence/word" default; count is dynamic via
        // variantsForLanguage(). Browser UI and pycore workers share this API.
        Route::get('/variant-specs', [AppQyV1TtsVariantSpecController::class, 'index']);
        Route::middleware('client.key_or_dashboard')->group(function () {
            Route::post('/variant-specs', [AppQyV1TtsVariantSpecController::class, 'store']);
            Route::delete('/variant-specs', [AppQyV1TtsVariantSpecController::class, 'destroy']);
        });
    });

    Route::prefix('article')->group(function () {
        Route::get('/task/{taskId}', [AppQyV1ArticleController::class, 'getTaskStatus']);
        // Agent-history ingest and the durable audio writeback receipt of the
        // pycore legacy-audio rebuild lane (client key).
        Route::middleware('client.key')->group(function () {
            Route::post('/worker/submit', [AppQyV1ArticleController::class, 'workerSubmit']);
            Route::post('/worker/replace-audio', [AppQyV1ArticleController::class, 'workerReplaceAudio']);
        });
        Route::get('/worker/recent', [AppQyV1ArticleController::class, 'workerRecent']);
        // Short/daily-sentences aliases (type=short | article_type=short).
        // Replaces /api/app_qy_v1/daily-sentences/*; old routes remain as wrappers.
        Route::get('/list', [AppQyV1ArticleController::class, 'listArticles']);
        Route::get('/recommend', [AppQyV1ArticleController::class, 'recommendArticle']);
        Route::get('/audio/{id}', [AppQyV1ArticleController::class, 'shortAudio']);
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
// browser UI, mcp-chrome and pycore workers). Reads stay public; mutations take
// the client key (machines) or an operator login. list/priority/stack operate
// over the same word_translation global_tasks substrate as batch/add. Reachable at
// /api/app_qy_v1/ai_tools/translation/queue/{list,priority,stack}.
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix('app_qy_v1/ai_tools/translation/queue')
    ->group(function () {
        Route::get('/list', [AppQyV1TranslationQueueController::class, 'controlList']);
        // Dictionary-driven pending view (untranslated, non-invalid words) + the
        // matching enqueue action — feeds the chrome-mcp Bing-assist panel's
        // two-step "Load queue" / "Confirm & Start" flow.
        Route::get('/pending-words', [AppQyV1TranslationQueueController::class, 'controlPendingWords']);
        Route::post('/enqueue-pending', [AppQyV1TranslationQueueController::class, 'controlEnqueuePending'])
            ->middleware('client.key_or_dashboard');
        // Chrome-assist intake: the MCP-driven chrome extension pushes scraped
        // Bing results straight into the dictionary via the canonical
        // write-back (no global-task worker round-trip), signed with the client
        // key. Body: { language, target_language?, source?,
        // translations:[...], invalidWords:[...], regionRedirectWords:[...] }.
        Route::post('/submit-bing', [AppQyV1TranslationQueueController::class, 'submitBing'])
            ->middleware('client.key');
        // Detailed processing-history view over terminal word_translation tasks
        // (completed + failed) — feeds the laravel-manager "Translation History".
        Route::get('/history', [AppQyV1TranslationQueueController::class, 'controlHistory']);
        Route::middleware('client.key_or_dashboard')->group(function () {
            Route::post('/priority', [AppQyV1TranslationQueueController::class, 'controlPriority']);
            Route::post('/stack', [AppQyV1TranslationQueueController::class, 'controlStack']);
        });
    });

// Task Center manual enqueue (control plane): pycore / chrome-mcp sign with
// the client key, operators log in. Creates AppQyV1 global tasks
// (notebooklm / gemini_image / word_*) so the chrome Task Center has work to pull.
//   POST /api/app_qy_v1/ai_tools/task/enqueue
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->middleware('client.key_or_dashboard')
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
