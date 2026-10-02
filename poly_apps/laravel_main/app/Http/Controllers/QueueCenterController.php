<?php

namespace App\Http\Controllers;

use App\Services\WorkLeases\WorkLeaseLanes;
use App\Models\Worker;
use App\Services\PycoreTasks\PycoreComputeRoster;
use Illuminate\Validation\Rule;
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
            'realtime' => $this->realtime->connection(),
        ], __('relay.queue_center_overview'));
    }

    public function hubAuthorization(): JsonResponse
    {
        return $this->success($this->realtime->connection(), __('relay.success'));
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
            __('api.messages.queue_delivery_receipts')
        );
    }

    /**
     * GET /api/queue-center/queues/{queue}/items?page=&limit=
     * limit defaults to the contract list_default, capped at the contract list max.
     */
    public function items(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isSupportedQueue($queue)) {
            return $this->taskTypeUnsupported($queue, QueueCenterService::queueKeys());
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

        return $this->success($data, __('api.messages.queue_items'));
    }

    public function diff(Request $request, string $queue): JsonResponse
    {
        // The gap lanes are served by work leases (WorkLeaseController), not task diffs.
        if (!QueueCenterService::isDiffQueue($queue) || WorkLeaseLanes::isLane($queue)) {
            return $this->taskTypeUnsupported($queue, QueueCenterContract::taskTypeKeys());
        }
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
            'sync' => 'nullable|boolean',
            'worker_id' => 'nullable|string',
            'compute_class' => ['nullable', 'string', Rule::in(PycoreComputeRoster::CLASSES)],
        ]);
        $snapshot = $this->sliceDiff->snapshot(
            $queue,
            (int) ($validated['cursor'] ?? 0),
            true,
            $request->boolean('sync')
        );
        if (!$this->offeredTo($validated, $queue)) {
            $snapshot['head_task_ids'] = [];
            $snapshot['ordered_task_ids'] = [];
        }

        return $this->success($snapshot, __('api.messages.queue_slice_diff'));
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
            return $this->taskTypeUnsupported($queue, QueueCenterService::queueKeys());
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

        return $this->success($data, __('api.messages.queue_id_pages'));
    }

    /**
     * GET /api/queue-center/queues/{queue}/page-data?ids[]=
     * Lazily materialized real rows for one requested ID page, bounded by the
     * contract data_segment_limit.
     */
    public function pageData(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isDiffQueue($queue) || WorkLeaseLanes::isLane($queue)) {
            return $this->taskTypeUnsupported($queue, QueueCenterContract::taskTypeKeys());
        }

        $segmentLimit = max(1, (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128));
        $validated = $request->validate([
            'ids' => 'required|array|min:1|max:' . $segmentLimit,
            'ids.*' => 'string|max:100',
            'worker_id' => 'nullable|string',
            'compute_class' => ['nullable', 'string', Rule::in(PycoreComputeRoster::CLASSES)],
        ]);

        $data = $this->queueCenter->pageData($queue, $validated['ids']);
        if (!$this->offeredTo($validated, $queue)) {
            $data['items'] = [];
            $data['count'] = 0;
        }

        return $this->success($data, __('api.messages.queue_page_data'));
    }

    /**
     * POST /api/queue-center/queues/{queue}/head
     * Body: { dedup_key: string, payload?: object } -> moveToHead.
     */
    public function moveToHead(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isSupportedQueue($queue)) {
            return $this->taskTypeUnsupported($queue, QueueCenterService::queueKeys());
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

        return $this->success($result, __('api.messages.task_moved_to_queue_head'));
    }

    /**
     * POST /api/queue-center/queues/{queue}/head/batch
     * Body: { items: [{ dedup_key, payload? }, ...] } -> one enqueue-or-move
     * per item, one head notification per queue. Concurrent batches from
     * Laravel gateways and pycore clients race safely on the live-dedup
     * unique index plus locked monotonic head tickets.
     */
    public function moveToHeadBatch(Request $request, string $queue): JsonResponse
    {
        if (!QueueCenterService::isSupportedQueue($queue)) {
            return $this->taskTypeUnsupported($queue, QueueCenterService::queueKeys());
        }

        $batchLimit = max(1, (int) (
            QueueCenterContract::diffDelivery()['producer_batch_limits'][$queue]
            ?? QueueCenterContract::diffDelivery()['data_segment_limit']
            ?? 128
        ));
        $validated = $request->validate([
            'items' => 'required|array|min:1|max:' . $batchLimit,
            'items.*.dedup_key' => 'required|string|max:200',
            'items.*.payload' => 'nullable|array',
        ]);

        $result = $this->queueCenter->moveToHeadBatch($queue, $validated['items']);

        return $this->success($result, __('api.messages.batch_moved_to_queue_head'));
    }

    /**
     * POST /api/queue-center/tasks/{taskId}/cancel
     */
    public function cancel(string $taskId): JsonResponse
    {
        $outcome = $this->queueCenter->cancel($taskId);

        if ($outcome === 'not_found') {
            return $this->notFound(__('api.messages.task_not_found'));
        }
        if ($outcome === 'not_cancellable') {
            return $this->error(__('api.messages.task_already_finished_cannot_cancel'), 409);
        }

        return $this->success([
            'task_id' => $taskId,
            'status' => 'cancelled',
        ], __('api.messages.task_cancelled'));
    }

    /**
     * POST /api/queue-center/tasks/{taskId}/retry
     */
    public function retry(string $taskId): JsonResponse
    {
        $outcome = $this->queueCenter->retry($taskId);

        if ($outcome === 'not_found') {
            return $this->notFound(__('api.messages.task_not_found'));
        }
        if ($outcome === 'not_retryable') {
            return $this->error(__('api.messages.only_failed_or_cancelled_tasks_can_be'), 409);
        }

        return $this->success([
            'task_id' => $taskId,
            'status' => 'pending',
        ], __('api.messages.task_re_queued'));
    }

    /**
     * Compute-class scheduling for the diff-mirrored task types (the gap lanes
     * use work leases instead): a pycore (worker_id) sees a queue only when
     * PycoreComputeRoster offers that task type to it.
     */
    private function offeredTo(array $validated, string $queue): bool
    {
        $workerId = (string) ($validated['worker_id'] ?? '');

        if ($workerId !== '' && Worker::findByWorkerId($workerId) !== null) {
            return PycoreComputeRoster::mayClaim($workerId, $queue);
        }

        return !isset($validated['compute_class']) || PycoreComputeRoster::classCanRun((string) $validated['compute_class'], $queue);
    }
}
