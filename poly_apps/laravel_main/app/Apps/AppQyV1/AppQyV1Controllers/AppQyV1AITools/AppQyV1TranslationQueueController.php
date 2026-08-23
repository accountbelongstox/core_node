<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationRealtimeService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordTranslationQueueService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BingTranslationIntakeService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * HTTP control plane for the shared asynchronous word-translation queue.
 */
class AppQyV1TranslationQueueController extends Controller
{
    use ApiResponse;

    // Visible (FE) words jump the queue ahead of the background scan (LOW = 0).
    private const PRIORITY_HIGH = AppQyV1WordTranslationQueueService::PRIORITY_HIGH;

    // A word the user is actively looking at outranks even the batch-visible
    // words, so its translation lands first.
    // Sane clamp range for the control-plane priority endpoint.
    private const PRIORITY_MIN = 0;
    private const PRIORITY_MAX = 1000;

    private AppQyV1WordTranslationQueueService $queue;
    private AppQyV1TranslationRealtimeService $realtime;
    private AppQyV1BingTranslationIntakeService $bingIntake;

    public function __construct(
        AppQyV1WordTranslationQueueService $queue,
        AppQyV1TranslationRealtimeService $realtime,
        AppQyV1BingTranslationIntakeService $bingIntake
    )
    {
        $this->queue = $queue;
        $this->realtime = $realtime;
        $this->bingIntake = $bingIntake;
    }

