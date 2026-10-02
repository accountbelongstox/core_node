<?php

namespace App\Apps\AgentBus\AgentBusControllers;

use App\Apps\AgentBus\AgentBusApiInfo;
use App\Apps\AgentBus\AgentBusServices\AgentBusService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AgentBusCtl extends Controller
{
    use ApiResponse;

    public function __construct(private readonly AgentBusService $bus)
    {
    }

    /** Every REST operation: the route default `operation` names the contract operation. */
    public function call(Request $request): JsonResponse
    {
        $operation = (string) $request->route('operation');

        return $this->success($this->bus->call($operation, $request->all(), $request), $operation);
    }

    public function info(Request $request): JsonResponse
    {
        return $this->success(array_merge(AgentBusApiInfo::getApiInfo(), [
            'caller_authenticated' => AuthHelper::requireAuth($request) !== null,
        ]));
    }
}
