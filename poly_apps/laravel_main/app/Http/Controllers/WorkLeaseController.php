<?php

namespace App\Http\Controllers;

use App\Services\PycoreTasks\PycoreComputeRoster;
use App\Services\WorkLeases\OrchClientMonitorService;
use App\Services\WorkLeases\WorkLeaseLanes;
use App\Services\WorkLeases\WorkLeaseService;
use App\Support\QueueCenterContract;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Work-lease endpoints (config/queue_center_contract.json endpoints
 * work_lease_claim / work_lease_renew / work_lease_release / work_nodes;
 * shapes in its work_leases section).
 */
class WorkLeaseController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly WorkLeaseService $leases)
    {
    }

    public function claim(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_id' => 'required|string|max:100',
            'compute_class' => ['required', 'string', Rule::in(PycoreComputeRoster::CLASSES)],
            'node_id' => 'nullable|string|max:32',
            'platform' => 'nullable|string|max:20',
            'label' => 'nullable|string|max:32',
            'lan_urls' => 'nullable|array|max:' . WorkLeaseService::LAN_URLS_MAX,
            'lan_urls.*' => ['string', 'max:64', 'regex:' . WorkLeaseService::LAN_URL_PATTERN],
            'throughput_per_hour' => 'nullable',
            'lanes' => 'required|array|min:1',
            'lanes.*' => 'array',
            'lanes.*.languages' => 'required|array|min:1',
            'lanes.*.languages.*' => 'string|max:20',
            'lanes.*.engines' => 'nullable|array',
            'lanes.*.max_items' => 'nullable|integer|min:0',
            'want' => 'nullable|array|max:' . (int) QueueCenterContract::section('work_leases')['want_max'],
            'want.*.lane' => ['required_with:want', 'string', Rule::in(WorkLeaseLanes::lanes())],
            'want.*.language' => 'required_with:want|string|max:20',
            'want.*.content_key' => 'nullable|string|max:64',
            'want.*.text' => 'nullable|string|max:255',
            'plan_id' => 'nullable|string|max:40',
            'lease_ids' => 'nullable|array',
            'lease_ids.*' => 'string|max:64',
            'load' => 'nullable|array',
        ]);

        return $this->success($this->leases->claim($validated), __('api.messages.work_lease_claimed'));
    }

    public function renew(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_id' => 'required|string|max:100',
            'lease_ids' => 'required|array',
            'lease_ids.*' => 'string|max:64',
            'load' => 'nullable|array',
        ]);

        return $this->success($this->leases->renewWithProgress($validated['worker_id'], $validated['lease_ids'], $validated['load'] ?? null), __('api.messages.work_lease_renewed'));
    }

    public function release(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_id' => 'required|string|max:100',
            'lease_id' => 'nullable|string|max:64',
            'rows' => 'nullable|array',
            'rows.*.lane' => ['required_with:rows', 'string', Rule::in(WorkLeaseLanes::lanes())],
            'rows.*.row_id' => 'required_with:rows|integer|min:1',
        ]);

        return $this->success(
            $this->leases->release($validated['worker_id'], $validated['lease_id'] ?? null, $validated['rows'] ?? []),
            __('api.messages.work_lease_released')
        );
    }

    public function nodes(Request $request): JsonResponse
    {
        return $this->success($this->leases->nodes($request->boolean('online')), __('api.messages.work_nodes_listed'));
    }

    /** GET work/monitor: wordnew clients, nodes with load, pool and book plans with their scheduling mode. */
    public function monitor(): JsonResponse
    {
        return $this->success(app(OrchClientMonitorService::class)->monitor(), __('api.messages.work_monitor_listed'));
    }
}
