<?php

namespace App\Http\Controllers;

use App\Services\OctaneTimerService;
use App\Services\TaskManagerService;
use App\Services\WorkerManagerService;
use Illuminate\Http\JsonResponse;
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
     * How each timer task relates to the global task queue. Timers absent
     * from this map are pure scheduled jobs with no queue role. `target`
     * names the queue task_type (or subsystem) the timer touches.
     */
    private const TIMER_QUEUE_ROLES = [
        'app_qy_v1_word_translation_scan_task' => [
            'role' => 'producer',
            'target' => 'word_translation',
        ],
        'app_qy_v1_dictionary_translation_task' => [
            'role' => 'producer',
            'target' => 'dictionary_explanation',
        ],
        'app_qy_v1_word_translation_filler_task' => [
            'role' => 'consumer',
            'target' => 'word_translation',
            'worker_id' => 'laravel-internal-ai',
        ],
        'global_task_maintenance_task' => [
            'role' => 'maintainer',
            'target' => '*',
        ],
    ];

    protected $taskManager;
    protected $workerManager;

    public function __construct(TaskManagerService $taskManager, WorkerManagerService $workerManager)
    {
        $this->taskManager = $taskManager;
        $this->workerManager = $workerManager;
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
        $timerStatus = OctaneTimerService::getStatus();

        $schedulerTasks = [];
        $timerTasks = [];
        if (isset($timerStatus['tasks']) && is_array($timerStatus['tasks'])) {
            $timerTasks = $timerStatus['tasks'];
        }

        foreach ($timerTasks as $name => $stats) {
            $entry = [
                'name' => $name,
                'interval' => $stats['interval'] ?? null,
                'run_count' => $stats['run_count'] ?? 0,
                'error_count' => $stats['error_count'] ?? 0,
                'last_run' => $stats['last_run'] ?? null,
                'last_run_ago' => $stats['last_run_ago'] ?? null,
                'last_duration' => $stats['last_duration'] ?? null,
                'last_error' => $stats['last_error'] ?? null,
                'queue_role' => null,
                'queue_target' => null,
            ];

            if (isset(self::TIMER_QUEUE_ROLES[$name])) {
                $entry['queue_role'] = self::TIMER_QUEUE_ROLES[$name]['role'];
                $entry['queue_target'] = self::TIMER_QUEUE_ROLES[$name]['target'];
            }

            $schedulerTasks[] = $entry;
        }

        $relations = [];
        foreach (self::TIMER_QUEUE_ROLES as $timerName => $meta) {
            $relations[] = [
                'timer' => $timerName,
                'role' => $meta['role'],
                'target' => $meta['target'],
                'worker_id' => $meta['worker_id'] ?? null,
                'registered' => array_key_exists($timerName, $timerTasks),
            ];
        }

        return $this->success([
            'scheduler' => [
                'running' => (bool) ($timerStatus['running'] ?? false),
                'uptime' => $timerStatus['uptime'] ?? null,
                'total_ticks' => $timerStatus['total_ticks'] ?? 0,
                'tasks' => $schedulerTasks,
            ],
            'queue' => [
                'stats' => $this->taskManager->getTaskStats(),
            ],
            'workers' => [
                'stats' => $this->workerManager->getWorkerStats(),
            ],
            'relations' => $relations,
            'timestamp' => now()->toISOString(),
        ], 'Task center overview retrieved successfully');
    }
}
