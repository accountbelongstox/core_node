<?php

namespace App\Apps\CodeMartV1\CodeMartV1Controllers;

use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1BootstrapService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CodeMartV1BootstrapCtl extends Controller
{
    use ApiResponse;

    public function __construct(private readonly CodeMartV1BootstrapService $bootstrapService)
    {
    }

    /**
     * GET /bootstrap: the single CodeMart contract authority — user
     * projection, roles, capabilities, onboarding truth, state vocabulary,
     * policy, and dashboard counters.
     */
    public function bootstrap(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $payload = $this->bootstrapService->buildForUser((int) $user->id);
        if ($payload === null) {
            return $this->notFound('User not found');
        }

        return $this->success($payload);
    }
}
