<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants;

/**
 * Unified DingDuoDuoV1 error codes. Mirrors App\Constants\ErrorCodes: stable string
 * codes, English + Chinese messages, and an HTTP status mapping.
 */
class DingDuoDuoV1ErrorCodes
{
    // ==================== Resource Not Found (404) ====================
    public const MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND';
    public const SUPER_CODE_NOT_FOUND = 'SUPER_CODE_NOT_FOUND';
    public const PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND';
    public const ORDER_NOT_FOUND = 'ORDER_NOT_FOUND';
    public const BINDING_NOT_FOUND = 'BINDING_NOT_FOUND';
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
    public const MEMBERSHIP_EXPIRED = 'MEMBERSHIP_EXPIRED';

    // ==================== Validation Errors (400/422) ====================
    public const VALIDATION_FAILED = 'VALIDATION_FAILED';
    public const INVALID_PARAMETER = 'INVALID_PARAMETER';
    public const MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD';

    // ==================== Business Logic Errors (400) ====================
    public const DUPLICATE_ENTRY = 'DUPLICATE_ENTRY';
    public const INVALID_OPERATION = 'INVALID_OPERATION';
    public const BIND_LIMIT_REACHED = 'BIND_LIMIT_REACHED';
    public const ORDER_ALREADY_PAID = 'ORDER_ALREADY_PAID';

    // ==================== Server Errors (500) ====================
    public const INTERNAL_ERROR = 'INTERNAL_ERROR';
    public const DATABASE_ERROR = 'DATABASE_ERROR';
    public const SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE';

    // ==================== Error Message Mapping (English) ====================
    private const MESSAGES = [
        // 404
        self::MEMBER_NOT_FOUND => 'Member not found',
        self::SUPER_CODE_NOT_FOUND => 'Super code not found',
        self::PACKAGE_NOT_FOUND => 'Package not found',
        self::ORDER_NOT_FOUND => 'Order not found',
        self::BINDING_NOT_FOUND => 'Binding not found',
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
        self::MEMBERSHIP_EXPIRED => 'Membership expired',

        // 400 - Validation
        self::VALIDATION_FAILED => 'Validation failed',
        self::INVALID_PARAMETER => 'Invalid parameter',
        self::MISSING_REQUIRED_FIELD => 'Missing required field',

        // 400 - Business Logic
        self::DUPLICATE_ENTRY => 'Duplicate entry',
        self::INVALID_OPERATION => 'Invalid operation',
        self::BIND_LIMIT_REACHED => 'Bind limit reached',
        self::ORDER_ALREADY_PAID => 'Order already paid',

        // 500
        self::INTERNAL_ERROR => 'Internal server error',
        self::DATABASE_ERROR => 'Database error',
        self::SERVICE_UNAVAILABLE => 'Service unavailable',
    ];

    // ==================== Error Message Mapping (Chinese) ====================
    private const MESSAGES_ZH = [
        // 404
        self::MEMBER_NOT_FOUND => '会员未找到',
        self::SUPER_CODE_NOT_FOUND => '超级码未找到',
        self::PACKAGE_NOT_FOUND => '套餐未找到',
        self::ORDER_NOT_FOUND => '订单未找到',
        self::BINDING_NOT_FOUND => '绑定未找到',
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
        self::MEMBERSHIP_EXPIRED => '会员已过期',

        // 400 - Validation
        self::VALIDATION_FAILED => '验证失败',
        self::INVALID_PARAMETER => '参数无效',
        self::MISSING_REQUIRED_FIELD => '缺少必填字段',

        // 400 - Business Logic
        self::DUPLICATE_ENTRY => '重复条目',
        self::INVALID_OPERATION => '无效操作',
        self::BIND_LIMIT_REACHED => '绑定数量已达上限',
        self::ORDER_ALREADY_PAID => '订单已支付',

        // 500
        self::INTERNAL_ERROR => '服务器内部错误',
        self::DATABASE_ERROR => '数据库错误',
        self::SERVICE_UNAVAILABLE => '服务不可用',
    ];

    /**
     * Get error message in the requested locale.
     */
    public static function getMessage(string $code, string $locale = 'en'): string
    {
        $messages = match ($locale) {
            'zh', 'zh-CN', 'zh_CN' => self::MESSAGES_ZH,
            default => self::MESSAGES,
        };

        return $messages[$code] ?? 'Unknown error';
    }

    /**
     * Get the HTTP status code for an error code.
     */
    public static function getHttpCode(string $errorCode): int
    {
        return match ($errorCode) {
            // 404
            self::MEMBER_NOT_FOUND,
            self::SUPER_CODE_NOT_FOUND,
            self::PACKAGE_NOT_FOUND,
            self::ORDER_NOT_FOUND,
            self::BINDING_NOT_FOUND,
            self::RESOURCE_NOT_FOUND => 404,

            // 401
            self::AUTHENTICATION_REQUIRED,
            self::INVALID_TOKEN,
            self::TOKEN_EXPIRED,
            self::INVALID_CREDENTIALS => 401,

            // 403
            self::FORBIDDEN,
            self::ADMIN_REQUIRED,
            self::PERMISSION_DENIED,
            self::MEMBERSHIP_EXPIRED => 403,

            // 422
            self::VALIDATION_FAILED => 422,

            // 500
            self::INTERNAL_ERROR,
            self::DATABASE_ERROR,
            self::SERVICE_UNAVAILABLE => 500,

            // 400 (default for business logic errors)
            default => 400,
        };
    }

    /**
     * Check whether an error code exists.
     */
    public static function exists(string $code): bool
    {
        return isset(self::MESSAGES[$code]);
    }

    /**
     * Get all available error codes.
     */
    public static function getAllCodes(): array
    {
        return array_keys(self::MESSAGES);
    }
}
