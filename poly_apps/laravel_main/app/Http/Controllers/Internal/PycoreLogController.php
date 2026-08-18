<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Services\Logs\LaravelLogTailService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PycoreLogController extends Controller
{
    private LaravelLogTailService $logTailService;

    public function __construct(LaravelLogTailService $logTailService)
    {
        $this->logTailService = $logTailService;
    }

    /**
     * Get the latest Laravel logs for Pycore mirroring.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getLatestLogs(Request $request): JsonResponse
    {
        $fileId = $request->query('file_id');
        $offset = $request->query('offset');
        
        // Convert offset to int if provided
        if ($offset !== null) {
            $offset = (int) $offset;
        }

        $limit = (int) $request->query('limit', 200);
        // Enforce maximum limit
        if ($limit > 500) {
            $limit = 500;
        }

        $maxBytes = (int) $request->query('max_bytes', 262144); // Default 256KB
        // Enforce maximum bytes (e.g., 1MB)
        if ($maxBytes > 1048576) {
            $maxBytes = 1048576;
        }

        $result = $this->logTailService->getLatestLogs($fileId, $offset, $limit, $maxBytes);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'] ?? 'Unknown error',
            ], 400);
        }

        return response()->json($result);
    }
}
