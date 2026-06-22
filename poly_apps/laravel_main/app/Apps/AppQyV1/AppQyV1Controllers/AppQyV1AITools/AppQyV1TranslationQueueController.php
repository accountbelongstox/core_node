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
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordTranslationWriteback;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Events\TranslationTaskQueuedEvent;
use App\Events\TranslationTaskPriorityEvent;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Word Translation Queue Controller
 *
 * FE-facing front of the async word-translation pipeline. Enqueues visible
 * words at HIGH priority into the shared global_tasks substrate (task_type
 * "word_translation", execution_type "remote_translation"), and reports per
 * word whether a translation already exists in the dictionary.
 *
 * Consumers of the created tasks (atomic claim, no double work):
 *   - pycore worker  (Google, processor_types ["remote_translation"])
 *   - Laravel AI self-filler timer (AppQyV1WordTranslationFillerTask)
 * Both write back through WordTranslationTaskProcessor.
 */
class AppQyV1TranslationQueueController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    // Visible (FE) words jump the queue ahead of the background scan (LOW = 0).
    private const PRIORITY_HIGH = 100;

    // A word the user is actively looking at outranks even the batch-visible
    // words, so its translation lands first.
    private const PRIORITY_ELEVATED = 200;

    // Sane clamp range for the control-plane priority endpoint.
    private const PRIORITY_MIN = 0;
    private const PRIORITY_MAX = 1000;

    // Words per created task. Keeps each task small enough for a worker to
    // finish inside its timeout.
    private const WORDS_PER_TASK = 40;

    private $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
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
            // 'translate') at the FAST priority tier, claimable by either client.
            'interactive' => 'nullable|boolean',
            // Opt-in translation engine. 'google' (default) keeps the existing
            // Google/Bing-eligible path (capability 'translate'). 'ai' tags the
            // interactive task with capability 'ai_translate' instead, so the
            // first idle pycore OR chrome client that advertises ai_translate
            // wins the race. task_type stays 'word_translation' either way.
            'engine' => 'nullable|string|in:google,ai',
        ]);

        $interactive = (bool) ($validated['interactive'] ?? false);
        $engine = $validated['engine'] ?? 'google';

        // Shared enqueue/dedup logic (move-to-front + HIGH-priority enqueue).
        $outcome = $this->stackWords(
            $validated['words'],
            $validated['language'],
            $validated['target_language'],
            $interactive ? max(self::PRIORITY_HIGH, GlobalTask::PRIORITY_FAST) : self::PRIORITY_HIGH,
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
     * Shared enqueue core used by batchAdd and the control-plane stack endpoint.
     *
     * For each de-duplicated word:
     *   - already has translations[target] -> "already_translated" (skipped);
     *   - inside a PENDING word_translation task -> bump that task to $priority,
     *     "moved_to_front";
     *   - otherwise -> collected and chunked into new tasks at $priority, "queued".
     *
     * @return array{
     *   results: array<int, array{word:string, status:string}>,
     *   moved: int, queued: int, skipped: int, task_ids: array<int,string>
     * }
     */
    private function stackWords(array $rawWords, string $language, string $targetLanguage, int $priority, bool $interactive = false, string $engine = 'google'): array
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);

        // De-duplicate the incoming list while preserving order.
        $words = [];
        foreach ($rawWords as $rawWord) {
            $word = trim($rawWord);
            if ($word === '') {
                continue;
            }
            if (!in_array($word, $words, true)) {
                $words[] = $word;
            }
        }

        $results = [];
        $toQueue = [];
        $taskIds = [];
        $skipped = 0;
        $moved = 0;

        // Snapshot of pending word_translation tasks for this (lang,target) pair
        // so we can detect duplicates and bump priority without N queries.
        $pendingIndex = $this->buildPendingWordIndex($langCode, $targetCode);

        // Batch-ensure dictionary rows: ONE select for the existing rows + ONE
        // bulk insert for the missing ones, instead of a findByMd5 (+ createOrFind)
        // per word (a 100-word batch was ~100-200 queries). insertOrIgnore keeps
        // the insert race-safe on the md5 index.
        $md5ByWord = [];
        foreach ($words as $word) {
            $md5ByWord[$word] = md5($word);
        }
        $existing = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->whereIn('md5', array_values($md5ByWord))
            ->get(['md5', 'translations', 'is_valid'])
            ->keyBy('md5');

        $now = now();
        $missingRows = [];
        foreach ($words as $word) {
            if (!$existing->has($md5ByWord[$word])) {
                $missingRows[] = [
                    'content' => $word,
                    'md5' => $md5ByWord[$word],
                    'has_translation' => false,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }
        if (!empty($missingRows)) {
            AppQyV1LangDictionaryModel::forLanguage($langCode)->insertOrIgnore($missingRows);
            AppQyV1LangDictionaryModel::forgetMetricsCache($langCode);
        }

        foreach ($words as $word) {
            // Existing rows carry their translations; a freshly-inserted row has
            // none, so a missing map entry means "not translated yet".
            $existingEntry = $existing->get($md5ByWord[$word]);
            $translations = $existingEntry ? $existingEntry->translations : null;

            // Already translated -> skip.
            if (is_array($translations) && isset($translations[$targetCode]) && $translations[$targetCode] !== '') {
                $results[] = ['word' => $word, 'status' => 'already_translated'];
                $skipped++;
                continue;
            }

            // Explicitly invalid (a client verified the word has no online
            // dictionary entry) -> never enqueue. Freshly-inserted rows are absent
            // from $existing and default to valid, so only known rows are checked.
            if ($existingEntry && $existingEntry->is_valid === false) {
                $results[] = ['word' => $word, 'status' => 'skipped_invalid'];
                $skipped++;
                continue;
            }

            // Already queued -> bump the owning pending task to $priority.
            if (isset($pendingIndex[$word])) {
                $taskId = $pendingIndex[$word];
                $this->bumpTaskPriority($taskId, $priority);
                if (!in_array($taskId, $taskIds, true)) {
                    $taskIds[] = $taskId;
                }
                $results[] = ['word' => $word, 'status' => 'moved_to_front'];
                $moved++;
                continue;
            }

            // Otherwise schedule into a new task at $priority.
            $toQueue[] = $word;
            $results[] = ['word' => $word, 'status' => 'queued'];
        }

        $queued = count($toQueue);

        foreach (array_chunk($toQueue, self::WORDS_PER_TASK) as $chunk) {
            $task = $this->createWordTranslationTask($language, $targetLanguage, $chunk, $priority, $interactive, $engine);
            $taskIds[] = $task->task_id;
        }

        return [
            'results' => $results,
            'moved' => $moved,
            'queued' => $queued,
            'skipped' => $skipped,
            'task_ids' => $taskIds,
        ];
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
        $existing = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->whereIn('md5', array_values($md5ByWord))
            ->get(['md5', 'translations'])
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
        $base = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation');

        $summary = Cache::remember('appqyv1:wordtrans_queue_summary', 8, static function () {
            $grouped = GlobalTask::query()
                ->where('app_name', 'AppQyV1')
                ->where('task_type', 'word_translation')
                ->groupBy('status')
                ->select('status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'status');

            $countFor = static function (array $statuses) use ($grouped): int {
                $sum = 0;
                foreach ($statuses as $status) {
                    if ($grouped->has($status)) {
                        $sum += (int) $grouped->get($status);
                    }
                }
                return $sum;
            };

            $pending = $countFor([GlobalTask::STATUS_PENDING]);
            $processing = $countFor([GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING]);
            $completed = $countFor([GlobalTask::STATUS_COMPLETED, GlobalTask::STATUS_COMPLETED_DEMO]);
            $failed = $countFor([GlobalTask::STATUS_FAILED]);

            $total = 0;
            foreach ($grouped as $value) {
                $total += (int) $value;
            }

            return [
                'pending' => $pending,
                'processing' => $processing,
                'completed' => $completed,
                'failed' => $failed,
                'total' => $total,
            ];
        });

        // Page query. "processing" is treated as the live set (assigned+processing)
        // to mirror the summary; unknown/empty status returns all. The status
        // filter is applied to a base BEFORE counting so the pagination total
        // matches exactly what the (status-filtered) page draws from.
        $pageQuery = (clone $base);
        if (isset($validated['status']) && $validated['status'] !== '') {
            $status = $validated['status'];
            if ($status === 'processing') {
                $pageQuery->whereIn('status', [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING]);
            } elseif ($status === 'completed') {
                $pageQuery->whereIn('status', [GlobalTask::STATUS_COMPLETED, GlobalTask::STATUS_COMPLETED_DEMO]);
            } else {
                $pageQuery->where('status', $status);
            }
        }

        // Total rows matching the filtered query (drives client pagination).
        $filteredTotal = (clone $pageQuery)->count();

        $query = $pageQuery
            ->orderBy('priority', 'desc')
            ->orderBy('created_at', 'asc')
            ->offset($offset)
            ->limit($limit);

        $now = now();
        $items = [];
        foreach ($query->get() as $task) {
            $payload = $task->payload;
            if (!is_array($payload)) {
                $payload = [];
            }

            $words = [];
            if (isset($payload['words']) && is_array($payload['words'])) {
                $words = array_values($payload['words']);
            }

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

        return $this->success([
            'summary' => $summary,
            'items' => $items,
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
        $summary = Cache::remember(
            'appqyv1:wordtrans_pending_summary:' . $langCode,
            8,
            static function () use ($langCode) {
                $pending = AppQyV1LangDictionaryModel::forLanguage($langCode)
                    ->where('has_translation', false)
                    ->where('is_valid', true)
                    ->count();
                $completed = AppQyV1LangDictionaryModel::forLanguage($langCode)
                    ->where('has_translation', true)
                    ->count();
                $failed = AppQyV1LangDictionaryModel::forLanguage($langCode)
                    ->where('is_valid', false)
                    ->count();
                $total = AppQyV1LangDictionaryModel::forLanguage($langCode)->count();

                return [
                    'pending' => $pending,
                    'completed' => $completed,
                    'failed' => $failed,
                    'total' => $total,
                ];
            }
        );

        // Live crawl activity: word_translation tasks currently assigned/processing
        // for this language pair (real-time, uncached).
        $processing = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation')
            ->whereIn('status', [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING])
            ->where('payload->language', $langCode)
            ->where('payload->target_language', $targetCode)
            ->count();

        // The requested page of untranslated words to preview (most-queried first).
        $pageWords = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('has_translation', false)
            ->where('is_valid', true)
            ->orderBy('query_count', 'desc')
            ->offset($offset)
            ->limit($limit)
            ->pluck('content')
            ->all();

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

        return $this->success([
            'summary' => [
                'pending' => $pendingTotal,
                'processing' => $processing,
                'completed' => (int) $summary['completed'],
                'failed' => (int) $summary['failed'],
                'total' => (int) $summary['total'],
            ],
            'items' => $items,
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

        $words = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('has_translation', false)
            ->where('is_valid', true)
            ->orderBy('query_count', 'desc')
            ->limit($limit)
            ->pluck('content')
            ->all();

        if (empty($words)) {
            return $this->success([
                'queued' => 0,
                'moved' => 0,
                'skipped' => 0,
                'task_ids' => [],
            ], 'No pending words to enqueue');
        }

        $outcome = $this->stackWords($words, $language, $targetLanguage, self::PRIORITY_HIGH);

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

        $base = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation');

        // Terminal-only by default (completed + failed); a status filter narrows it.
        if (isset($validated['status']) && $validated['status'] !== '') {
            if ($validated['status'] === 'completed') {
                $base->whereIn('status', [GlobalTask::STATUS_COMPLETED, GlobalTask::STATUS_COMPLETED_DEMO]);
            } else {
                $base->where('status', $validated['status']);
            }
        } else {
            $base->whereIn('status', [
                GlobalTask::STATUS_COMPLETED,
                GlobalTask::STATUS_COMPLETED_DEMO,
                GlobalTask::STATUS_FAILED,
            ]);
        }

        $filteredTotal = (clone $base)->count();

        // Newest first by insert order (id is monotonic) — portable across PG /
        // sqlite and free of NULL-ordering surprises on completed_at.
        $rows = (clone $base)
            ->orderByDesc('id')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $items = [];
        foreach ($rows as $task) {
            $payload = is_array($task->payload) ? $task->payload : [];
            $result = is_array($task->result) ? $task->result : [];

            $words = [];
            if (isset($payload['words']) && is_array($payload['words'])) {
                $words = array_values($payload['words']);
            }

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

        $task = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation')
            ->where('task_id', $validated['task_id'])
            ->first();

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $task->priority = $priority;
        $task->save();

        // Real-time re-order hint for pycore workers (Phase-C `task.priority`).
        $this->broadcastSafely(static function () use ($task, $priority) {
            event(new TranslationTaskPriorityEvent($task->task_id, $priority));
        }, 'task.priority', ['task_id' => $task->task_id]);

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

        $outcome = $this->stackWords(
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
        ], 'Words stacked into translation queue');
    }

    /**
     * Query-path priority bump (cheap, non-blocking helper).
     *
     * Called from the word lookup/query controllers: when the user actively
     * queries a single word that has NO translation for the target language, the
     * word is stacked into the word_translation queue at ELEVATED priority so it
     * is translated before the batch-visible and background words.
     *
     * Dedup is inherited from stackWords (it bumps an existing pending task or
     * skips an already-translated word, never piling duplicates). This is a fire-
     * and-forget call: any failure is swallowed so the lookup response is never
     * slowed or broken by the queue bump.
     */
    public function bumpQueriedWord(string $word, string $language, string $targetLanguage): void
    {
        $word = trim($word);
        if ($word === '' || trim($targetLanguage) === '') {
            return;
        }

        try {
            $this->stackWords([$word], $language, $targetLanguage, self::PRIORITY_ELEVATED);
        } catch (\Throwable $e) {
            // Non-blocking: never let a queue bump break a lookup.
            \Illuminate\Support\Facades\Log::warning('[TranslationQueue] query bump failed', [
                'word' => $word,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Build word -> task_id index over PENDING word_translation tasks for the
     * given language pair, so the add endpoint can de-dup and move-to-front.
     */
    private function buildPendingWordIndex(string $langCode, string $targetCode): array
    {
        $index = [];

        // Filter by the normalized language codes stored in the JSON payload
        // (payload is a real json column), so we load only the pending tasks for
        // THIS (language, target) pair rather than every pending word_translation
        // task. The (app_name, task_type, status) predicate is index-backed; the
        // JSON predicate then runs on that narrow subset in the DB.
        $tasks = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation')
            ->where('status', GlobalTask::STATUS_PENDING)
            ->where('payload->language', $langCode)
            ->where('payload->target_language', $targetCode)
            ->get(['task_id', 'payload']);

        foreach ($tasks as $task) {
            $payload = $task->payload;
            if (!is_array($payload)) {
                continue;
            }

            $taskWords = $payload['words'] ?? [];
            if (!is_array($taskWords)) {
                continue;
            }

            foreach ($taskWords as $taskWord) {
                // First task that owns a word wins; bumping it is enough.
                if (!isset($index[$taskWord])) {
                    $index[$taskWord] = $task->task_id;
                }
            }
        }

        return $index;
    }

    private function bumpTaskPriority(string $taskId, int $priority): void
    {
        $updated = GlobalTask::query()
            ->where('task_id', $taskId)
            ->where('status', GlobalTask::STATUS_PENDING)
            ->where('priority', '<', $priority)
            ->update(['priority' => $priority]);

        // Only signal when a row was actually bumped (Phase-C `task.priority`).
        if ($updated > 0) {
            $this->broadcastSafely(static function () use ($taskId, $priority) {
                event(new TranslationTaskPriorityEvent($taskId, $priority));
            }, 'task.priority', ['task_id' => $taskId]);
        }
    }

    /**
     * Create a single word_translation global task. Payload matches the shared
     * contract so pycore and the self-filler can both consume it.
     */
    private function createWordTranslationTask(
        string $language,
        string $targetLanguage,
        array $words,
        int $priority,
        bool $interactive = false,
        string $engine = 'google'
    ): GlobalTask {
        $timeoutSeconds = 60 + (count($words) * 3);
        if ($timeoutSeconds > 600) {
            $timeoutSeconds = 600;
        }

        // Store NORMALIZED language codes in the JSON payload so the pending-dedup
        // index and the background-scan counter can filter at the DB level
        // (where payload->language = ?) instead of loading every pending task's
        // payload into PHP to normalize and compare. The write-back resolves codes
        // via getLanguageCode() anyway, so a code-form payload is equivalent.
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);

        $payload = [
            'words' => array_values($words),
            'language' => $langCode,
            'target_language' => $targetCode,
            'word_count' => count($words),
        ];

        // interactive=true promotes the task onto the shared remote_fast lane at
        // the FAST priority tier inside createTask, so both the pycore and chrome
        // clients can claim it immediately. The capability tag narrows WHICH
        // client may claim it: engine='ai' tags it 'ai_translate' (both clients
        // advertise it -> intelligent first-idle-wins), otherwise the default
        // 'translate' (Google/Bing-eligible) path is kept unchanged. A
        // non-interactive task carries no capability (any-eligible backfill).
        $capability = null;
        if ($interactive) {
            $capability = $engine === 'ai'
                ? GlobalTask::CAPABILITY_AI_TRANSLATE
                : GlobalTask::CAPABILITY_TRANSLATE;
        }
        $task = $this->taskManager->createTask(
            'AppQyV1',
            'word_translation',
            GlobalTask::EXECUTION_REMOTE_TRANSLATION,
            $payload,
            $timeoutSeconds,
            $priority,
            3,
            $interactive,
            $capability
        );

        // Real-time wake-up for pycore workers (Phase-C `task.queued`). Reverb is
        // the signaling layer only; the HTTP pull/claim flow stays the work
        // transport, so a broadcast failure must never break enqueue.
        $this->broadcastSafely(static function () use ($task, $words, $langCode, $targetCode, $priority) {
            event(new TranslationTaskQueuedEvent(
                $task->task_id,
                array_values($words),
                $langCode,
                $targetCode,
                $priority
            ));
        }, 'task.queued', ['task_id' => $task->task_id]);

        return $task;
    }

    /**
     * Run a broadcast closure best-effort. Broadcasting is a non-blocking signal
     * on top of the reliable HTTP transport, so any failure (Reverb down, etc.)
     * is logged and swallowed rather than allowed to fail the HTTP request.
     */
    private function broadcastSafely(callable $broadcast, string $eventName, array $context = []): void
    {
        try {
            $broadcast();
        } catch (\Throwable $e) {
            Log::warning('[TranslationQueue] broadcast failed', array_merge($context, [
                'event' => $eventName,
                'error' => $e->getMessage(),
            ]));
        }
    }

    /**
     * Public chrome-assist Bing intake (NO-AUTH control plane) — the DIRECT-PUSH
     * TWIN of the worker result path.
     *
     * POST /api/app_qy_v1/ai_tools/translation/queue/submit-bing
     *
     * Two ways Bing results reach the dictionary, both ending in the SAME
     * canonical write-back so there is one source of truth:
     *   1. Worker path: the chrome worker posts to /worker/tasks/result, which
     *      WordTranslationTaskProcessor forwards to
     *      AppQyV1WordTranslationWriteback::apply().
     *   2. THIS direct-push: an MCP host driving chrome_bing_dictionary submits
     *      results here, calling the exact same apply() — no global-task round
     *      trip, no logic duplicated.
     *
     * Both paths fill translations / phonetics / images / audio and mark invalid /
     * region-redirect words as is_valid=false PLACEHOLDERS (markValidity).
     *
     * AUDIO is BASE64-ONLY (audio_base64): the chrome side captures the Bing
     * pronunciation bytes in-page and submits base64. There is NO server-side
     * audio-URL download (a Bing audio URL is not openable server-side). Stored
     * fill-missing — existing pycore/edge-TTS audio is never clobbered.
     *
     * IMAGES are BASE64-ONLY too (same rule as audio): image_base64 carries the
     * Bing sample-image bytes captured in-page; the write-back decodes, validates
     * (magic bytes), and stores them as LOCAL files (fill-missing). No image-URL
     * fetch anywhere.
     *
     * Idempotent + restart-safe: apply() is a direct fill-missing write with no
     * exclusive/claimed state, so re-submitting the same batch never double-writes
     * or corrupts a row.
     *
     * Body:
     * {
     *   "language": "en",                 // source/library language (name or code)
     *   "target_language": "zh",          // optional; defaults to "zh"
     *   "source": "bing",                 // optional provider label
     *   "worker_id": "...",               // optional; traceability only
     *   "translations": [
     *     { "word": "...", "md5"?: "...", "translation": "...",
     *       "phonetic"?, "us_phonetic"?, "uk_phonetic"?,
     *       "image_base64"?: string[]|[{base64,mime?}], "audio_base64"? }
     *   ],
     *   "invalidWords": [ "..." | {word} ],
     *   "regionRedirectWords": [ "..." | {word} ]
     * }
     *
     * NOTE: the write-back matches rows by md5(word), so each translation entry
     * must carry `word`. An entry with only `md5` (no `word`) cannot be reversed
     * to its source string and is skipped (reported in `skipped_no_word`).
     *
     * Returns { updated, marked_invalid, marked_region, ... }.
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

        $language = $validated['language'];
        $targetLanguage = 'zh';
        if (isset($validated['target_language']) && $validated['target_language'] !== '') {
            $targetLanguage = $validated['target_language'];
        }
        $provider = 'bing';
        if (isset($validated['source']) && $validated['source'] !== '') {
            $provider = $validated['source'];
        }
        // Optional worker/host id for traceability (woven into the synthetic
        // intake task id used only for logging inside apply()).
        $workerId = '';
        if (isset($validated['worker_id']) && $validated['worker_id'] !== '') {
            $workerId = (string) $validated['worker_id'];
        }

        $rawTranslations = $validated['translations'] ?? [];
        // camelCase (control plane) OR snake_case (worker result shape) — accept
        // whichever the caller sent so neither casing silently drops placeholders.
        $invalidWords = $validated['invalidWords'] ?? $validated['invalid_words'] ?? [];
        $regionRedirectWords = $validated['regionRedirectWords'] ?? $validated['region_redirect_words'] ?? [];

        // Normalize each entry to the write-back's contract (image_base64 +
        // audio_base64, both base64-only). Entries carrying only `md5` (no `word`)
        // cannot be matched (md5 is one-way) and are skipped.
        $entries = [];
        $skippedNoWord = 0;
        foreach ($rawTranslations as $item) {
            if (!is_array($item)) {
                continue;
            }
            $word = isset($item['word']) && is_string($item['word']) ? $item['word'] : '';
            if ($word === '') {
                $skippedNoWord++;
                continue;
            }

            // Images are BASE64-ONLY (same rule as audio): the Bing image URLs are
            // not fetchable server-side, so the chrome side captures the bytes
            // in-page and submits image_base64 (a base64 string list, or a list of
            // { base64, mime? }). The write-back stores them as LOCAL files.
            $imageBase64 = null;
            if (isset($item['image_base64'])) {
                $imageBase64 = $item['image_base64'];
            }

            $entry = ['word' => $word];
            if (isset($item['translation'])) {
                $entry['translation'] = $item['translation'];
            }
            if (isset($item['phonetic'])) {
                $entry['phonetic'] = $item['phonetic'];
            }
            if (isset($item['us_phonetic'])) {
                $entry['us_phonetic'] = $item['us_phonetic'];
            }
            if (isset($item['uk_phonetic'])) {
                $entry['uk_phonetic'] = $item['uk_phonetic'];
            }
            if ($imageBase64 !== null && $imageBase64 !== '' && $imageBase64 !== []) {
                $entry['image_base64'] = $imageBase64;
            }
            if (isset($item['audio_base64']) && is_string($item['audio_base64'])) {
                $entry['audio_base64'] = $item['audio_base64'];
            }

            $entries[] = $entry;
        }

        // Reuse the canonical write-back (no duplicated logic). taskId is a
        // synthetic intake id for logging only; the optional worker_id is woven
        // in for traceability.
        $intakeId = 'chrome-assist:submit-bing';
        if ($workerId !== '') {
            $intakeId .= ':' . $workerId;
        }
        $result = AppQyV1WordTranslationWriteback::apply(
            $intakeId,
            $language,
            $targetLanguage,
            $provider,
            $entries,
            $invalidWords,
            $regionRedirectWords
        );

        // apply() returns a combined `invalidated` count; surface the per-bucket
        // request counts so the caller can reconcile invalid vs region marks.
        $response = [
            'updated' => (int) ($result['processed'] ?? 0),
            'marked_invalid' => count($invalidWords),
            'marked_region' => count($regionRedirectWords),
            'invalidated_total' => (int) ($result['invalidated'] ?? 0),
            'failed' => (int) ($result['failed'] ?? 0),
            'skipped_no_word' => $skippedNoWord,
        ];

        return $this->success($response, 'Bing assist results applied');
    }
}
