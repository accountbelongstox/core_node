<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use Illuminate\Database\QueryException;

/**
 * Queue Center — single definition for queue operations over global_tasks.
 *
 * Owns the two audio queues declared as control_names in
 * config/queue_center_contract.json. Every
 * enqueue / move-to-head / cancel / retry / stats / list operation for those
 * queues goes through this service so the on-miss hooks (word media resolve,
 * sentence resolve, queue-head endpoints) and the background scan timer share
 * one implementation.
 *
 * Dedup model: every task carries a group_key. Callers pass a deterministic
 * dedup key ("{language}:{contentId}" via dedupKeyFor); when omitted, one is
 * derived from the normalized payload identity fields. A live
 * (pending/assigned/processing) task with the same group_key is returned
 * instead of duplicated (created=false).
 */
class QueueCenterService
{
    public const QUEUE_WORD_AUDIO = 'word_audio';
    public const QUEUE_SENTENCE_AUDIO = 'sentence_audio';

    /** Worker lease per queue (mirrors the legacy enqueue paths). */
    private const DEFAULT_TIMEOUT_SECONDS = [
        self::QUEUE_WORD_AUDIO => 300,
        self::QUEUE_SENTENCE_AUDIO => 120,
    ];

    protected TaskManagerService $taskManager;
    protected QueueHeadService $queueHead;
    protected QueueHeadNotificationService $headNotifications;

    public function __construct(
        ?TaskManagerService $taskManager = null,
        ?QueueHeadService $queueHead = null,
        ?QueueHeadNotificationService $headNotifications = null
    )
    {
        $this->taskManager = $taskManager ?? app(TaskManagerService::class);
        $this->queueHead = $queueHead ?? app(QueueHeadService::class);
        $this->headNotifications = $headNotifications ?? app(QueueHeadNotificationService::class);
    }

    public static function queueKeys(): array
    {
        return QueueCenterContract::queuePositionOrderedControlNames();
    }

    public static function isSupportedQueue(string $queueKey): bool
    {
        return in_array($queueKey, self::queueKeys(), true);
    }

    /**
     * Deterministic dedup key for one content item: "{language}:{contentId}".
     * $contentId is the word md5 for word_audio and the sentence content_id
     * for sentence_audio.
     */
    public static function dedupKeyFor(string $taskType, string $language, string $contentId): string
    {
        return strtolower(trim($language)) . ':' . trim($contentId);
    }

    /**
     * Idempotently enqueue one audio task. When a live task with the same
     * group_key already exists it is returned with created=false and nothing
     * is written; otherwise the task is created via TaskManagerService.
     *
     * @param string $taskType       Contract-defined queue-position task type
     * @param array  $payload        Raw payload; normalized via normalizeAudioPayload()
     * @param string|null $dedupKey  Deterministic group_key (defaultDedupKey when null)
     * @param array  $linkAttributes Phase 5 substrate links (dict_row_id,
     *                               dict_language, dict_row_table) — whitelisted
     *                               by TaskManagerService::createTask
     * @return array{task:GlobalTask,created:bool}
     */
    public function enqueue(
        string $taskType,
        array $payload,
        ?string $dedupKey = null,
        array $linkAttributes = [],
        ?int $timeoutSeconds = null
    ): array {
        $this->assertSupportedQueue($taskType);
        $payload = $this->normalizeAudioPayload($taskType, $payload);
        $dedupKey = ($dedupKey !== null && $dedupKey !== '')
            ? $dedupKey
            : self::defaultDedupKey($taskType, $payload);

        $existing = self::findLiveByDedupKey($taskType, $dedupKey);
        if ($existing) {
            return ['task' => $existing, 'created' => false];
        }

        try {
            $task = $this->taskManager->createTask(
                'AppQyV1',
                $taskType,
                (string) (QueueCenterContract::taskTypeExecution($taskType) ?? ''),
                $payload,
                $timeoutSeconds ?? (int) (
                    QueueCenterContract::diffDelivery()['consumer_task_timeout_seconds'][$taskType]
                    ?? (self::DEFAULT_TIMEOUT_SECONDS[$taskType] ?? 120)
                ),
                0,
                3,
                false,
                null,
                array_merge($linkAttributes, ['group_key' => $dedupKey])
            );
        } catch (QueryException $exception) {
            // The idx_global_tasks_live_group_key partial unique index
            // (sys:init) rejects a concurrent duplicate insert; the winner row
            // is re-read and reported with created=false, same as the
            // pre-check path. Any other database error propagates unchanged.
            if (($exception->errorInfo[0] ?? null) !== '23505') {
                throw $exception;
            }
            $existing = self::findLiveByDedupKey($taskType, $dedupKey);
            if ($existing === null) {
                throw $exception;
            }
            return ['task' => $existing, 'created' => false];
        }

        return ['task' => $task, 'created' => true];
    }

