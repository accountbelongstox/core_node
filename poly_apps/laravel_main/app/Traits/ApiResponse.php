<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Contracts\Validation\Validator;
use App\Apps\AppQyV1\AppQyV1Constants\AppQyV1ErrorCodes;
use App\Constants\AuthErrorCodes as AuthErrorCodesConstants;

/**
 * API Response Trait
 * Standardized JSON response format for all API endpoints
 * NO try-catch blocks - trust data structures
 *
 * 扩展功能:
 * - 支持错误码 (errorWithCode)
 * - 自动提取 supported_params (validationErrorWithParams)
 * - 快捷方法 (created, noContent, conflict)
 * - 支持附加数据的 notFound/unauthorized
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

    /**
     * Auth error response with error_code for frontend i18n (login/register).
     */
    protected function authErrorResponse(string $errorCode, int $httpCode = 422): JsonResponse
    {
        $message = AuthErrorCodesConstants::getMessage($errorCode);
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

    // ==================== 新增方法 ====================

    /**
     * 使用错误码返回错误响应
     * 支持多语言错误消息
     */
    protected function errorWithCode(
        string $errorCode,
        ?string $customMessage = null,
        ?int $httpCode = null,
        $data = null,
        string $locale = 'en'
    ): JsonResponse {
        $message = $customMessage ?? AppQyV1ErrorCodes::getMessage($errorCode, $locale);
        $code = $httpCode ?? AppQyV1ErrorCodes::getHttpCode($errorCode);

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
     * 验证失败响应 - 自动提取 supported_params
     * 从验证器规则中自动提取参数列表
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
     * 支持附加数据的 notFound
     */
    protected function notFoundWithData(string $message, $data = null): JsonResponse
    {
        return $this->error($message, 404, $data);
    }

    /**
     * 支持附加数据的 unauthorized
     */
    protected function unauthorizedWithData(string $message, $data = null): JsonResponse
    {
        return $this->error($message, 401, $data);
    }

    /**
     * 创建成功响应 (201)
     */
    protected function created($data = null, string $message = 'Resource created successfully'): JsonResponse
    {
        return $this->success($data, $message, 201);
    }

    /**
     * 无内容响应 (204)
     */
    protected function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    /**
     * 冲突错误响应 (409)
     */
    protected function conflict(string $message = 'Resource conflict', $data = null): JsonResponse
    {
        return $this->error($message, 409, $data);
    }

    /**
     * 分页响应
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

        // 普通数组
        return $this->success($items, $message);
    }

    // ==================== 快捷错误方法 (基于错误码) ====================

    /**
     * 分组未找到
     */
    protected function groupNotFound($data = null): JsonResponse
    {
        return $this->errorWithCode(AppQyV1ErrorCodes::GROUP_NOT_FOUND, null, null, $data);
    }

    /**
     * 词库未找到
     */
    protected function libraryNotFound($data = null): JsonResponse
    {
        return $this->errorWithCode(AppQyV1ErrorCodes::LIBRARY_NOT_FOUND, null, null, $data);
    }

    /**
     * 单词未找到
     */
    protected function wordNotFound($data = null): JsonResponse
    {
        return $this->errorWithCode(AppQyV1ErrorCodes::WORD_NOT_FOUND, null, null, $data);
    }

    /**
     * 语言不匹配
     */
    protected function languageMismatch(string $libraryLang, string $groupLang, $data = null): JsonResponse
    {
        $message = "Library language ({$libraryLang}) does not match group language ({$groupLang})";
        $additionalData = array_merge([
            'library_language' => $libraryLang,
            'group_language' => $groupLang,
        ], $data ?? []);

        return $this->errorWithCode(AppQyV1ErrorCodes::LANGUAGE_MISMATCH, $message, null, $additionalData);
    }

    /**
     * 词库已添加
     */
    protected function libraryAlreadyAdded($data = null): JsonResponse
    {
        return $this->errorWithCode(AppQyV1ErrorCodes::LIBRARY_ALREADY_ADDED, null, null, $data);
    }

    /**
     * 词库未关联
     */
    protected function libraryNotLinked($data = null): JsonResponse
    {
        return $this->errorWithCode(AppQyV1ErrorCodes::LIBRARY_NOT_LINKED, null, null, $data);
    }
}
