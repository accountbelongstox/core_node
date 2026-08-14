<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TTSQueueMetrics;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1AddTTSTaskRequest;
use App\Support\QueueCenterContract;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

/**
 * Unified TTS Queue API Controller
 *
 * Provides endpoints for:
 * - Adding contract-defined audio tasks to the TTS queue
 * - Querying queue status
 * - Getting task details
 * - Getting queue statistics
 */
class AppQyV1TTSQueueController extends Controller
{
    use ApiResponse;

    private $queueService;

    public function __construct()
    {
        $this->queueService = new AppQyV1UnifiedTTSQueueService();
    }

    /**
     * Add TTS task to queue
     *
     * POST /api/app_qy_v1/ai_tools/tts/queue/add
     *
     * Auto-detects task type if not specified
     * If task exists, moves it to front of queue
     *
     * Request:
     * {
     *   "content": "hello world",
     *   "language": "en",
     *   "type": "word",        // Optional contract alias (auto-detect if omitted)
     *   "position": "end"      // Optional: beginning or end
     * }
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "task_id": 123,
     *     "task_type": "word",
     *     "queue_status": "queued" | "moved_to_front" | "already_available" | "already_completed",
     *     "queue_position": 42
     *   }
     * }
     */
    public function addTask(AppQyV1AddTTSTaskRequest $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        // Compatibility flag: interactive audio tasks move to the global queue head.
        $position = (bool) $request->input('interactive', false)
            ? 'beginning'
            : $request->input('position', 'end');

        $result = $this->queueService->addTask(
            $request->input('content'),
            $request->input('language'),
            $request->input('type'),
            $position
        );

        if (!$result['success']) {
            return $this->error($result['error'] ?? 'Failed to add task', 400);
        }

        return $this->success($this->addLogsToResponse($result), 'Task added to queue successfully');
    }

    /**
     * Get queue summary
     *
     * GET /api/app_qy_v1/ai_tools/tts/queue/summary
     *
     * Query params:
     * - page: Page number (default: 1)
     * - per_page: Items per page (default: 50)
     * - status: Filter by status (pending/processing/completed/failed)
     * - type: Filter by a contract-defined audio alias
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "tasks": [
     *       {
     *         "task_id": 123,
     *         "task_type": "word",
     *         "content_text": "hello",
     *         "language": "en",
     *         "status": "pending",
     *         "requested_at": "2025-12-21T10:30:00.000000Z"
     *       }
     *     ],
     *     "pagination": {
     *       "current_page": 1,
     *       "per_page": 50,
     *       "total": 100,
     *       "total_pages": 2
     *     },
     *     "statistics": {
     *       "by_status": { "pending": 10, "processing": 2, "completed": 80, "failed": 8 },
     *       "by_type": { "word": 50, "sentence": 30, "article": 20 },
     *       "total": 100
     *     }
     *   }
     * }
     */
    public function getQueueSummary(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 50);
        $status = $request->input('status');
        $type = $request->input('type');

        $result = $this->queueService->getQueueSummary((int)$page, (int)$perPage, $status, $type);

