<?php

namespace App\Http\Controllers;

use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Services\QueueCenter\QueueCenterService;
use App\Services\QueueCenter\QueueSliceDiffService;
use App\Services\QueueCenter\QueueTaskReceiptService;
use App\Services\QueueCenter\QueueWorkerPresenceService;
use App\Support\QueueCenterContract;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Queue Center — centralized control plane and ordering event stream for
 * Laravel-owned task queues on top of global_tasks.
 *
 * Routes (public control-plane group, same trust level as /api/task/*):
 *   GET  /api/queue-center/overview
 *   GET  /api/queue-center/queues/{queue}/items
 *   GET  /api/queue-center/queues/{queue}/id-pages
 *   GET  /api/queue-center/queues/{queue}/page-data
 *   POST /api/queue-center/queues/{queue}/head
 *   POST /api/queue-center/tasks/{taskId}/cancel
 *   POST /api/queue-center/tasks/{taskId}/retry
 *   GET  /api/queue-center/events?cursor=
 *
 * Uses standardized ApiResponse trait. NO try-catch blocks.
 */
class QueueCenterController extends Controller
{
    use ApiResponse;

    protected QueueCenterService $queueCenter;
    protected QueueCenterRealtimeService $realtime;
    protected QueueTaskReceiptService $taskReceipts;
    protected QueueWorkerPresenceService $workerPresence;
    protected QueueSliceDiffService $sliceDiff;

    public function __construct(
        QueueCenterService $queueCenter,
        QueueCenterRealtimeService $realtime,
        QueueTaskReceiptService $taskReceipts,
        QueueWorkerPresenceService $workerPresence,
        QueueSliceDiffService $sliceDiff
    ) {
        $this->queueCenter = $queueCenter;
        $this->realtime = $realtime;
        $this->taskReceipts = $taskReceipts;
        $this->workerPresence = $workerPresence;
        $this->sliceDiff = $sliceDiff;
    }

    /**
     * GET /api/queue-center/overview — per-queue stats (pending/assigned/
     * processing/total) for the contract-owned control names.
     */
    public function overview(): JsonResponse
    {
        return $this->success([
            'queues' => $this->queueCenter->stats(),
            'workers' => $this->workerPresence->snapshot(),
        ], __('relay.queue_center_overview'));
    }

    public function events(Request $request): JsonResponse
    {
        $limit = QueueCenterContract::taskLimit('event_batch');
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
            'limit' => "nullable|integer|min:1|max:{$limit}",
        ]);

        return $this->success(
            $this->realtime->replay(
                (int) ($validated['cursor'] ?? 0),
                (int) ($validated['limit'] ?? $limit)
            ),
            __('relay.queue_center_events')
        );
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

    public function diff(Request $request, string $queue): JsonResponse
    {
        $taskTypeKeys = QueueCenterContract::taskTypeKeys();
        if (!in_array($queue, $taskTypeKeys, true)) {
            return $this->notFound("Unknown queue: {$queue}");
        }
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
        ]);

        return $this->success(
            $this->sliceDiff->snapshot($queue, (int) ($validated['cursor'] ?? 0)),
            'Queue slice diff'
        );
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
     * POST /api/queue-center/queues/{queue}/head
     * Body: { dedup_key: string, payload?: object } -> moveToHead.
     */
    public function moveToHead(Request $request, string $queue): JsonResponse
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

}
