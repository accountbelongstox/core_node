<?php

namespace App\Apps\AChatV1\AChatV1Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use App\Apps\AChatV1\AChatV1ApiInfo;

/**
 * AChatV1 API Info Controller
 * 
 * Handles API information and health check endpoints
 */
class AChatV1ApiInfoCtl extends Controller
{
    /**
     * Get API information
     * 
     * @return JsonResponse
     */
    public function info(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => AChatV1ApiInfo::getInfo(),
        ], 200);
    }

    /**
     * Get API health status
     * 
     * @return JsonResponse
     */
    public function health(): JsonResponse
    {
        $health = AChatV1ApiInfo::getHealthStatus();
        $statusCode = $health['success'] && $health['status'] === 'healthy' ? 200 : 503;

        return response()->json($health, $statusCode);
    }
}

