<?php

namespace App\Apps\McpV1\McpV1Controllers;

use App\Http\Controllers\Controller;
use App\Apps\McpV1\McpV1ApiInfo;
use Illuminate\Http\JsonResponse;

class McpV1ApiInfoCtl extends Controller
{
    /**
     * Get API information for McpV1
     */
    public function getApiInfo(): JsonResponse
    {
        return response()->json(McpV1ApiInfo::getApiInfo());
    }
}