    /**
     * The newest live task for one (task_type, group_key) dedup identity, or
     * null. Single lookup shared by the enqueue pre-check and the unique-index
     * conflict fallback.
     */
    private static function findLiveByDedupKey(string $taskType, string $dedupKey): ?GlobalTask
    {
        return GlobalTask::findNewestLiveByGroupKey(
            $taskType,
            $dedupKey,
            QueueCenterContract::taskStatuses('live')
        );
    }

    /**
     * Move one item to the queue head: enqueue it when absent, otherwise extract
     * the existing queued task, assign a monotonic queue_position head ticket,
     * and stage one compact diff notification for the interval publisher.
     *
     * @return array{ok:bool,task_id:string,created:bool,head_action:string,status:string,queue_position:int}
     */
    public function moveToHead(
        string $taskType,
        string $dedupKey,
        array $payload,
        bool $emitEvent = true,
        array $linkAttributes = []
    ): array {
        $result = $this->enqueue(
            $taskType,
            $payload,
            $dedupKey,
            $linkAttributes
        );
        $task = $result['task'];
        $head = $this->moveExistingTaskToHead((string) $task->task_id, $emitEvent);
        $headAction = (string) $head['status'];
        if ($head['task'] instanceof GlobalTask) {
            $task = $head['task'];
        }

        return [
            'ok' => true,
            'task_id' => (string) $task->task_id,
            'created' => $result['created'],
            'head_action' => $headAction,
            'status' => (string) $task->status,
            'queue_position' => (int) $task->queue_position,
        ];
    }

    /** Move an existing queue-position task to the physical head. */
    public function moveExistingTaskToHead(string $taskId, bool $emitEvent = true): array
    {
        $storedTaskType = GlobalTask::taskTypeOf($taskId);
        if ($storedTaskType === null) {
            return ['status' => 'not_found', 'task' => null, 'queue_position' => 0];
        }
        if (!QueueCenterContract::isQueuePositionOrdered($storedTaskType)) {
            throw new \InvalidArgumentException("Task type does not use queue-position ordering: {$storedTaskType}");
        }

        $head = $this->queueHead->moveTaskToHead($taskId);
        $task = $head['task'] ?? null;
        if (!$emitEvent
            || ($head['status'] ?? null) !== 'moved_to_head'
            || !($task instanceof GlobalTask)) {
            return $head;
        }

        $taskType = (string) $task->task_type;
        if (!self::isSupportedQueue($taskType)) {
            return $head;
        }
        $this->headNotifications->record($taskType);

        return $head;
    }

    /**
     * Canonical enqueue-or-head entry for audio producers.
     *
     * @return array{ok:bool,task_id:string,created:bool,head_action:string,status:string}
     */
    public function schedule(
        string $taskType,
        array $payload,
        string $dedupKey,
        bool $moveToHead,
        bool $emitEvent = true,
        array $linkAttributes = [],
        ?int $timeoutSeconds = null
    ): array {
        if ($moveToHead) {
            return $this->moveToHead(
                $taskType,
                $dedupKey,
                $payload,
                $emitEvent,
                $linkAttributes
            );
        }

        $result = $this->enqueue(
            $taskType,
            $payload,
            $dedupKey,
            $linkAttributes,
            $timeoutSeconds
        );
        $task = $result['task'];

        return [
            'ok' => true,
            'task_id' => (string) $task->task_id,
            'created' => (bool) $result['created'],
            'head_action' => 'not_requested',
            'status' => (string) $task->status,
            'queue_position' => (int) $task->queue_position,
        ];
    }