    /**
     * POST /api/app_qy_v1/ai_tools/translation/queue/batch/add
     *
     * Body: { words:[string], language, target_language }
     *
     * Per word:
     *   - already has translations[target_language]      -> "already_translated"
     *   - already in a PENDING word_translation task     -> bump that task to
     *                                                        HIGH, "moved_to_front"
     *   - otherwise                                       -> "queued" (collected
     *                                                        into new HIGH tasks)
     * A minimal dictionary row is ensured for every word.
     */
    public function batchAdd(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'words' => 'required|array|min:1',
            'words.*' => 'required|string',
            'language' => 'required|string',
            'target_language' => 'required|string',
            // FE fast-track: a user-initiated single lookup sends interactive=true
            // so the new task lands on the shared remote_fast lane (capability
            // 'translate') at the FAST priority tier, claimable by mcp-chrome.
            'interactive' => 'nullable|boolean',
            // Opt-in translation engine. 'google' (default) keeps the existing
            // Google/Bing-eligible path (capability 'translate'). 'ai' tags the
            // interactive task with capability 'ai_translate' instead. Both
            // capabilities remain mcp-chrome-owned; task_type stays
            // 'word_translation' either way.
            'engine' => 'nullable|string|in:google,ai',
        ]);

        $interactive = (bool) ($validated['interactive'] ?? false);
        $engine = $validated['engine'] ?? 'google';

        // Shared enqueue/dedup logic (move-to-front + HIGH-priority enqueue).
        $outcome = $this->queue->stackWords(
            $validated['words'],
            $validated['language'],
            $validated['target_language'],
            $interactive ? max(self::PRIORITY_HIGH, GlobalTask::priority('fast')) : self::PRIORITY_HIGH,
            $interactive,
            $engine
        );

        return $this->success([
            'results' => $outcome['results'],
            'queued' => $outcome['queued'],
            'skipped' => $outcome['skipped'],
            'moved' => $outcome['moved'],
        ], 'Word translation batch processed');
    }

    /**
     * POST /api/app_qy_v1/ai_tools/translation/queue/batch/status
     *
     * Body: { words:[string], language, target_language }
     * Returns each word's current translation state read straight from the
     * dictionary translations[target_language] map (same data the words list
     * and write-back use).
     */
    public function batchStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'words' => 'required|array|min:1',
            'words.*' => 'required|string',
            'language' => 'required|string',
            'target_language' => 'required|string',
        ]);

        $langCode = AppQyV1DictionaryService::getLanguageCode($validated['language']);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($validated['target_language']);

        // Load all requested words in ONE query (was a findByMd5 per word — this
        // endpoint is polled every few seconds while words are pending).
        $md5ByWord = [];
        foreach ($validated['words'] as $rawWord) {
            $word = trim($rawWord);
            if ($word !== '') {
                $md5ByWord[$word] = md5($word);
            }
        }
        $existing = AppQyV1LangDictionaryModel::rowsByHashes(
            $langCode,
            array_values($md5ByWord),
            ['md5', 'translations']
        )
            ->keyBy('md5');

        $results = [];
        foreach ($md5ByWord as $word => $md5) {
            $hasTranslation = false;
            $translation = null;

            $entry = $existing->get($md5);
            if ($entry) {
                $translations = $entry->translations;
                if (is_array($translations) && isset($translations[$targetCode]) && $translations[$targetCode] !== '') {
                    $hasTranslation = true;
                    $translation = $translations[$targetCode];
                }
            }

            $results[] = [
                'word' => $word,
                'has_translation' => $hasTranslation,
                'translation' => $translation,
            ];
        }

        return $this->success([
            'results' => $results,
        ], 'Word translation status retrieved');
    }

    /**
     * GET /api/app_qy_v1/ai_tools/translation/queue/list?status=pending&limit=100
     *
     * CONTROL plane (no-auth, pycore-reachable). Lists word_translation tasks
     * ordered priority desc, created_at asc, plus a status summary. Shape matches
     * the shared Phase-B contract that pycore's queue monitor consumes.
     */
    public function controlList(Request $request): JsonResponse
    {
        $startTime = microtime(true);
        $requestId = $request->header('X-Request-ID', uniqid('req_', true));

        $validated = $request->validate([
            'status' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:1000',
            // Server-side pagination: pass either `page` (1-based) OR a raw
            // `offset`. `page` wins when both are given (offset = (page-1)*limit).
            'offset' => 'nullable|integer|min:0',
            'page' => 'nullable|integer|min:1',
        ]);

        $limit = 100;
        if (isset($validated['limit'])) {
            $limit = (int) $validated['limit'];
        }

        $offset = 0;
        if (isset($validated['page'])) {
            $offset = ((int) $validated['page'] - 1) * $limit;
        } elseif (isset($validated['offset'])) {
            $offset = (int) $validated['offset'];
        }
        if ($offset < 0) {
            $offset = 0;
        }

        // Summary counts across all word_translation tasks (not just the page).
        // pycore's queue monitor polls controlList on a tight interval, and the old
        // code ran five separate full-history count() queries on EVERY poll. We
        // cache the summary block for a short TTL so a burst of polls reuses one
        // computation; the cached value is replaced by a SINGLE grouped query
        // (status, count(*) ... GROUP BY status) instead of five counts. The
        // `items` page query below stays live (uncached). Response shape (keys
        // pending/processing/completed/failed/total) is byte-identical.
        $grouped = GlobalTask::cachedStatusCounts(
            'appqyv1:wordtrans_queue_summary',
            8,
            'AppQyV1',
            'word_translation'
        );

        $countFor = static function (array $statuses) use ($grouped): int {
            $sum = 0;
            foreach ($statuses as $status) {
                if ($grouped->has($status)) {
                    $sum += (int) $grouped->get($status);
                }
            }
            return $sum;
        };

        $pending = $countFor([GlobalTask::status('pending')]);
        $processing = $countFor([GlobalTask::status('processing')]);
        $leased = $countFor([GlobalTask::status('assigned')]);
        $completed = $countFor([GlobalTask::status('completed'), GlobalTask::status('completed_demo')]);
        $failed = $countFor([GlobalTask::status('failed')]);

        $total = 0;
        foreach ($grouped as $value) {
            $total += (int) $value;
        }

        $summary = [
            'pending' => $pending,
            'processing' => $processing,
            'leased' => $leased,
            'completed' => $completed,
            'failed' => $failed,
            'total' => $total,
        ];

        // Page query uses the same mutually exclusive status buckets as the
        // Queue Center contract; unknown/empty status returns all. The status
        // filter is applied to a base BEFORE counting so the pagination total
        // matches exactly what the (status-filtered) page draws from.
        $requestedStatus = $validated['status'] ?? '';
        $summaryTotalKey = match ($requestedStatus) {
            'pending' => 'pending',
            'processing' => 'processing',
            'assigned' => 'leased',
            'completed' => 'completed',
            'failed' => 'failed',
            '' => 'total',
            default => null,
        };
        $statuses = match ($requestedStatus) {
            'completed' => [GlobalTask::status('completed'), GlobalTask::status('completed_demo')],
            '' => [],
            default => [$requestedStatus],
        };
        $page = GlobalTask::filteredPageForAppType(
            'AppQyV1',
            'word_translation',
            $statuses,
            $offset,
            $limit,
            ['task_id', 'payload', 'priority', 'status', 'created_at', 'assigned_to']
        );
        $filteredTotal = $summaryTotalKey !== null
            ? (int) ($summary[$summaryTotalKey] ?? 0)
            : (int) $page['total'];

        $now = now();
        $items = [];
        foreach ($page['rows'] as $task) {
            $payload = $task->payload;
            if (!is_array($payload)) {
                $payload = [];
            }

            $words = GlobalTask::displayWordsFromPayload($payload);
            $wordCount = count($words);
            if (isset($payload['word_count'])) {
                $wordCount = (int) $payload['word_count'];
            }

            $language = '';
            if (isset($payload['language'])) {
                $language = $payload['language'];
            }
            $targetLanguage = '';
            if (isset($payload['target_language'])) {
                $targetLanguage = $payload['target_language'];
            }

            $ageSeconds = 0;
            if ($task->created_at !== null) {
                $ageSeconds = $task->created_at->diffInSeconds($now);
            }

            $createdAt = null;
            if ($task->created_at !== null) {
                $createdAt = $task->created_at->toIso8601String();
            }

            $items[] = [
                'task_id' => $task->task_id,
                'words' => $words,
                'word_count' => $wordCount,
                'language' => $language,
                'target_language' => $targetLanguage,
                'priority' => (int) $task->priority,
                'status' => $task->status,
                'created_at' => $createdAt,
                'age_seconds' => $ageSeconds,
                'assigned_to' => $task->assigned_to,
            ];
        }

        $durationMs = round((microtime(true) - $startTime) * 1000, 2);
        Log::info('[QueueCenter] controlList accessed', [
            'request_id' => $requestId,
            'client' => $request->ip(),
            'status_filter' => $validated['status'] ?? 'all',
            'database' => 'global_tasks',
            'table' => 'global_tasks',
            'items_returned' => count($items),
            'total_filtered' => $filteredTotal,
            'duration_ms' => $durationMs,
        ]);

        return $this->success([
            'summary' => $summary,
            'items' => $items,
            'source' => 'global_tasks',
            'generated_at' => now()->toIso8601String(),
            // Server-side pagination metadata (additive; existing consumers that
            // only read summary/items are unaffected).
            'pagination' => [
                'limit' => $limit,
                'offset' => $offset,
                'page' => (int) floor($offset / max(1, $limit)) + 1,
                'total' => $filteredTotal,
                'has_more' => ($offset + count($items)) < $filteredTotal,
            ],
        ], 'Translation queue listed');
    }

    /**
     * GET /api/app_qy_v1/ai_tools/translation/queue/pending-words
     *
     * CONTROL plane (no-auth). DICTIONARY-driven pending view used by the
     * chrome-mcp Bing-assist panel: it reports the words that still need a
     * translation straight from the per-language dictionary ("sys:init" data) —
     * a word is PENDING when it has NO translation yet AND is not explicitly
     * invalid (is_valid stays true for both valid and not-yet-checked rows).
     *
     * This differs from controlList (which reports the global_tasks work queue):
     * controlList shows what is QUEUED, this shows what REMAINS to translate so
     * the panel can preview real untranslated words even before any task exists.
     * Clicking Start calls enqueuePending to turn these into worker tasks.
     *
     * Query: language?(en) · target_language?(zh) · limit?(1..1000) · page?|offset?
     * Response shape matches controlList (summary/items/pagination) so the panel
     * renders it with no changes.
     *
     * MANY-TO-MANY partitioning: the optional `offset` lets multiple chrome
     * clients split the top-query_count pending words so they don't all process
     * the same head of the list (client A offset=0, client B offset=N, ...).
     * Default offset 0. This is purely a wasted-work optimization, NOT a
     * correctness requirement: the task layer already makes duplicate processing
     * safe — stackWords moves an already-queued word to front (no duplicate task)
     * and every write goes through fill-missing write-back, so two clients that
     * happen to grab the same word never corrupt or double-write it.
     */
    public function controlPendingWords(Request $request): JsonResponse
    {
        $startTime = microtime(true);
        $requestId = $request->header('X-Request-ID', uniqid('req_', true));

        $validated = $request->validate([
            'language' => 'nullable|string',
            'target_language' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:1000',
            'offset' => 'nullable|integer|min:0',
            'page' => 'nullable|integer|min:1',
        ]);

        $language = 'en';
        if (isset($validated['language']) && $validated['language'] !== '') {
            $language = $validated['language'];
        }
        $targetLanguage = 'zh';
        if (isset($validated['target_language']) && $validated['target_language'] !== '') {
            $targetLanguage = $validated['target_language'];
        }
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);

        $limit = 10;
        if (isset($validated['limit'])) {
            $limit = (int) $validated['limit'];
        }
        $offset = 0;
        if (isset($validated['page'])) {
            $offset = ((int) $validated['page'] - 1) * $limit;
        } elseif (isset($validated['offset'])) {
            $offset = (int) $validated['offset'];
        }
        if ($offset < 0) {
            $offset = 0;
        }

        // Dictionary-driven counts. Cached briefly (the panel reloads on demand,
        // not on a tight interval) so repeated loads reuse one set of table counts.
        $summary = AppQyV1LangDictionaryModel::cachedPendingTranslationSummary($langCode);

        // Live crawl activity: word_translation tasks currently assigned/processing
        // for this language pair (real-time, uncached).
        $activity = GlobalTask::cachedStatusCounts(
            'appqyv1:wordtrans_pending_activity:' . $langCode . ':' . $targetCode,
            10,
            'AppQyV1',
            'word_translation',
            ['language' => $langCode, 'target_language' => $targetCode]
        );
        $leased = (int) ($activity[GlobalTask::status('assigned')] ?? 0);
        $processing = $leased + (int) ($activity[GlobalTask::status('processing')] ?? 0);

        // The requested page of untranslated words to preview (most-queried first).
        $pageWords = AppQyV1LangDictionaryModel::untranslatedContents($langCode, $offset, $limit);

        // One synthetic batch item per page so the existing panel (which renders
        // item.words) shows the untranslated words without any UI change.
        $items = [];
        if (!empty($pageWords)) {
            $items[] = [
                'task_id' => 'pending-words:' . $langCode . ':' . $offset,
                'words' => $pageWords,
                'word_count' => count($pageWords),
                'language' => $langCode,
                'target_language' => $targetCode,
                'priority' => 0,
                'status' => 'pending',
                'created_at' => null,
                'age_seconds' => 0,
                'assigned_to' => null,
            ];
        }

        $pendingTotal = (int) $summary['pending'];
        $durationMs = round((microtime(true) - $startTime) * 1000, 2);
        
        Log::info('[QueueCenter] controlPendingWords accessed', [
            'request_id' => $requestId,
            'client' => $request->ip(),
            'language' => $langCode,
            'target_language' => $targetCode,
            'database' => 'appqyv1_lang_dictionary',
            'table' => AppQyV1LangDictionaryModel::forLanguage($langCode)->getTable(),
            'items_returned' => count($items),
            'total_pending' => $pendingTotal,
            'duration_ms' => $durationMs,
        ]);

        return $this->success([
            'summary' => [
                'pending' => $pendingTotal,
                'processing' => $processing,
                'leased' => $leased,
                'completed' => (int) $summary['completed'],
                'failed' => (int) $summary['failed'],
                'total' => (int) $summary['total'],
            ],
            'items' => $items,
            'source' => 'appqyv1_lang_dictionary',
            'generated_at' => now()->toIso8601String(),
            'pagination' => [
                'limit' => $limit,
                'offset' => $offset,
                'page' => (int) floor($offset / max(1, $limit)) + 1,
                'total' => $pendingTotal,
                'has_more' => ($offset + count($pageWords)) < $pendingTotal,
            ],
        ], 'Pending words listed');
    }

    /**
     * POST /api/app_qy_v1/ai_tools/translation/queue/enqueue-pending
     *
     * CONTROL plane (no-auth). Turns dictionary-pending words (no translation,
     * not invalid) into actual word_translation global tasks at HIGH priority so
     * a worker that just started pulls them ahead of the background scan's LOW
     * batches. Called by the chrome-mcp panel on "Confirm & Start". Reuses the
     * shared stackWords core, so re-clicking is safe (already-queued words are
     * moved-to-front, already-translated / invalid words are skipped).
     *
     * Body: language?(en) · target_language?(zh) · limit?(1..2000, default 200)
     */
    public function controlEnqueuePending(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'nullable|string',
            'target_language' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:2000',
        ]);

        $language = 'en';
        if (isset($validated['language']) && $validated['language'] !== '') {
            $language = $validated['language'];
        }
        $targetLanguage = 'zh';
        if (isset($validated['target_language']) && $validated['target_language'] !== '') {
            $targetLanguage = $validated['target_language'];
        }
        $limit = 200;
        if (isset($validated['limit'])) {
            $limit = (int) $validated['limit'];
        }

        $langCode = AppQyV1DictionaryService::getLanguageCode($language);

        $words = AppQyV1LangDictionaryModel::untranslatedContents($langCode, 0, $limit);

        if (empty($words)) {
            return $this->success([
                'queued' => 0,
                'moved' => 0,
                'skipped' => 0,
                'task_ids' => [],
            ], 'No pending words to enqueue');
        }

        $outcome = $this->queue->stackWords($words, $language, $targetLanguage, self::PRIORITY_HIGH);

        return $this->success([
            'queued' => $outcome['queued'],
            'moved' => $outcome['moved'],
            'skipped' => $outcome['skipped'],
            'task_ids' => $outcome['task_ids'],
        ], 'Pending words enqueued');
    }

    /**
     * GET /api/app_qy_v1/ai_tools/translation/queue/history
     *
     * CONTROL plane (no-auth, dashboard-reachable). A DETAILED processing-history
     * view over TERMINAL word_translation tasks (completed + failed), newest
     * first, with the per-task result (translations + provider) and timing.
     * Read-only and paginated — feeds the laravel-manager "Translation History"
     * panel and aligns with pycore's translation records.
     *
     * Query: status?(completed|failed) · limit?(1..500=50) · page?|offset?
     */
    public function controlHistory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:500',
            'offset' => 'nullable|integer|min:0',
            'page' => 'nullable|integer|min:1',
        ]);

        $limit = isset($validated['limit']) ? (int) $validated['limit'] : 50;

        $offset = 0;
        if (isset($validated['page'])) {
            $offset = ((int) $validated['page'] - 1) * $limit;
        } elseif (isset($validated['offset'])) {
            $offset = (int) $validated['offset'];
        }
        if ($offset < 0) {
            $offset = 0;
        }

        $statuses = [];
        if (isset($validated['status']) && $validated['status'] !== '') {
            if ($validated['status'] === 'completed') {
                $statuses = [GlobalTask::status('completed'), GlobalTask::status('completed_demo')];
            } else {
                $statuses = [$validated['status']];
            }
        } else {
            $statuses = [
                GlobalTask::status('completed'),
                GlobalTask::status('completed_demo'),
                GlobalTask::status('failed'),
            ];
        }

        $page = GlobalTask::filteredPageForAppType(
            'AppQyV1',
            'word_translation',
            $statuses,
            $offset,
            $limit,
            ['*'],
            true
        );
        $filteredTotal = (int) $page['total'];
        $rows = $page['rows'];

        $items = [];
        foreach ($rows as $task) {
            $payload = is_array($task->payload) ? $task->payload : [];
            $result = is_array($task->result) ? $task->result : [];

            $words = GlobalTask::displayWordsFromPayload($payload);

            $translations = [];
            if (isset($result['translations']) && is_array($result['translations'])) {
                $translations = $result['translations'];
            }

            $provider = '';
            if (isset($result['provider'])) {
                $provider = (string) $result['provider'];
            }

            $targetLanguage = '';
            if (isset($result['target_language'])) {
                $targetLanguage = (string) $result['target_language'];
            } elseif (isset($payload['target_language'])) {
                $targetLanguage = (string) $payload['target_language'];
            }

            $createdAt = null;
            if ($task->created_at !== null) {
                $createdAt = $task->created_at->toIso8601String();
            }
            $completedAt = null;
            if ($task->completed_at !== null) {
                $completedAt = $task->completed_at->toIso8601String();
            }
            $durationMs = null;
            if ($task->created_at !== null && $task->completed_at !== null) {
                $durationMs = $task->created_at->diffInMilliseconds($task->completed_at);
            }

            $items[] = [
                'task_id' => $task->task_id,
                'status' => $task->status,
                'words' => $words,
                'word_count' => count($words),
                'language' => (string) ($payload['language'] ?? ''),
                'target_language' => $targetLanguage,
                'provider' => $provider,
                'translations' => $translations,
                'error' => $task->error,
                'retry_count' => (int) $task->retry_count,
                'assigned_to' => $task->assigned_to,
                'created_at' => $createdAt,
                'completed_at' => $completedAt,
                'duration_ms' => $durationMs,
            ];
        }

        return $this->success([
            'items' => $items,
            'pagination' => [
                'limit' => $limit,
                'offset' => $offset,
                'page' => (int) floor($offset / max(1, $limit)) + 1,
                'total' => $filteredTotal,
                'has_more' => ($offset + count($items)) < $filteredTotal,
            ],
        ], 'Translation history listed');
    }

    /**
     * POST /api/app_qy_v1/ai_tools/translation/queue/priority
     *
     * Body: { task_id, priority:int }. CONTROL plane (no-auth, pycore-reachable).
     * Sets a single word_translation task's priority (clamped to a sane range).
     */
    public function controlPriority(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_id' => 'required|string',
            'priority' => 'required|integer',
        ]);

        // Clamp to a sane range so a caller cannot starve every other task.
        $priority = (int) $validated['priority'];
        if ($priority < self::PRIORITY_MIN) {
            $priority = self::PRIORITY_MIN;
        }
        if ($priority > self::PRIORITY_MAX) {
            $priority = self::PRIORITY_MAX;
        }

        $task = GlobalTask::findForAppTypeByTaskId(
            'AppQyV1',
            'word_translation',
            $validated['task_id']
        );

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $oldPriority = (int) $task->priority;
        $task->priority = $priority;
        $task->saveRecord();

        $this->realtime->priority($task->task_id, $priority, $oldPriority);

        return $this->success([
            'task_id' => $task->task_id,
            'priority' => (int) $task->priority,
            'status' => $task->status,
        ], 'Task priority updated');
    }

    /**
     * POST /api/app_qy_v1/ai_tools/translation/queue/stack
     *
     * Body: { words:[string], language, target_language, priority? }. CONTROL
     * plane (no-auth, pycore-reachable). Dedups vs existing PENDING
     * word_translation tasks containing those words and bumps them to the given
     * (or HIGH) priority ("moved_to_front"); enqueues the rest at that priority.
     * Reuses the same enqueue core as batch/add.
     */
    public function controlStack(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'words' => 'required|array|min:1',
            'words.*' => 'required|string',
            'language' => 'required|string',
            'target_language' => 'required|string',
            'priority' => 'nullable|integer',
        ]);

        $priority = self::PRIORITY_HIGH;
        if (isset($validated['priority'])) {
            $priority = (int) $validated['priority'];
            if ($priority < self::PRIORITY_MIN) {
                $priority = self::PRIORITY_MIN;
            }
            if ($priority > self::PRIORITY_MAX) {
                $priority = self::PRIORITY_MAX;
            }
        }

        $outcome = $this->queue->stackWords(
            $validated['words'],
            $validated['language'],
            $validated['target_language'],
            $priority
        );

        return $this->success([
            'moved' => $outcome['moved'],
            'queued' => $outcome['queued'],
            'skipped' => $outcome['skipped'],
            'task_ids' => $outcome['task_ids'],
            'results' => $outcome['results'],
        ], 'Words stacked into translation queue');
    }

    /**
     * Accept direct Bing assist results and pass them through the canonical,
     * fill-missing write-back pipeline. Binary media remains base64-only.
     */
    public function submitBing(Request $request): JsonResponse
    {
        // Accept BOTH casings: this direct-push intake mirrors the worker result
        // shape, which uses snake_case (invalid_words / region_redirect_words),
        // while the FE/control plane uses camelCase. Validating only one casing
        // would SILENTLY drop the other (the placeholders fall through to []).
        $validated = $request->validate([
            'language' => 'required|string',
            'target_language' => 'nullable|string',
            'source' => 'nullable|string',
            'worker_id' => 'nullable|string',
            'translations' => 'nullable|array',
            'invalidWords' => 'nullable|array',
            'invalid_words' => 'nullable|array',
            'regionRedirectWords' => 'nullable|array',
            'region_redirect_words' => 'nullable|array',
        ]);

        $response = $this->bingIntake->apply($validated);

        return $this->success($response, __('runtime.bing_translation_results_applied'));
    }
}
