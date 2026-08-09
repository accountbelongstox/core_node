<?php

namespace App\Http\Controllers;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Services\QueueCenter\QueueCenterService;
use App\Services\QueueCenter\QueueTaskReceiptService;
use App\Services\QueueCenter\QueueWorkerPresenceService;
use App\Support\QueueCenterContract;
use App\Support\ServerRuntime;
use App\Traits\ApiResponse;
use App\Utils\SseStreamResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\StreamedEvent;

/**
 * Queue Center — centralized control plane and priority event stream for
 * Laravel-owned task queues on top of global_tasks.
 *
 * Routes (public control-plane group, same trust level as /api/task/*):
 *   GET  /api/queue-center/overview
 *   GET  /api/queue-center/queues/{queue}/items
 *   GET  /api/queue-center/queues/{queue}/id-pages
 *   GET  /api/queue-center/queues/{queue}/page-data
 *   POST /api/queue-center/queues/{queue}/bump
 *   POST /api/queue-center/tasks/{taskId}/cancel
 *   POST /api/queue-center/tasks/{taskId}/retry
 *   GET  /api/queue-center/stream?cursor=
 *
 * Uses standardized ApiResponse trait. NO try-catch blocks.
 */
class QueueCenterController extends Controller
{
    use ApiResponse;

    // Bounded SSE lifetime CAP: end the stream so the Octane worker is freed;
    // the client reconnects with its cursor and resumes with zero gap.
    private const MAX_LIFETIME_SECONDS = 50;
    // On the single-worker php -S runtime the SSE generator occupies the ONE
    // worker for its whole lifetime, starving all other requests. Cap the
    // lifetime hard there so the worker is released every few seconds; the
    // client reconnects by cursor, turning the stream into a near-short-poll
    // that lets other requests interleave. No effect on Octane.
    private const SINGLE_WORKER_LIFETIME_SECONDS = 3;
    private const POLL_INTERVAL_MS = 800;
    private const BATCH_LIMIT = 200;
    private const HEARTBEAT_SECONDS = 15;
    private const PRUNE_AGE_SECONDS = 600;
    private const PRUNE_EVERY_SECONDS = 60;

    /** Queue-head events mirrored through the shared Queue Center stream. */
    private const QUEUE_STREAM_EVENTS = [
        'task.priority',
        'word_audio.priority',
        'sentence.priority',
        'word_image.priority',
        'cover.priority',
        'poster.priority',
    ];

    protected QueueCenterService $queueCenter;
    protected QueueTaskReceiptService $taskReceipts;
    protected QueueWorkerPresenceService $workerPresence;

    public function __construct(
        QueueCenterService $queueCenter,
        QueueTaskReceiptService $taskReceipts,
        QueueWorkerPresenceService $workerPresence
    ) {
        $this->queueCenter = $queueCenter;
        $this->taskReceipts = $taskReceipts;
        $this->workerPresence = $workerPresence;
    }

    /**
     * GET /api/queue-center/overview — per-queue stats (pending/assigned/
     * processing/total) for the contract control_names word_audio/sentence_audio.
     */
    public function overview(): JsonResponse
    {
        return $this->success([
            'queues' => $this->queueCenter->stats(),
            'workers' => $this->workerPresence->snapshot(),
        ], 'Queue center overview');
    }

    public function receipts(Request $request): JsonResponse
    {
        $limit = max(1, (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128));
        $validated = $request->validate([
            'task_ids' => 'required|array|min:1|max:' . $limit,
            'task_ids.*' => 'required|string|max:100',
        ]);

        return $this->success(
            $this->taskReceipts->receipts($validated['task_ids']),
            'Queue delivery receipts'
        );
    }

    /**
     * GET /api/queue-center/queues/{queue}/items?page=&limit=
     * limit defaults to the contract list_default, capped at the contract list max.
     */
    public function items(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isSupportedQueue($queue)) {
            return $this->notFound(
                "Unknown queue: {$queue} (supported: " . implode(', ', QueueCenterService::queueKeys()) . ')'
            );
        }

        $validated = $request->validate([
            'page' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:' . QueueCenterContract::taskLimit('list'),
        ]);

        $data = $this->queueCenter->listQueue(
            $queue,
            (int) ($validated['page'] ?? 1),
            (int) ($validated['limit'] ?? QueueCenterContract::taskLimit('list_default'))
        );

