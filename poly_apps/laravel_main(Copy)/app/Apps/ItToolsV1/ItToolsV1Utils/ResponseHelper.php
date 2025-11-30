<?php

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

use Illuminate\Http\JsonResponse;

class ResponseHelper
{
    public static function success($data = null, int $statusCode = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'timestamp' => now()->toIso8601String()
        ], $statusCode);
    }

    public static function error(string $code, string $message, $details = null, int $statusCode = 400): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details
            ],
            'timestamp' => now()->toIso8601String()
        ], $statusCode);
    }
}
