<?php

namespace App\Constants;

/**
 * Unified application-neutral error code registry.
 * Merges the former AuthErrorCodes and AppQyV1ErrorCodes registries.
 * Provides stable string codes with localizable messages.
 */
final class ErrorCodes
{
    // ==================== Auth API Errors (login/register) ====================
    public const AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND';
    public const AUTH_INVALID_PASSWORD = 'AUTH_INVALID_PASSWORD';
    public const AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS';
    public const AUTH_VALIDATION_FAILED = 'AUTH_VALIDATION_FAILED';

    // ==================== Resource Not Found (404) ====================
    public const GROUP_NOT_FOUND = 'GROUP_NOT_FOUND';
    public const LIBRARY_NOT_FOUND = 'LIBRARY_NOT_FOUND';
    public const WORD_NOT_FOUND = 'WORD_NOT_FOUND';
    public const USER_NOT_FOUND = 'USER_NOT_FOUND';
    public const DICTIONARY_NOT_FOUND = 'DICTIONARY_NOT_FOUND';
    public const RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND';

    // ==================== Authentication Errors (401) ====================
    public const AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED';
    public const INVALID_TOKEN = 'INVALID_TOKEN';
    public const TOKEN_EXPIRED = 'TOKEN_EXPIRED';
    public const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';

    // ==================== Authorization Errors (403) ====================
    public const FORBIDDEN = 'FORBIDDEN';
    public const ADMIN_REQUIRED = 'ADMIN_REQUIRED';
    public const PERMISSION_DENIED = 'PERMISSION_DENIED';

    // ==================== Validation Errors (400) ====================
    public const VALIDATION_FAILED = 'VALIDATION_FAILED';
    public const INVALID_PARAMETER = 'INVALID_PARAMETER';
    public const MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD';

    // ==================== Business Logic Errors (400) ====================
    public const LANGUAGE_MISMATCH = 'LANGUAGE_MISMATCH';
    public const DUPLICATE_ENTRY = 'DUPLICATE_ENTRY';
    public const INVALID_OPERATION = 'INVALID_OPERATION';
    public const LIBRARY_ALREADY_ADDED = 'LIBRARY_ALREADY_ADDED';
    public const WORD_ALREADY_EXISTS = 'WORD_ALREADY_EXISTS';
    public const GROUP_ALREADY_EXISTS = 'GROUP_ALREADY_EXISTS';
    public const LIBRARY_NOT_LINKED = 'LIBRARY_NOT_LINKED';
    public const INVALID_LANGUAGE = 'INVALID_LANGUAGE';

    // ==================== Server Errors (500) ====================
    public const INTERNAL_ERROR = 'INTERNAL_ERROR';
    public const DATABASE_ERROR = 'DATABASE_ERROR';
    public const SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE';

    // ==================== Error Message Mapping (English) ====================
    private const MESSAGES = [
        // Auth API
        self::AUTH_USER_NOT_FOUND => 'Account does not exist. Please check your username or email.',
        self::AUTH_INVALID_PASSWORD => 'Incorrect password. Please try again.',
        self::AUTH_INVALID_CREDENTIALS => 'Invalid credentials. Please check and try again.',
        self::AUTH_VALIDATION_FAILED => 'Invalid request. Username and password are required.',

        // 404
        self::GROUP_NOT_FOUND => 'Group not found',
        self::LIBRARY_NOT_FOUND => 'Library not found',
        self::WORD_NOT_FOUND => 'Word not found',
        self::USER_NOT_FOUND => 'User not found',
        self::DICTIONARY_NOT_FOUND => 'Dictionary not found',
        self::RESOURCE_NOT_FOUND => 'Resource not found',

        // 401
        self::AUTHENTICATION_REQUIRED => 'Authentication required',
        self::INVALID_TOKEN => 'Invalid token',
        self::TOKEN_EXPIRED => 'Token expired',
        self::INVALID_CREDENTIALS => 'Invalid credentials',

        // 403
        self::FORBIDDEN => 'Access forbidden',
        self::ADMIN_REQUIRED => 'Admin access required',
        self::PERMISSION_DENIED => 'Permission denied',

        // 400 - Validation
        self::VALIDATION_FAILED => 'Validation failed',
        self::INVALID_PARAMETER => 'Invalid parameter',
        self::MISSING_REQUIRED_FIELD => 'Missing required field',

        // 400 - Business Logic
        self::LANGUAGE_MISMATCH => 'Language mismatch',
        self::DUPLICATE_ENTRY => 'Duplicate entry',
        self::INVALID_OPERATION => 'Invalid operation',
        self::LIBRARY_ALREADY_ADDED => 'Library already added to this group',
        self::WORD_ALREADY_EXISTS => 'Word already exists',
        self::GROUP_ALREADY_EXISTS => 'Group already exists',
        self::LIBRARY_NOT_LINKED => 'Library not linked to this group',
        self::INVALID_LANGUAGE => 'Invalid language',

        // 500
        self::INTERNAL_ERROR => 'Internal server error',
        self::DATABASE_ERROR => 'Database error',
        self::SERVICE_UNAVAILABLE => 'Service unavailable',
    ];

