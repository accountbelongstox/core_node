<?php

namespace App\Http\Controllers;

use App\Services\AppInitializationManager;
use App\Apps\AppQyV1\Utils\AppQyV1Initializer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AppInitializationController extends Controller
{
    private $manager;
    
    public function __construct()
    {
        $this->manager = new AppInitializationManager();
        
        $this->manager->register(new AppQyV1Initializer());
    }
    
    public function status(Request $request): JsonResponse
    {
        $detailed = $request->input('detailed', false);
        
        $result = $this->manager->checkStatus();
        
        if ($detailed) {
            $result['detailed'] = $this->manager->getDetailedStatus();
        }
        
        return response()->json($result);
    }
    
    public function initializeAll(Request $request): JsonResponse
    {
        $force = $request->input('force', false);
        
        $result = $this->manager->initializeAll($force);
        
        return response()->json($result);
    }
    
    public function initialize(Request $request, string $appName): JsonResponse
    {
        $force = $request->input('force', false);
        
        $result = $this->manager->initialize($appName, $force);
        
        if (!$result['success'] && isset($result['available_apps'])) {
            return response()->json($result, 404);
        }
        
        return response()->json($result);
    }
    
    public function reset(Request $request, string $appName): JsonResponse
    {
        $result = $this->manager->reset($appName);
        
        return response()->json($result);
    }
    
    public function listApps(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'apps' => $this->manager->getRegisteredApps(),
        ]);
    }
}
