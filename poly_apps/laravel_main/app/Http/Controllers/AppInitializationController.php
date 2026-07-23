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

        return $this->success($result, 'Status retrieved successfully');
    }

    public function initializeAll(Request $request): JsonResponse
    {
        $force = $request->input('force', false);
        $result = $this->manager->initializeAll($force);

        return $this->success($result, 'Initialization completed');
    }

    public function initialize(Request $request, string $appName): JsonResponse
    {
        $force = $request->input('force', false);
        $result = $this->manager->initialize($appName, $force);

        if (!$result['success'] && isset($result['available_apps'])) {
            return $this->notFound("App '{$appName}' not found");
        }

        return $this->success($result, 'App initialized successfully');
    }

    public function reset(Request $request, string $appName): JsonResponse
    {
        $result = $this->manager->reset($appName);
        return $this->success($result, 'App reset successfully');
    }

    public function listApps(Request $request): JsonResponse
    {
        $apps = $this->manager->getRegisteredApps();
        return $this->success(['apps' => $apps], 'Apps list retrieved successfully');
    }
}