    // ==================== Error Message Mapping (Chinese) ====================
    private const MESSAGES_ZH = [
        // 404
        self::GROUP_NOT_FOUND => '分组未找到',
        self::LIBRARY_NOT_FOUND => '词库未找到',
        self::WORD_NOT_FOUND => '单词未找到',
        self::USER_NOT_FOUND => '用户未找到',
        self::DICTIONARY_NOT_FOUND => '字典未找到',
        self::RESOURCE_NOT_FOUND => '资源未找到',

        // 401
        self::AUTHENTICATION_REQUIRED => '需要身份验证',
        self::INVALID_TOKEN => '无效的令牌',
        self::TOKEN_EXPIRED => '令牌已过期',
        self::INVALID_CREDENTIALS => '凭证无效',

        // 403
        self::FORBIDDEN => '禁止访问',
        self::ADMIN_REQUIRED => '需要管理员权限',
        self::PERMISSION_DENIED => '权限不足',

        // 400 - Validation
        self::VALIDATION_FAILED => '验证失败',
        self::INVALID_PARAMETER => '参数无效',
        self::MISSING_REQUIRED_FIELD => '缺少必填字段',

        // 400 - Business Logic
        self::LANGUAGE_MISMATCH => '语言不匹配',
        self::DUPLICATE_ENTRY => '重复条目',
        self::INVALID_OPERATION => '无效操作',
        self::LIBRARY_ALREADY_ADDED => '词库已添加到此分组',
        self::WORD_ALREADY_EXISTS => '单词已存在',
        self::GROUP_ALREADY_EXISTS => '分组已存在',
        self::LIBRARY_NOT_LINKED => '词库未关联到此分组',
        self::INVALID_LANGUAGE => '无效的语言',

        // 500
        self::INTERNAL_ERROR => '服务器内部错误',
        self::DATABASE_ERROR => '数据库错误',
        self::SERVICE_UNAVAILABLE => '服务不可用',
    ];

    /**
     * Get error message
     *
     * @param string $code Error code
     * @param string $locale Language ('en', 'zh')
     * @return string Error message
     */
    public static function getMessage(string $code, string $locale = 'en'): string
    {
        $messages = match ($locale) {
            'zh', 'zh-CN', 'zh_CN' => self::MESSAGES_ZH,
            default => self::MESSAGES,
        };

        // Fall back to the English message when a code has no localized entry
        return $messages[$code] ?? self::MESSAGES[$code] ?? 'Unknown error';
    }

    /**
     * Get HTTP status code for error code
     *
     * @param string $errorCode Error code constant
     * @return int HTTP status code
     */
    public static function getHttpCode(string $errorCode): int
    {
        return match ($errorCode) {
            // 404
            self::GROUP_NOT_FOUND,
            self::LIBRARY_NOT_FOUND,
            self::WORD_NOT_FOUND,
            self::USER_NOT_FOUND,
            self::DICTIONARY_NOT_FOUND,
            self::RESOURCE_NOT_FOUND => 404,

            // 401
            self::AUTHENTICATION_REQUIRED,
            self::INVALID_TOKEN,
            self::TOKEN_EXPIRED,
            self::INVALID_CREDENTIALS => 401,

            // 403
            self::FORBIDDEN,
            self::ADMIN_REQUIRED,
            self::PERMISSION_DENIED => 403,

            // 422
            self::VALIDATION_FAILED,
            self::AUTH_VALIDATION_FAILED => 422,

            // 500
            self::INTERNAL_ERROR,
            self::DATABASE_ERROR,
            self::SERVICE_UNAVAILABLE => 500,

            // 400 (default for business logic errors)
            default => 400,
        };
    }

    /**
     * Check if error code exists
     */
    public static function exists(string $code): bool
    {
        return isset(self::MESSAGES[$code]);
    }

    /**
     * Get all available error codes
     */
    public static function getAllCodes(): array
    {
        return array_keys(self::MESSAGES);
    }
}
