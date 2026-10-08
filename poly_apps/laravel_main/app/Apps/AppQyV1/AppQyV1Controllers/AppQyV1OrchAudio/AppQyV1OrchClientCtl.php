<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio;

use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Services\WorkLeases\OrchClientMonitorService;
use App\Services\WorkLeases\WorkLeaseAssignments;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Wordnew client telemetry for the orchestration monitor (Sanctum;
 * audio_orchestration_contract client_monitor). Latest state only.
 */
class AppQyV1OrchClientCtl extends Controller
{
    use ApiResponse;

    private const ERROR_VALIDATION_FAILED = 'ORCH_CLIENT_REPORT_VALIDATION_FAILED';
    private const INSTANCE_ID_MAX = 64;
    private const TEXT_MAX = 128;

    public function __construct(private readonly OrchClientMonitorService $monitor)
    {
    }

    public function report(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);

        if ($user === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->all(), [
            'device_id' => ['required', 'string', 'max:' . (int) WorkLeaseAssignments::setting('device_id_max_chars')],
            'instance_id' => ['required', 'string', 'max:' . self::INSTANCE_ID_MAX],
            'seq' => ['required', 'integer', 'min:0'],
            'sent_at' => ['nullable', 'string', 'max:40'],
            'platform' => ['nullable', 'string', 'in:native,web'],
            'app_version' => ['nullable', 'string', 'max:40'],
            'foreground' => ['nullable', 'boolean'],
            'route' => ['nullable', 'array'],
            'route.tab' => ['nullable', 'string', 'max:' . self::TEXT_MAX],
            'route.item' => ['nullable', 'string', 'max:' . self::TEXT_MAX],
            'route.changed_at' => ['nullable', 'string', 'max:40'],
            'channels' => ['nullable', 'array'],
            'tasks' => ['nullable', 'array', 'max:' . (int) OrchClientMonitorService::setting('max_tasks')],
            'tasks.*.task_id' => ['required', 'string', 'max:' . self::TEXT_MAX],
            'tasks.*.plan_id' => ['nullable', 'string', 'max:40'],
            'tasks.*.state' => ['nullable', 'string', 'max:40'],
            'tasks.*.counts' => ['nullable', 'array'],
            'tasks.*.stages' => ['nullable', 'array'],
            'assignments' => ['nullable', 'array', 'max:' . (int) OrchClientMonitorService::setting('max_assignments')],
            'assignments.*.plan_id' => ['required', 'string', 'max:40'],
            'assignments.*.windows' => ['nullable', 'array', 'max:' . (int) OrchClientMonitorService::setting('max_windows')],
        ]);
        if ($validator->fails()) {
            return $this->codedError(self::ERROR_VALIDATION_FAILED, __('audio_orchestration.orch_client_report_validation_failed'), ['errors' => $validator->errors()->toArray()], 422);
        }
        $report = $request->only(['device_id', 'instance_id', 'seq', 'sent_at', 'platform', 'app_version', 'foreground', 'route', 'channels', 'tasks', 'assignments']);
        $report['seq'] = (int) $report['seq'];
        $maxBytes = (int) OrchClientMonitorService::setting('max_bytes');
        if (strlen((string) json_encode($report)) > $maxBytes) {
            return $this->codedError(self::ERROR_VALIDATION_FAILED, __('audio_orchestration.orch_client_report_validation_failed'), ['errors' => ['report' => ['max_bytes:' . $maxBytes]]], 422);
        }

        return $this->success(
            $this->monitor->report((int) $user->id, (string) ($user->name ?? ''), $report),
            __('audio_orchestration.orch_client_report_saved')
        );
    }
}