        return $this->success($this->addLogsToResponse($result), 'Queue summary retrieved successfully');
    }

    /**
     * Get completed tasks
     *
     * GET /api/app_qy_v1/ai_tools/tts/queue/completed
     *
     * Query params:
     * - page: Page number (default: 1)
     * - per_page: Items per page (default: 50)
     * - type: Filter by a contract-defined audio alias
     *
     * Response: Same as getQueueSummary but filtered to completed tasks
     */
    public function getCompletedTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 50);
        $type = $request->input('type');

        $result = $this->queueService->getCompletedTasks((int)$page, (int)$perPage, $type);

        return $this->success($this->addLogsToResponse($result), 'Completed tasks retrieved successfully');
    }

    /**
     * Get single task details
     *
     * GET /api/app_qy_v1/ai_tools/tts/queue/task/{task_id}
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "task_id": 123,
     *     "task_type": "word",
     *     "content_text": "hello",
     *     "language": "en",
     *     "status": "completed",
     *     "audio_path": "p0pct/default/abc123.mp3",
     *     "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/p0pct/default/abc123.mp3",
     *     "requested_at": "2025-12-21T10:30:00.000000Z",
     *     "completed_at": "2025-12-21T10:31:00.000000Z"
     *   }
     * }
     */
    public function getTask(int $taskId): JsonResponse
    {
        $task = $this->queueService->getTask($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        return $this->success($this->addLogsToResponse($task), 'Task retrieved successfully');
    }

    /**
     * Get queue statistics
     *
     * GET /api/app_qy_v1/ai_tools/tts/queue/stats
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "by_status": {
     *       "pending": 10,
     *       "processing": 2,
     *       "completed": 80,
     *       "failed": 8
     *     },
     *     "by_type": {
     *       "word": 50,
     *       "sentence": 30,
     *       "article": 20
     *     },
     *     "total": 100
     *   }
     * }
     */
    public function getStatistics(): JsonResponse
    {
        $stats = $this->queueService->getStatistics();

        return $this->success($this->addLogsToResponse($stats), 'Statistics retrieved successfully');
    }

    /**
     * Get performance metrics
     *
     * GET /api/app_qy_v1/ai_tools/tts/queue/metrics
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "word": {
     *       "processed_count": 100,
     *       "avg_processing_time_ms": 1234.56,
     *       "total_processing_time_ms": 123456.78
     *     },
     *     "sentence": {
     *       "processed_count": 50,
     *       "avg_processing_time_ms": 2345.67,
     *       "total_processing_time_ms": 117283.50
     *     },
     *     "article": {
     *       "processed_count": 10,
     *       "avg_processing_time_ms": 15000.00,
     *       "total_processing_time_ms": 150000.00
     *     },
     *     "global": {
     *       "total_processed": 160,
     *       "total_runtime_seconds": 3600.5,
     *       "total_runtime_formatted": "1h 0m"
     *     }
     *   }
     * }
     */
    public function getMetrics(): JsonResponse
    {
        $metrics = AppQyV1TTSQueueMetrics::getMetrics();

        return $this->success($this->addLogsToResponse($metrics), 'Metrics retrieved successfully');
    }

    /**
     * Get intelligent queue performance metrics
     *
     * GET /api/app_qy_v1/ai_tools/tts/queue/performance
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "intelligent_batch_size": {
     *       "current": 3,
     *       "min": 1,
     *       "max": 10,
     *       "default": 3
     *     },
     *     "processing_interval": {
     *       "current_seconds": 2.0,
     *       "normal_seconds": 2,
     *       "extended_seconds": 5
     *     },
     *     "success_rate": {
     *       "rate": 0.98,
     *       "successful_tasks": 98,
     *       "total_tasks": 100
     *     },
     *     "estimated_throughput": {
     *       "tasks_per_minute": 2.94,
     *       "hours_to_clear_pending": 131.2
     *     }
     *   }
     * }
     */
    public function getPerformanceMetrics(): JsonResponse
    {
        $metrics = $this->queueService->getPerformanceMetrics();

        return $this->success($metrics, 'Performance metrics retrieved successfully');
    }

    /**
     * Batch add tasks to queue
     *
     * POST /api/app_qy_v1/ai_tools/tts/queue/batch/add
     *
     * Request:
     * {
     *   "tasks": [
     *     {"content": "hello", "language": "en", "type": "word"},
     *     {"content": "world", "language": "en"}
     *   ],
     *   "default_position": "beginning"
     * }
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "total": 2,
     *     "results": [
     *       {
     *         "success": true,
     *         "status": "queued",
     *         "task_id": 123,
     *         "index": 0,
     *         "content": "hello"
     *       },
     *       {
     *         "success": true,
     *         "status": "already_available",
     *         "audio_path": "en/word/abc.mp3",
     *         "index": 1,
     *         "content": "world"
     *       }
     *     ]
     *   }
     * }
     */
    public function batchAddTasks(\App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BatchAddTTSTasksRequest $request): JsonResponse
    {
        $tasks = $request->input('tasks');
        $defaultPosition = $request->input('default_position', 'end');

        // Compatibility flag: interactive audio tasks move to the global queue head.
        if ((bool) $request->input('interactive', false)) {
            $defaultPosition = 'beginning';
        }

        $result = $this->queueService->batchAddTasks($tasks, $defaultPosition);

        return $this->success($this->addLogsToResponse($result), 'Batch tasks processed successfully');
    }

    /**
     * Batch get tasks by IDs
     *
     * POST /api/app_qy_v1/ai_tools/tts/queue/batch/get
     *
     * Request:
     * {
     *   "task_ids": [123, 124, 125]
     * }
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "total": 3,
     *     "results": [
     *       {
     *         "task_id": 123,
     *         "status": "completed",
     *         "audio_path": "en/word/abc.mp3",
     *         "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/abc.mp3"
     *       },
     *       {
     *         "task_id": 124,
     *         "status": "pending",
     *         "queue_position": 42
     *       },
     *       {
     *         "task_id": 125,
     *         "task_type": "article",
     *         "status": "completed",
     *         "audio_files": [...],
     *         "sentence_mapping": [...]
     *       }
     *     ]
     *   }
     * }
     */
    public function batchGetTasks(\App\Apps\AppQyV1\AppQyV1Requests\AppQyV1BatchGetTTSTasksRequest $request): JsonResponse
    {
        $taskIds = $request->input('task_ids');

        $result = $this->queueService->batchGetTasks($taskIds);

        return $this->success($this->addLogsToResponse($result), 'Batch tasks retrieved successfully');
    }

    /**
     * Intelligent batch query - supports both task_id and content
     * Auto-creates tasks if files don't exist
     *
     * POST /api/app_qy_v1/ai_tools/tts/queue/batch/query
     *
     * Request:
     * {
     *   "queries": [
     *     {"task_id": 123},
     *     {"content": "hello", "language": "en", "type": "word"},
     *     {"content": "How are you?", "language": "en"}
     *   ],
     *   "default_position": "end"
     * }
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "total": 3,
     *     "results": [
     *       {
     *         "index": 0,
     *         "query_type": "task_id",
     *         "task_id": 123,
     *         "status": "completed",
     *         "audio_url": "..."
     *       },
     *       {
     *         "index": 1,
     *         "query_type": "content",
     *         "source": "existing_file",
     *         "status": "file_available",
     *         "audio_url": "..."
     *       },
     *       {
     *         "index": 2,
     *         "query_type": "content",
     *         "source": "newly_created",
     *         "task_id": 456,
     *         "status": "pending"
     *       }
     *     ]
     *   }
     * }
     */
    public function intelligentBatchQuery(\App\Apps\AppQyV1\AppQyV1Requests\AppQyV1IntelligentBatchQueryRequest $request): JsonResponse
    {
        $user = \App\Helpers\AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $queries = $request->input('queries');
        $defaultPosition = $request->input('default_position', 'end');

        $result = $this->queueService->intelligentBatchQuery($queries, $defaultPosition);

        return $this->success($this->addLogsToResponse($result), 'Intelligent batch query completed successfully');
    }

    /**
     * Get recent task logs
     *
     * GET /api/app_qy_v1/ai_tools/tts/queue/logs
     *
     * Query params:
     * - limit: Number of logs to retrieve (default: 100, max: 1000)
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "total": 100,
     *     "limit": 100,
     *     "logs": [...]
     *   }
     * }
     */
    public function getLogs(Request $request): JsonResponse
    {
        $limit = min((int)$request->input('limit', 100), 1000);

        $result = $this->queueService->getRecentLogs($limit);

        return $this->success($result, 'Logs retrieved successfully');
    }

    /**
     * Re-queue all failed tasks to beginning of queue
     *
     * POST /api/app_qy_v1/ai_tools/tts/queue/requeue-failed
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "success": true,
     *     "requeued_count": 5
     *   }
     * }
     */
    public function requeueFailedTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $result = $this->queueService->requeueFailedTasks();

        return $this->success($this->addLogsToResponse($result), 'Failed tasks re-queued successfully');
    }

    /**
     * Add task at specific position in queue
     *
     * POST /api/app_qy_v1/ai_tools/tts/queue/add-at-position
     *
     * Request:
     * {
     *   "content": "hello world",
     *   "language": "en",
     *   "type": "word",
     *   "position": "beginning" | "end"
     * }
     *
     * Response:
     * {
     *   "status": "success",
     *   "data": {
     *     "task_id": 123,
     *     "task_type": "word",
     *     "queue_status": "queued",
     *     "queue_position": 42
     *   }
     * }
     */
    public function addTaskAtPosition(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $request->validate([
            'content' => 'required|string|max:10000',
            'language' => 'required|string|max:10',
            'type' => ['nullable', 'string', Rule::in(QueueCenterContract::queuePositionOrderedTaskAliases())],
            'position' => 'required|string|in:beginning,end',
        ]);

        $result = $this->queueService->addTaskAtPosition(
            $request->input('content'),
            $request->input('language'),
            $request->input('type'),
            $request->input('position')
        );

        if (!$result['success']) {
            return $this->error($result['error'] ?? 'Failed to add task', 400);
        }

        return $this->success($this->addLogsToResponse($result), 'Task added successfully');
    }

    /**
     * Add recent logs to response data
     *
     * @param array $data Original response data
     * @param int $logLimit Number of logs to include (default: 100)
     * @return array Response data with logs added
     */
    private function addLogsToResponse(array $data, int $logLimit = 100): array
    {
        $logs = $this->queueService->getRecentLogs($logLimit);

        return array_merge($data, [
            'recent_logs' => $logs['logs'] ?? [],
            'logs_count' => $logs['total'] ?? 0,
        ]);
    }
}
