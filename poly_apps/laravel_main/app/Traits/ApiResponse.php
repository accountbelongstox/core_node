<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Contracts\Validation\Validator;
use App\Constants\ErrorCodes;

/**
 * API Response Trait
 * Standardized JSON response format for all API endpoints
 * NO try-catch blocks - trust data structures
 *
 * Extended features:
 * - Supports error codes (errorWithCode)
 * - Automatically extracts supported_params (validationErrorWithParams)
 * - Shortcut methods (created, noContent, conflict)
 * - notFound/unauthorized with additional data support
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

    /**
     * Return a standard error envelope with an application code and details.
     */
    protected function codedError(
        string $errorCode,
        string $message,
        $details = null,
        int $httpCode = 400
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'data' => $details,
            'details' => $details,
            'error' => $message,
            'message' => $message,
            'error_code' => $errorCode,
            'code' => $httpCode,
            'status' => 'error',
        ], $httpCode);
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

    /**
     * Auth error response with error_code for frontend i18n (login/register).
     */
    protected function authErrorResponse(string $errorCode, int $httpCode = 422): JsonResponse
    {
        $message = ErrorCodes::getMessage($errorCode);
        return response()->json([
            'success' => false,
            'data' => null,
            'error' => $message,
            'message' => $message,
            'error_code' => $errorCode,
            'code' => $httpCode,
            'status' => 'error',
        ], $httpCode);
    }

    // ==================== New Methods ====================

    /**
     * Return an error response using an error code
     * Supports multilingual error messages
     */
    protected function errorWithCode(
        string $errorCode,
        ?string $customMessage = null,
        ?int $httpCode = null,
        $data = null,
        string $locale = 'en'
    ): JsonResponse {
        $message = $customMessage ?? ErrorCodes::getMessage($errorCode, $locale);
        $code = $httpCode ?? ErrorCodes::getHttpCode($errorCode);

        return response()->json([
            'success' => false,
            'error_code' => $errorCode,
            'error' => $message,
            'message' => $message,
            'data' => $data,
            'code' => $code,
            'status' => 'error',
        ], $code);
    }

    /**
     * Validation failure response - automatically extracts supported_params
     * Automatically extracts the parameter list from the validator rules
     */
    protected function validationErrorWithParams(Validator $validator): JsonResponse
    {
        $supportedParams = array_keys($validator->getRules());

        return response()->json([
            'success' => false,
            'error' => $validator->errors()->first(),
            'message' => $validator->errors()->first(),
            'data' => ['supported_params' => $supportedParams],
            'code' => 400,
            'status' => 'error',
        ], 400);
    }

    /**
     * notFound with additional data support
     */
    protected function notFoundWithData(string $message, $data = null): JsonResponse
    {
        return $this->error($message, 404, $data);
    }

    /**
     * unauthorized with additional data support
     */
    protected function unauthorizedWithData(string $message, $data = null): JsonResponse
    {
        return $this->error($message, 401, $data);
    }

    /**
     * Resource created successfully response (201)
     */
    protected function created($data = null, string $message = 'Resource created successfully'): JsonResponse
    {
        return $this->success($data, $message, 201);
    }

    /**
     * No content response (204)
     */
    protected function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    /**
     * Conflict error response (409)
     */
    protected function conflict(string $message = 'Resource conflict', $data = null): JsonResponse
    {
        return $this->error($message, 409, $data);
    }

    /**
     * Paginated response
     */
    protected function paginated($items, string $message = 'Success'): JsonResponse
    {
        if (method_exists($items, 'items')) {
            // Laravel Paginator
            return $this->success([
                'items' => $items->items(),
                'total' => $items->total(),
                'per_page' => $items->perPage(),
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
            ], $message);
        }

        // Plain array
        return $this->success($items, $message);
    }

    // ==================== Shortcut Error Methods (based on error codes) ====================

    /**
     * Group not found
     */
    protected function groupNotFound($data = null): JsonResponse
    {
        return $this->errorWithCode(ErrorCodes::GROUP_NOT_FOUND, null, null, $data);
    }

    /**
     * Library not found
     */
    protected function libraryNotFound($data = null): JsonResponse
    {
        return $this->errorWithCode(ErrorCodes::LIBRARY_NOT_FOUND, null, null, $data);
    }

    /**
     * Word not found
     */
    protected function wordNotFound($data = null): JsonResponse
    {
        return $this->errorWithCode(ErrorCodes::WORD_NOT_FOUND, null, null, $data);
    }

    /**
     * Language mismatch
     */
    protected function languageMismatch(string $libraryLang, string $groupLang, $data = null): JsonResponse
    {
        $message = "Library language ({$libraryLang}) does not match group language ({$groupLang})";
        $additionalData = array_merge([
            'library_language' => $libraryLang,
            'group_language' => $groupLang,
        ], $data ?? []);

        return $this->errorWithCode(ErrorCodes::LANGUAGE_MISMATCH, $message, null, $additionalData);
    }

    /**
     * Library already added
     */
    protected function libraryAlreadyAdded($data = null): JsonResponse
    {
        return $this->errorWithCode(ErrorCodes::LIBRARY_ALREADY_ADDED, null, null, $data);
    }

    /**
     * Library not linked
     */
    protected function libraryNotLinked($data = null): JsonResponse
    {
        return $this->errorWithCode(ErrorCodes::LIBRARY_NOT_LINKED, null, null, $data);
    }
}
