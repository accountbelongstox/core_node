<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Services\TaskCenterSummaryService;
use App\Services\UserConfig\UserConfigService;
use App\Support\QueueCenterContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Traits\ApiResponse;

/**
 * Task Center Controller — ONE aggregate view over BOTH task layers.
 *
 * The system runs two orthogonal task mechanisms (see
 * docs/GLOBAL_TASK_SYSTEM_FILES.md "两层任务机制"):
 *   - SCHEDULER layer: Octane timer tasks (in-process cron, 1s tick)
 *   - QUEUE layer:     global_tasks + workers (distributed work queue)
 * They intersect where timer tasks act as queue producers / consumers /
 * maintainers. This controller serves the unified Task Center UI one
 * overview payload (single poll) including that relationship metadata, so
 * the FE never has to hardcode which timer drives which queue flow.
 *
 * Detail/list endpoints stay where they are (/octane-tasks/*, /api/task/*,
 * /api/worker/*) — this is the composition layer, not a replacement.
 */
class TaskCenterController extends Controller
{
    use ApiResponse;

    /**
     * Eligible clients are read from GlobalTask's canonical capability maps.
     * Chrome owns browser-driven image/poster work and shares translation/audio
     * where both runtimes advertise the capability. NULL capability is reported
     * separately as the union of all clients.
     */
    // Both maps are canonical on GlobalTask — this controller reads them from
    // there so the Queue Center and the pycore-manager overview never contradict.

    protected $summaryService;

    public function __construct(TaskCenterSummaryService $summaryService)
    {
        $this->summaryService = $summaryService;
    }

    /**
     * GET /api/task-center/settings
     *
     * Soft-deprecated: pycore Queue Center is the sole control plane for
     * translation ON/OFF. laravel_translation_* keys are no longer written.
     * use_server_binary_assist remains readable for legacy callers.
     */
    public function getSettings(): JsonResponse
    {
        $config = app(UserConfigService::class);
        return $this->success([
            'deprecated' => true,
            'deprecation' => 'pycore Queue Center is the sole control plane; laravel_translation_* keys are unused.',
            'use_server_binary_assist' => $config->useServerBinaryAssist(),
        ], 'Task center settings (deprecated — use pycore Queue Center)');
    }

    /**
     * POST /api/task-center/settings
     *
     * Soft-deprecated no-op for laravel_translation_* keys (kept so old
     * callers do not 404). Optional use_server_binary_assist writes still
     * allowed for now; translation toggles must go through pycore.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $config = app(UserConfigService::class);
        if ($request->has('use_server_binary_assist')) {
            $ok = $config->set('use_server_binary_assist', $request->boolean('use_server_binary_assist'));
            if (!$ok) {
                return $this->error('Failed to write settings file', 500);
            }
        }
        // laravel_translation_* writes intentionally ignored — pycore is sole control plane.
        return $this->success([
            'deprecated' => true,
            'deprecation' => 'pycore Queue Center is the sole control plane; laravel_translation_* writes are ignored.',
            'use_server_binary_assist' => $config->useServerBinaryAssist(),
        ], 'Task center settings updated (deprecated — translation keys ignored)');
    }

    /**
     * GET /api/task-center/overview
     *
     * One poll for the unified Task Center page:
     *   scheduler — Octane timer runtime (running/ticks/uptime + per-task
     *               stats), each task annotated with its queue role;
     *   queue     — global task status counts (full 7-status vocabulary);
     *   workers   — worker pool counts;
     *   relations — the scheduler→queue role map (drives the overview
     *               relationship diagram in the UI).
     */
    public function overview(): JsonResponse
    {
        return $this->success(
            $this->summaryService->overview(),
            'Task center overview retrieved successfully'
        );
    }

    /**
     * GET /api/task-center/completed
     * Cursor-paginated terminal GlobalTask records for direct UI consumption.
     */
    public function completed(Request $request): JsonResponse
    {
        $completedLimit = QueueCenterContract::taskLimit('completed');
        $defaultLimit = QueueCenterContract::taskLimit('list');
        $limit = max(1, min((int) $request->input('limit', $defaultLimit), $completedLimit));
        $cursorId = max(0, (int) $request->input('cursor_id', 0));
        $taskType = trim((string) $request->input('task_type', ''));
        $includeTypes = $request->boolean('include_types', $cursorId === 0);
        $terminal = GlobalTask::statuses('terminal');
        $query = GlobalTask::query()->whereIn('status', $terminal);
        if ($cursorId > 0) {
            $query->where('id', '<', $cursorId);
        }
        if ($taskType !== '' && $taskType !== 'all') {
            if ($taskType === 'word_audio') {
                $query->where('task_type', 'like', '%word%')->where(function ($q) {
                    $q->where('task_type', 'like', '%audio%')->orWhere('task_type', 'like', '%tts%');
                });
            } elseif ($taskType === 'sentence_audio') {
                $query->where('task_type', 'like', '%sentence%')->where(function ($q) {
                    $q->where('task_type', 'like', '%audio%')->orWhere('task_type', 'like', '%tts%');
                });
            } elseif ($taskType === 'media_image') {
                $query->where(function ($q) {
                    $q->where('task_type', 'like', '%media%')
                      ->orWhere('task_type', 'like', '%image%')
                      ->orWhere('task_type', 'like', '%cover%')
                      ->orWhere('task_type', 'like', '%poster%');
                });
            } elseif ($taskType === 'translation') {
                $query->where(function ($q) {
                    $q->where('task_type', 'like', '%translate%')
                      ->orWhere('task_type', 'like', '%translation%');
                });
            } elseif ($taskType === 'assist') {
                $query->where('task_type', 'like', '%assist%');
            } else {
                $query->where('task_type', $taskType);
            }
        }
        $tasks = $query
            ->select([
                'id', 'task_id', 'app_name', 'task_type', 'execution_type',
                'capability', 'status', 'assigned_to', 'payload', 'result',
                'error', 'retry_count', 'created_at', 'updated_at', 'completed_at',
            ])
            ->orderByDesc('id')
            ->limit($limit)
            ->get();
        $types = collect();
        if ($includeTypes) {
            $types = GlobalTask::cachedCountsByTaskType('task-center:completed-types', 60, $terminal);
        }
        $records = $tasks->map(static function (GlobalTask $task) {
            return [
                'source_id' => (int) $task->id,
                'task_id' => $task->task_id,
                'app_name' => $task->app_name,
                'task_type' => $task->task_type,
                'execution_type' => $task->execution_type,
                'capability' => $task->capability,
                'status' => $task->status,
                'worker' => $task->assigned_to,
                'payload' => $task->payload,
                'result' => $task->result,
                'error' => $task->error,
                'retry_count' => (int) $task->retry_count,
                'created_at' => $task->created_at?->toISOString(),
                'updated_at' => $task->updated_at?->toISOString(),
                'completed_at' => $task->completed_at?->toISOString(),
                'is_local' => false,
                'source' => 'laravel',
                'last_error' => $task->error,
            ];
        })->values();
        $nextCursor = $tasks->isEmpty() ? null : (int) $tasks->last()->id;

        return $this->success([
            'records' => $records,
            'count' => $records->count(),
            'types' => $types,
            'next_cursor_id' => $records->count() === $limit ? $nextCursor : null,
        ], 'Completed task history retrieved successfully');
    }

}
