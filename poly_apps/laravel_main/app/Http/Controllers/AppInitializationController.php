<?php

namespace App\Http\Controllers;

use App\Services\AppInitializationManager;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;

/**
 * App Initialization Controller
 * Uses standardized ApiResponse trait
 */
class AppInitializationController extends Controller
{
    use ApiResponse;

    private $manager;

    public function __construct()
    {
        $this->manager = AppInitializationManager::withDefaultInitializers();
    }

    public function status(Request $request): JsonResponse
    {
        $detailed = $request->input('detailed', false);
        $result = $this->manager->checkStatus();

        if ($detailed) {
            $result['detailed'] = $this->manager->getDetailedStatus();
        }

        return $this->success($result, __('api.messages.status_retrieved_successfully'));
    }

    public function initializeAll(Request $request): JsonResponse
    {
        $force = $request->input('force', false);
        $result = $this->manager->initializeAll($force);

        return $this->success($result, __('api.messages.initialization_completed'));
    }

    public function initialize(Request $request, string $appName): JsonResponse
    {
        $force = $request->input('force', false);
        $result = $this->manager->initialize($appName, $force);

        if (!$result['success'] && isset($result['available_apps'])) {
            return $this->notFound("App '{$appName}' not found");
        }

        return $this->success($result, __('api.messages.app_initialized_successfully'));
    }

    public function reset(Request $request, string $appName): JsonResponse
    {
        $result = $this->manager->reset($appName);
        return $this->success($result, __('api.messages.app_reset_successfully'));
    }

    public function listApps(Request $request): JsonResponse
    {
        $apps = $this->manager->getRegisteredApps();
        return $this->success(['apps' => $apps], __('api.messages.apps_list_retrieved_successfully'));
    }
}
