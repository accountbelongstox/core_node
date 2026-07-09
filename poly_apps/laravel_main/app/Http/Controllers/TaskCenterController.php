<?php

namespace App\Http\Controllers;

use App\Models\GlobalTask;
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

    /**
     * Which client(s) are eligible to claim a task of each capability, derived
     * from the canonical downgrade decision: translate races on BOTH clients;
     * audio + image are PYCORE-ONLY (chrome has no audio/image lane);
     * sentence_audio is chrome's web-audio assist; subtitle/poster are
     * pycore-only retrieval lanes. NULL capability (any) is reported separately
     * as the union of all clients. Keep this in lock-step with GlobalTask's
     * CAPABILITY_* vocabulary and capabilityMatches() — never advertise a
     * claimant a client cannot actually fulfill (the dead 'image'-on-chrome
     * bug B17).
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
            'timestamp' => now()->toISOString(),
        ], 'Task center overview retrieved successfully');
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
     * Counts come from ONE grouped query over the live (pending/processing)
     * rows, keyed by (capability, is_fast_tier, status), so the overview stays a
     * single poll.
     *
     * @return array<int,array<string,mixed>>
     */
    private function buildCategories(): array
    {
        $live = [GlobalTask::STATUS_PENDING, GlobalTask::STATUS_PROCESSING];

        // (capability, is_fast_tier, status) -> count over live rows only.
        $rows = GlobalTask::query()
            ->whereIn('status', $live)
            ->groupBy('capability', 'is_fast_tier', 'status')
            ->selectRaw('capability, is_fast_tier, status, count(*) as total')
            ->get();

        $tally = [];
        foreach ($rows as $row) {
            $cap = $row->capability ?? '_null';
            $fastKey = $row->is_fast_tier ? 'fast' : 'single';
            $tally[$cap][$fastKey][$row->status] = (int) $row->total;
        }

        // Online-worker coverage: for each capability, is there ANY online
        // worker that can actually claim its tasks? Answered per-lane so the UI
        // can show exactly WHY a category is stuck:
        //   fast_lane:   worker has remote_fast in processor_types AND the cap
        //                in capabilities (the capability-match narrowing).
        //   single_lane: worker has the dedicated execution_type (from
        //                CAPABILITY_SINGLE_LANE) in processor_types. Capabilities
        //                with no dedicated lane (image, ai_translate) are
        //                always false for single_lane - they ride fast only.
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
}