    /**
     * Paginated queue listing, live tasks first and newest head tickets first.
     */
    public function listQueue(string $queueKey, int $page = 1, int $limit = 20): array
    {
        $this->assertSupportedQueue($queueKey);
        $page = max(1, $page);
        $limit = max(1, min($limit, QueueCenterContract::taskLimit('list')));

        $liveStatuses = QueueCenterContract::taskStatuses('live');
        $pageData = GlobalTask::queuePageTaskIds($queueKey, $liveStatuses, $page, $limit);
        $total = (int) $pageData['total'];
        $scope = 'global_tasks:queue:' . $queueKey;
        $catalog = new DiffIdPageCatalog();
        $idPage = $catalog->snapshotIds($scope, $page, $pageData['task_ids']);
        $taskIds = $idPage['ids'];
        $tasks = $catalog->materialize(
            $scope,
            $idPage['segment'],
            $taskIds,
            static fn (array $ids): array => GlobalTask::tasksByTaskIds($ids)
        );

        $items = [];
        foreach ($tasks as $task) {
            $record = QueueCenterContract::projectTask($task, 'status');
            unset($record['priority']);
            $record['group_key'] = $task->group_key;
            $items[] = $record;
        }
        $catalog->compactSegment($scope, $idPage['segment'], $taskIds);

        return [
            'queue' => $queueKey,
            'items' => $items,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => $total,
                'total_pages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
            ],
        ];
    }

    /**
     * Paginated live-task view for lightweight queue monitors.
     *
     * @return array{total:int,page:int,per_page:int,items:array<int,array<string,mixed>>,languages:array<string,int>}
     */
    public function listLiveQueue(
        string $queueKey,
        int $page = 1,
        int $limit = 20,
        ?string $language = null
    ): array {
        $this->assertSupportedQueue($queueKey);
        $page = max(1, $page);
        $limit = max(1, min($limit, QueueCenterContract::taskLimit('list')));
        $language = $language !== null ? strtolower(trim($language)) : null;
        $liveStatuses = QueueCenterContract::taskStatuses('live');
        $snapshot = GlobalTask::liveQueuePage(
            $queueKey,
            $liveStatuses,
            $page,
            $limit,
            $language,
            [
                'task_id', 'status', 'queue_position', 'progress', 'payload', 'result',
                'assigned_to', 'assigned_at', 'created_at', 'updated_at',
            ]
        );
        $total = (int) $snapshot['total'];
        $tasks = $snapshot['tasks'];

        // Language tally stays SQL-side (one grouped scan, PostgreSQL jsonb
        // text extraction) — never a payload cursor over every live task.
        $languages = [];
        foreach ($snapshot['language_counts'] as $key => $aggregate) {
            $key = (string) $key;
            if ($key !== '') {
                $languages[$key] = (int) $aggregate;
            }
        }

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $limit,
            'items' => array_map(static fn (GlobalTask $task): array => [
                'task_id' => (string) $task->task_id,
                'status' => (string) $task->status,
                'queue_position' => (int) $task->queue_position,
                'progress' => (float) $task->progress,
                'stage' => is_array($task->result)
                    ? (string) ($task->result['stage'] ?? $task->status)
                    : (string) $task->status,
                'backend_uploaded' => is_array($task->result)
                    ? (bool) ($task->result['backend_uploaded'] ?? false)
                    : false,
                'payload' => is_array($task->payload) ? $task->payload : [],
                'assigned_to' => $task->assigned_to,
                'assigned_at' => $task->assigned_at,
                'created_at' => $task->created_at,
                'updated_at' => $task->updated_at,
            ], $tasks->all()),
            'languages' => $languages,
        ];
    }

    /**
     * High-water diff ID page table for the UI pump (rule 1/2: IDs + status
     * metadata only, never full rows). Tasks with a primary id above $cursor
     * are returned in bounded ID pages; the realtime revision lets the client
     * align incrementally, and head_ids carries tasks moved to the queue head.
     *
     * @return array<string,mixed>
     */
    public function idPages(string $queueKey, int $cursor = 0, ?int $maxPages = null): array
    {
        $this->assertSupportedQueue($queueKey);
        $delivery = QueueCenterContract::diffDelivery();
        $idPageLimit = max(1, (int) ($delivery['id_page_limit'] ?? 64));
        $idLimit = max(1, (int) ($delivery['id_limit'] ?? 4096));
        $pageSize = max(1, intdiv($idLimit, $idPageLimit));
        $maxPages = max(1, min($maxPages ?? $idPageLimit, $idPageLimit));
        $rowLimit = min($idLimit, $pageSize * $maxPages);

        $cursor = max(0, $cursor);
        $rows = GlobalTask::queueRowsAfterId($queueKey, $cursor, $rowLimit);

        $highWater = $cursor;
        $entries = [];
        foreach ($rows as $row) {
            $highWater = max($highWater, (int) $row->id);
            $entries[] = [
                'task_id' => (string) $row->task_id,
                'status' => (string) $row->status,
                'queue_position' => (int) $row->queue_position,
            ];
        }

        $pages = [];
        foreach (array_chunk($entries, $pageSize) as $index => $chunk) {
            $pages[] = ['page' => $index + 1, 'ids' => $chunk];
        }

        return [
            'queue' => $queueKey,
            'revision' => app(QueueCenterRealtimeService::class)->revision(),
            'cursor' => $highWater,
            'head_ids' => (new DiffIdPageCatalog())->headIds('global_tasks:queue:' . $queueKey),
            'page_size' => $pageSize,
            'id_page_limit' => $idPageLimit,
            'id_limit' => $idLimit,
            'pages' => $pages,
        ];
    }

    /**
     * Lazily materialize the real rows of one requested ID page for the UI
     * pump (rule 4: full rows load only on request and the segment compacts
     * back to ID metadata once the response is built). Bounded by the
     * contract data_segment_limit; items use the worker_pull wire shape so
     * the pump can dispatch the payload directly.
     *
     * @param array<int,string> $taskIds
     * @return array<string,mixed>
     */
    public function pageData(string $queueKey, array $taskIds): array
    {
        $this->assertSupportedQueue($queueKey);
        $segmentLimit = max(
            1,
            (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128)
        );

        $ids = array_values(array_unique(array_filter(array_map(
            static fn ($id): string => trim((string) $id),
            $taskIds
        ), static fn (string $id): bool => $id !== '')));
        $ids = array_slice($ids, 0, $segmentLimit);

        $scope = 'global_tasks:queue:' . $queueKey;
        $catalog = new DiffIdPageCatalog();
        $segment = 'request:' . sha1(implode(',', $ids));
        $items = $ids === [] ? [] : $catalog->materialize(
            $scope,
            $segment,
            $ids,
            static function (array $pageIds) use ($queueKey): array {
                $columns = QueueCenterContract::taskWireShape('worker_pull');
                $tasks = GlobalTask::tasksByTaskIds($pageIds, $queueKey, $columns);
                $indexed = collect($tasks)->keyBy('task_id');

                return array_values(array_filter(array_map(
                    static function ($id) use ($indexed): ?array {
                        $task = $indexed->get($id);
                        return $task === null
                            ? null
                            : QueueCenterContract::projectTask($task, 'worker_pull');
                    },
                    $pageIds
                )));
            }
        );
        if ($ids !== []) {
            $catalog->compactSegment($scope, $segment, $ids);
        }

        return [
            'queue' => $queueKey,
            'data_segment_limit' => $segmentLimit,
            'count' => count($items),
            'items' => $items,
        ];
    }

    /**
     * Cancel a live task (control plane).
     *
     * @return string One of 'cancelled', 'not_found', 'not_cancellable'
     */
    public function cancel(string $taskId): string
    {
        return $this->taskManager->cancelTask($taskId);
    }

    /**
     * Re-queue a terminal (failed/cancelled) task with a fresh retry budget.
     *
     * @return string One of 'retried', 'not_found', 'not_retryable'
     */
    public function retry(string $taskId): string
    {
        return $this->taskManager->retryTask($taskId);
    }

    /**
     * Per-queue status tallies (pending/assigned/processing/total). With
     * $queueKey null, every supported queue is returned keyed by queue name.
     */
    public function stats(?string $queueKey = null): array
    {
        $types = $queueKey !== null
            ? [$this->assertSupportedQueue($queueKey)]
            : self::queueKeys();
        $metrics = app(QueueCenterMetricsService::class);
        $perQueue = [];
        foreach ($types as $type) {
            $perQueue[$type] = $metrics->liveQueue($type);
        }

        return $queueKey !== null ? $perQueue[$queueKey] : $perQueue;
    }

    /**
     * Canonical payload shapes for the two audio queues. pycore workers claim
     * these global_tasks and upload results through the EXISTING file-transport
     * report endpoints using only payload fields:
     *
     * word_audio:
     *   word                string  headword (dict-row content)
     *   content             string  alias of word (back-compat with the dual-write shape)
     *   language            string  ISO code; selects the {prefix}_tts_cache_{lang} table
     *   md5                 string  md5(word); canonical dict-row key
     *   audio_relative_path string  EdgeTTS storage-relative target path (informational;
     *                               the report endpoint recomputes it from word+language)
     *   accent?             string  'us'|'uk' preference
     *   dict_row_id?        int     canonical dict row id; with language it derives the
     *                               encoded report task_id = rowId*1000 + typeDigit*100 + langIndex
     *                               (AppQyV1DictionaryTTSCoordinator::encodeTaskId)
     *   Report: POST /api/app_qy_v1/ai_tools/tts/worker/report
     *     {task_id:int(encoded), worker_id, success, audio(file)|audio_base64, provider?, error?}
     *
     * sentence_audio:
     *   text                string  sentence text
     *   content             string  alias of text (back-compat with the dual-write shape)
     *   language            string  ISO code; selects the {prefix}_sentences_{lang} table
     *   content_id          string  md5 content id; sentence-row key
     *   variant_key?        string  specific voice variant (''/absent = primary)
     *   accent?             string  accent preference
     *   engine_profile?     string  engine PREFERENCE label (pycore GPU-gates the real choice)
     *   preferred_engine?   string  primary engine of the preference chain
     *   Report: POST /api/app_qy_v1/ai_tools/tts/sentence/report
     *     {content_id, language, worker_id, success, audio(file)|audio_base64,
     *      variant_key?, provider?, error?}
     */
    public function normalizeAudioPayload(string $taskType, array $in): array
    {
        $this->assertSupportedQueue($taskType);

        if ($taskType === self::QUEUE_WORD_AUDIO) {
            $word = trim((string) ($in['word'] ?? ($in['content'] ?? '')));
            $language = strtolower(trim((string) ($in['language'] ?? '')));
            $md5 = trim((string) ($in['md5'] ?? ''));
            if ($md5 === '' && $word !== '') {
                $md5 = md5($word);
            }

            $relativePath = trim((string) ($in['audio_relative_path'] ?? ''));
            if ($relativePath === '' && $word !== '' && $language !== '') {
                // Mirrors EdgeTTSService::buildRelativePath($word, $language, 'word')
                // at the default '+0%' rate without constructing the deprecated
                // service (its constructor does filesystem work).
                $relativePath = $language . '/word/p0pct/'
                    . md5($language . ':word:+0%:' . $word) . '.mp3';
            }

            $out = [
                'word' => $word,
                'content' => $word,
                'language' => $language,
                'md5' => $md5,
                'audio_relative_path' => $relativePath,
            ];
            foreach (['accent', 'dict_row_id'] as $optional) {
                if (isset($in[$optional])) {
                    $out[$optional] = $in[$optional];
                }
            }
            return $out;
        }

        // sentence_audio
        $text = trim((string) ($in['text'] ?? ($in['content'] ?? '')));
        $language = strtolower(trim((string) ($in['language'] ?? '')));
        $contentId = trim((string) ($in['content_id'] ?? ($in['hash'] ?? '')));
        if ($contentId === '' && $text !== '') {
            // Canonical content id (punctuation-stripped, lowercased md5) —
            // the same key MediaIngestService and the sentence tables use.
            $contentId = \App\Services\MediaIngestService::computeContentId($text);
        }

        $out = [
            'text' => $text,
            'content' => $text,
            'language' => $language,
            'content_id' => $contentId,
        ];
        foreach ([
            'variant_key',
            'accent',
            'engine_profile',
            'preferred_engine',
            'target_kind',
            'article_id',
            'article_md5',
            'audio_relative_path',
            'source',
        ] as $optional) {
            if (isset($in[$optional])) {
                $out[$optional] = $in[$optional];
            }
        }
        return $out;
    }

    /**
     * Fallback dedup key from the normalized payload identity fields, per the
     * service contract: sha1(taskType + '|' + json identity).
     */
    public static function defaultDedupKey(string $taskType, array $normalizedPayload): string
    {
        $identity = $taskType === self::QUEUE_WORD_AUDIO
            ? ['language' => $normalizedPayload['language'] ?? null, 'md5' => $normalizedPayload['md5'] ?? null]
            : ['language' => $normalizedPayload['language'] ?? null, 'content_id' => $normalizedPayload['content_id'] ?? null];
        return sha1($taskType . '|' . json_encode($identity));
    }

    private function assertSupportedQueue(string $taskType): string
    {
        if (!self::isSupportedQueue($taskType)) {
            throw new \InvalidArgumentException(
                "Unsupported queue-center queue: {$taskType} (supported: " . implode(', ', self::queueKeys()) . ')'
            );
        }
        return $taskType;
    }
}