        return $this->success($data, 'Queue items');
    }

    /**
     * GET /api/queue-center/queues/{queue}/id-pages?cursor=&pages=
     * High-water diff ID page table for the UI pump: IDs + status metadata
     * only, bounded by the contract id_page_limit / id_limit, with the
     * realtime revision for incremental alignment.
     */
    public function idPages(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isSupportedQueue($queue)) {
            return $this->notFound(
                "Unknown queue: {$queue} (supported: " . implode(', ', QueueCenterService::queueKeys()) . ')'
            );
        }

        $idPageLimit = max(1, (int) (QueueCenterContract::diffDelivery()['id_page_limit'] ?? 64));
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
            'pages' => 'nullable|integer|min:1|max:' . $idPageLimit,
        ]);

        $data = $this->queueCenter->idPages(
            $queue,
            (int) ($validated['cursor'] ?? 0),
            isset($validated['pages']) ? (int) $validated['pages'] : null
        );

        return $this->success($data, 'Queue ID pages');
    }

    /**
     * GET /api/queue-center/queues/{queue}/page-data?ids[]=
     * Lazily materialized real rows for one requested ID page, bounded by the
     * contract data_segment_limit.
     */
    public function pageData(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isSupportedQueue($queue)) {
            return $this->notFound(
                "Unknown queue: {$queue} (supported: " . implode(', ', QueueCenterService::queueKeys()) . ')'
            );
        }

        $segmentLimit = max(1, (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128));
        $validated = $request->validate([
            'ids' => 'required|array|min:1|max:' . $segmentLimit,
            'ids.*' => 'string|max:100',
        ]);

        $data = $this->queueCenter->pageData($queue, $validated['ids']);

        return $this->success($data, 'Queue page data');
    }

    /**
     * POST /api/queue-center/queues/{queue}/bump
     * Body: { dedup_key: string, payload?: object } -> moveToHead.
     */
    public function bump(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isSupportedQueue($queue)) {
            return $this->notFound(
                "Unknown queue: {$queue} (supported: " . implode(', ', QueueCenterService::queueKeys()) . ')'
            );
        }

        $validated = $request->validate([
            'dedup_key' => 'required|string|max:200',
            'payload' => 'nullable|array',
        ]);

        $result = $this->queueCenter->moveToHead(
            $queue,
            (string) $validated['dedup_key'],
            $validated['payload'] ?? []
        );

        return $this->success($result, 'Task moved to queue head');
    }

    /**
     * POST /api/queue-center/tasks/{taskId}/cancel
     */
    public function cancel(string $taskId): JsonResponse
    {
        $outcome = $this->queueCenter->cancel($taskId);

        if ($outcome === 'not_found') {
            return $this->notFound('Task not found');
        }
        if ($outcome === 'not_cancellable') {
            return $this->error('Task already finished — cannot cancel', 409);
        }

        return $this->success([
            'task_id' => $taskId,
            'status' => 'cancelled',
        ], 'Task cancelled');
    }

    /**
     * POST /api/queue-center/tasks/{taskId}/retry
     */
    public function retry(string $taskId): JsonResponse
    {
        $outcome = $this->queueCenter->retry($taskId);

        if ($outcome === 'not_found') {
            return $this->notFound('Task not found');
        }
        if ($outcome === 'not_retryable') {
            return $this->error('Only failed or cancelled tasks can be retried', 409);
        }

        return $this->success([
            'task_id' => $taskId,
            'status' => 'pending',
        ], 'Task re-queued');
    }

    /**
     * GET /api/queue-center/stream?cursor=<lastId>
     *
     * SSE long connection replaying the shared translation_events outbox,
     * filtered to Queue Center priority events. Modeled on
     * AppQyV1TranslationStreamController:
     * cursor resume (every payload carries `_id`), periodic ping, bounded
     * lifetime under the Octane per-request watchdog. NO new DB tables.
     */
    public function stream(Request $request)
    {
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
        ]);

        // cursor absent / 0 -> start from the current tail (only NEW events).
        $cursor = 0;
        if (isset($validated['cursor'])) {
            $cursor = (int) $validated['cursor'];
        }
        if ($cursor <= 0) {
            $cursor = AppQyV1TranslationEventModel::maxId();
        }

        // The effective lifetime MUST stay UNDER Octane's per-request watchdog
        // (config octane.max_execution_time, default 30s) — otherwise the worker
        // KILLS the stream mid-flight and the consumer sees a read timeout.
        $maxExec = (int) config('octane.max_execution_time', 30);
        $maxLifetime = $maxExec > 0
            ? max(5, min(self::MAX_LIFETIME_SECONDS, $maxExec - 5))
            : self::MAX_LIFETIME_SECONDS;

        // Single-worker php -S: hard-cap the hold so the sole worker is freed
        // frequently and other requests are not starved (client reconnects by
        // cursor). Overrides the Octane-oriented budget above on this runtime.
        if (ServerRuntime::isSingleWorker()) {
            $maxLifetime = self::SINGLE_WORKER_LIFETIME_SECONDS;
        }

        return SseStreamResponse::make(function () use ($cursor, $maxLifetime) {
            $current = $cursor;
            $start = microtime(true);
            $lastBeat = $start;
            $lastPrune = $start;

            yield new StreamedEvent(event: 'stream.open', data: json_encode(['cursor' => $current]));

            while ((microtime(true) - $start) < $maxLifetime) {
                $events = AppQyV1TranslationEventModel::since($current, self::BATCH_LIMIT);

                if (!empty($events)) {
                    foreach ($events as $evt) {
                        // The cursor ALWAYS advances (filtered events included) so
                        // resume never replays filtered Queue Center rows.
                        $current = $evt['id'];
                        if (!in_array($evt['event'], self::QUEUE_STREAM_EVENTS, true)) {
                            continue;
                        }
                        $payload = $evt['data'];
                        $payload['_id'] = $evt['id'];
                        yield new StreamedEvent(
                            event: $evt['event'],
                            data: json_encode($payload, JSON_UNESCAPED_UNICODE)
                        );
                    }
                    $lastBeat = microtime(true);

                    // A full batch likely means more is waiting — catch up now.
                    if (count($events) >= self::BATCH_LIMIT) {
                        continue;
                    }
                } elseif ((microtime(true) - $lastBeat) >= self::HEARTBEAT_SECONDS) {
                    yield new StreamedEvent(event: 'ping', data: json_encode(['cursor' => $current]));
                    $lastBeat = microtime(true);
                }

                if ((microtime(true) - $lastPrune) >= self::PRUNE_EVERY_SECONDS) {
                    AppQyV1TranslationEventModel::pruneOlderThan(self::PRUNE_AGE_SECONDS);
                    $lastPrune = microtime(true);
                }

                usleep(self::POLL_INTERVAL_MS * 1000);
            }

            yield new StreamedEvent(event: 'stream.close', data: json_encode(['cursor' => $current]));
        });
    }
}
