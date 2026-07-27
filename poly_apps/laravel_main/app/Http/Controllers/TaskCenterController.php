<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
use App\Models\Worker;
use App\Services\OctaneTimerService;
use App\Services\TaskManagerService;
use App\Services\UserConfig\UserConfigService;
use App\Services\WorkerManagerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    /**
     * Eligible clients are read from GlobalTask's canonical capability maps.
     * Chrome owns browser-driven image/poster work and shares translation/audio
     * where both runtimes advertise the capability. NULL capability is reported
     * separately as the union of all clients.
     */
    // Both maps are canonical on GlobalTask — this controller reads them from
    // there so the Queue Center and the pycore-manager overview never contradict.

    protected $taskManager;
    protected $workerManager;

    public function __construct(TaskManagerService $taskManager, WorkerManagerService $workerManager)
    {
        $this->taskManager = $taskManager;
        $this->workerManager = $workerManager;
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
                // Additive: per-capability category placement (fast-lane vs its
                // single dedicated lane), per-lane pending/processing counts, and
                // the eligible claimant client(s) — so a client can see the
                // intended dual-client race without opening per-task detail.
                'categories' => $this->buildCategories(),
            ],
            'workers' => [
                'stats' => $this->workerManager->getWorkerStats(),
            ],
            'relations' => $relations,
            'section_contracts' => $this->buildSectionContracts(),
            'timestamp' => now()->toISOString(),
        ], 'Task center overview retrieved successfully');
    }

    /**
     * GET /api/task-center/completed
     * Cursor-paginated terminal GlobalTask records for pycore's local archive.
     */
    public function completed(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->input('limit', 200), 500));
        $cursorId = max(0, (int) $request->input('cursor_id', 0));
        $taskType = trim((string) $request->input('task_type', ''));
        $terminal = [
            GlobalTask::STATUS_COMPLETED,
            GlobalTask::STATUS_COMPLETED_DEMO,
            GlobalTask::STATUS_FAILED,
            GlobalTask::STATUS_CANCELLED,
        ];
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
        $types = GlobalTask::query()
            ->whereIn('status', $terminal)
            ->whereNotNull('task_type')
            ->groupBy('task_type')
            ->selectRaw('task_type, count(*) as total')
            ->orderBy('task_type')
            ->get()
            ->mapWithKeys(static function ($row) {
                return [(string) $row->task_type => (int) $row->total];
            });
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

    /**
     * Build the per-capability category breakdown.
     *
     * For each capability we report, in TWO orthogonal lanes:
     *   - fast_lane: pending/processing on the shared remote_fast lane narrowed
     *     to this capability (the interactive dual-client race);
     *   - single_lane: pending/processing on every NON-fast execution_type lane
     *     for the same capability (the background / dedicated-worker lane).
     * Plus claimants[] — which client(s) may actually claim this capability,
     * derived from CAPABILITY_CLAIMANTS (the canonical downgrade), so the FE
     * never hardcodes routing.
     *
     * Counts come from one grouped query over the live rows, keyed by
     * (capability, execution_type, status). The lane is determined by the
     * execution type, not the priority-tier marker.
     *
     * @return array<int,array<string,mixed>>
     */
    private function buildCategories(): array
    {
        $live = [GlobalTask::STATUS_PENDING, GlobalTask::STATUS_PROCESSING];

        // (capability, execution_type, status) -> count over live rows only.
        $rows = GlobalTask::query()
            ->whereIn('status', $live)
            ->groupBy('capability', 'execution_type', 'status')
            ->selectRaw('capability, execution_type, status, count(*) as total')
            ->get();

        $tally = [];
        foreach ($rows as $row) {
            $cap = $row->capability ?? '_null';
            $fastKey = $row->execution_type === GlobalTask::EXECUTION_REMOTE_FAST
                ? 'fast'
                : 'single';
            $tally[$cap][$fastKey][$row->status] = (int) $row->total;
        }

        // Online-worker coverage: for each capability, is there ANY online
        // worker that can actually claim its tasks? Answered per-lane so the UI
        // can show exactly WHY a category is stuck:
        //   fast_lane:   worker has remote_fast in processor_types AND the cap
        //                in capabilities (the capability-match narrowing).
        //   single_lane: worker has the dedicated execution_type (from
        //                CAPABILITY_SINGLE_LANE) in processor_types. Capabilities
        //                with no dedicated lane (ai_translate) are false for
        //                single_lane; image also has the dedicated Gemini lane.
        //   NULL-cap:    any online worker at all.
        $onlineWorkers = Worker::online()->get();
        $onlineFastCaps = [];   // set of capabilities any online fast worker advertises
        $onlineSingleExec = []; // set of execution_types any online worker registers
        $anyOnline = $onlineWorkers->isNotEmpty();
        foreach ($onlineWorkers as $w) {
            $pt = is_array($w->processor_types) ? $w->processor_types : [];
            $caps = $w->capabilityList();
            if (in_array(GlobalTask::EXECUTION_REMOTE_FAST, $pt, true)) {
                foreach ($caps as $c) {
                    $onlineFastCaps[$c] = true;
                }
            }
            foreach ($pt as $exec) {
                $onlineSingleExec[$exec] = true;
            }
        }

        $lane = static function (array $tally, string $cap, string $fastKey, bool $hasOnline): array {
            $bucket = $tally[$cap][$fastKey] ?? [];
            return [
                'pending' => (int) ($bucket[GlobalTask::STATUS_PENDING] ?? 0),
                'processing' => (int) ($bucket[GlobalTask::STATUS_PROCESSING] ?? 0),
                // True when at least one online worker can claim this category's
                // tasks on this lane. False with pending>0 = stuck: no worker
                // registers the lane/capability - the UI can show the cause.
                'has_online_worker' => $hasOnline,
            ];
        };

        $categories = [];
        foreach (GlobalTask::CAPABILITIES as $cap) {
            $fastHasOnline = isset($onlineFastCaps[$cap]);
            $singleExec = GlobalTask::CAPABILITY_SINGLE_LANE[$cap] ?? null;
            $singleHasOnline = $singleExec !== null && isset($onlineSingleExec[$singleExec]);
            $categories[] = [
                'capability' => $cap,
                'claimants' => GlobalTask::CAPABILITY_CLAIMANTS[$cap] ?? [],
                'fast_lane' => $lane($tally, $cap, 'fast', $fastHasOnline),
                'single_lane' => $lane($tally, $cap, 'single', $singleHasOnline),
            ];
        }

        // NULL-capability tasks (any eligible client). Reported as its own
        // category so its counts are never silently dropped from the overview.
        $categories[] = [
            'capability' => null,
            'claimants' => ['pycore', 'chrome'],
            'fast_lane' => $lane($tally, '_null', 'fast', $anyOnline),
            'single_lane' => $lane($tally, '_null', 'single', $anyOnline),
        ];

        return $categories;
    }

    /**
     * Build the unified section contracts for Laravel-owned scopes.
     */
    private function buildSectionContracts(): array
    {
        $config = app(UserConfigService::class);
        $toggleState = [
            'requested_by' => null,
            'enabled' => (bool) $config->get('laravel_translation_enabled', false),
            'reason' => null,
            'paused_by_user' => $config->get('laravel_translation_paused') !== null ? (bool) $config->get('laravel_translation_paused') : null,
            'graceful_stop' => (bool) $config->get('laravel_translation_graceful_stop', false),
        ];
        
        $categories = $this->buildCategories();
        $aiTranslateStats = ['pending' => 0, 'processing' => 0, 'leased' => 0, 'total' => 0];
        foreach ($categories as $cat) {
            if ($cat['capability'] === 'ai_translate' || $cat['capability'] === 'word_translation') {
                $aiTranslateStats['pending'] += $cat['single_lane']['pending'] + $cat['fast_lane']['pending'];
                $aiTranslateStats['processing'] += $cat['single_lane']['processing'] + $cat['fast_lane']['processing'];
            }
        }
        $aiTranslateStats['total'] = $aiTranslateStats['pending'] + $aiTranslateStats['processing'];
        
        $workerStats = $this->workerManager->getWorkerStats();
        $online = ($workerStats['online'] ?? 0) > 0;
        
        $lifecycle = $toggleState['enabled'] ? 'on' : 'off';
        
        return [
            [
                'type' => 'laravel_translation',
                'category' => 'ai_translate',
                'queue' => $aiTranslateStats,
                'worker' => [
                    'online' => $online,
                    'claimed' => $workerStats['processing'] ?? 0,
                    'ok' => $workerStats['completed'] ?? 0,
                    'fail' => $workerStats['failed'] ?? 0,
                    'last_heartbeat' => null,
                ],
                'toggle' => $toggleState,
                'lifecycle' => $lifecycle,
                'error_code' => null,
                'last_error' => null,
                'updated_at' => now()->toISOString(),
            ]
        ];
    }
}
