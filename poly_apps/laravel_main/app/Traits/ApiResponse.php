<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

/**
 * API Response Trait
 * Standardized JSON response format for all API endpoints
 * NO try-catch blocks - trust data structures
 */
trait ApiResponse
{
    protected function success($data = null, string $message = 'Success', int $code = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => $message,
            'code' => $code,
            'status' => 'success',
        ], $code);
    }

    protected function error(string $message, int $code = 400, $data = null): JsonResponse
    {
        return response()->json([
            'success' => false,
            'data' => $data,
            'error' => $message,
            'message' => $message,
            'code' => $code,
            'status' => 'error',
        ], $code);
    }

    protected function unauthorized(string $message = 'Unauthorized. Authentication required.'): JsonResponse
    {
        return $this->error($message, 401);
    }

    protected function forbidden(string $message = 'Unauthorized. Admin access required.'): JsonResponse
    {
        return $this->error($message, 403);
    }

    protected function notFound(string $message = 'Resource not found'): JsonResponse
    {
        return $this->error($message, 404);
    }

    protected function validationError($errors, string $message = 'Validation failed'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'data' => null,
            'errors' => $errors,
            'message' => $message,
            'code' => 422,
            'status' => 'error',
        ], 422);
    }
}
