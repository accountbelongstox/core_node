<?php

namespace App\Apps\CodeMartV1\CodeMartV1Gvar;

class CodeMartV1Constants
{
    // User Roles
    public const ROLE_DEVELOPER = 'developer';
    public const ROLE_CLIENT = 'client';
    public const ROLE_ARCHITECT = 'architect';
    public const ROLE_REVIEWER = 'reviewer';

    // Role Status
    public const ROLE_STATUS_PENDING = 'pending';
    public const ROLE_STATUS_ACTIVE = 'active';
    public const ROLE_STATUS_SUSPENDED = 'suspended';
    public const ROLE_STATUS_REJECTED = 'rejected';

    // Deposit Amounts (CNY)
    public const DEPOSIT_DEVELOPER = 5000;
    public const DEPOSIT_ARCHITECT_ADDITIONAL = 5000;
    public const DEPOSIT_CLIENT = 0;

    // Architect Promotion Requirements
    public const ARCHITECT_MIN_PROJECTS = 10;
    public const ARCHITECT_MIN_CODE_SCORE = 85;
    public const ARCHITECT_MIN_SATISFACTION = 4.5;

    // Reviewer Test Requirements
    public const REVIEWER_TEST_SNIPPETS = 3;
    public const REVIEWER_MIN_SIMILARITY = 85;
    public const REVIEWER_RETRY_DAYS = 7;

    // Project Status
    public const PROJECT_STATUS_DRAFT = 'draft';
    public const PROJECT_STATUS_OPEN = 'open';
    public const PROJECT_STATUS_IN_PROGRESS = 'in_progress';
    public const PROJECT_STATUS_PAUSED = 'paused';
    public const PROJECT_STATUS_COMPLETED = 'completed';
    public const PROJECT_STATUS_CANCELLED = 'cancelled';
    public const PROJECT_STATUS_ARCHIVED = 'archived';

    // Project Complexity
    public const COMPLEXITY_SIMPLE = 'simple';
    public const COMPLEXITY_MEDIUM = 'medium';
    public const COMPLEXITY_COMPLEX = 'complex';
    public const COMPLEXITY_VERY_COMPLEX = 'very_complex';

    // Budget Types
    public const BUDGET_TYPE_FIXED = 'fixed';
    public const BUDGET_TYPE_HOURLY = 'hourly';

    // Task Status
    public const TASK_STATUS_PENDING = 'pending';
    public const TASK_STATUS_IN_PROGRESS = 'in_progress';
    public const TASK_STATUS_REVIEW = 'review';
    public const TASK_STATUS_COMPLETED = 'completed';
    public const TASK_STATUS_BLOCKED = 'blocked';

    // Task Priority
    public const TASK_PRIORITY_LOW = 'low';
    public const TASK_PRIORITY_MEDIUM = 'medium';
    public const TASK_PRIORITY_HIGH = 'high';
    public const TASK_PRIORITY_URGENT = 'urgent';

    // Submission Status
    public const SUBMISSION_STATUS_PENDING = 'pending';
    public const SUBMISSION_STATUS_APPROVED = 'approved';
    public const SUBMISSION_STATUS_NEEDS_REVISION = 'needs_revision';
    public const SUBMISSION_STATUS_REJECTED = 'rejected';

    // Payment Status
    public const PAYMENT_STATUS_PENDING = 'pending';
    public const PAYMENT_STATUS_COMPLETED = 'completed';
    public const PAYMENT_STATUS_FAILED = 'failed';
    public const PAYMENT_STATUS_CANCELLED = 'cancelled';
    public const PAYMENT_STATUS_DISPUTED = 'disputed';

    // Payment Types
    public const PAYMENT_TYPE_MILESTONE = 'milestone';
    public const PAYMENT_TYPE_HOURLY = 'hourly';
    public const PAYMENT_TYPE_REFUND = 'refund';
    public const PAYMENT_TYPE_BONUS = 'bonus';

    // Payment Methods
    public const PAYMENT_METHOD_WALLET = 'wallet';
    public const PAYMENT_METHOD_CREDIT_CARD = 'credit_card';
    public const PAYMENT_METHOD_BANK_TRANSFER = 'bank_transfer';
    public const PAYMENT_METHOD_ALIPAY = 'alipay';
    public const PAYMENT_METHOD_WECHAT = 'wechat';

    // KYC Status
    public const KYC_STATUS_NOT_STARTED = 'not_started';
    public const KYC_STATUS_PENDING = 'pending';
    public const KYC_STATUS_APPROVED = 'approved';
    public const KYC_STATUS_REJECTED = 'rejected';

    // Identity Types
    public const IDENTITY_TYPE_ID_CARD = 'ID_CARD';
    public const IDENTITY_TYPE_PASSPORT = 'PASSPORT';
    public const IDENTITY_TYPE_DRIVING_LICENSE = 'DRIVING_LICENSE';

    // AI Analysis Status
    public const AI_ANALYSIS_PENDING = 'pending';
    public const AI_ANALYSIS_PROCESSING = 'processing';
    public const AI_ANALYSIS_COMPLETED = 'completed';
    public const AI_ANALYSIS_FAILED = 'failed';

    // Milestone Status
    public const MILESTONE_STATUS_PENDING = 'pending';
    public const MILESTONE_STATUS_IN_PROGRESS = 'in_progress';
    public const MILESTONE_STATUS_COMPLETED = 'completed';
    public const MILESTONE_STATUS_FAILED = 'failed';
    public const MILESTONE_STATUS_CANCELLED = 'cancelled';

    // Invoice Status
    public const INVOICE_STATUS_DRAFT = 'draft';
    public const INVOICE_STATUS_SENT = 'sent';
    public const INVOICE_STATUS_PAID = 'paid';
    public const INVOICE_STATUS_CANCELLED = 'cancelled';

    // Refund Status
    public const REFUND_STATUS_PENDING = 'pending';
    public const REFUND_STATUS_APPROVED = 'approved';
    public const REFUND_STATUS_COMPLETED = 'completed';
    public const REFUND_STATUS_REJECTED = 'rejected';

    // File Upload Limits
    public const MAX_ATTACHMENT_SIZE = 10240; // 10MB in KB
    public const MAX_KYC_IMAGE_SIZE = 5120; // 5MB in KB
    public const ALLOWED_DOCUMENT_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'];
    public const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png'];

    // Pagination
    public const DEFAULT_PAGE_SIZE = 20;
    public const MAX_PAGE_SIZE = 100;

    // Currency
    public const DEFAULT_CURRENCY = 'CNY';
    public const SUPPORTED_CURRENCIES = ['CNY', 'USD', 'EUR'];

    // Platform Commission Rate
    public const PLATFORM_COMMISSION_RATE = 0.15; // 15%

    // Review Rating Range
    public const MIN_RATING = 1;
    public const MAX_RATING = 5;

    // Code Review Dimensions
    public const REVIEW_DIMENSION_QUALITY = 'quality';
    public const REVIEW_DIMENSION_READABILITY = 'readability';
    public const REVIEW_DIMENSION_EFFICIENCY = 'efficiency';
    public const REVIEW_DIMENSION_SECURITY = 'security';

    public static function getAllRoles(): array
    {
        return [
            self::ROLE_DEVELOPER,
            self::ROLE_CLIENT,
            self::ROLE_ARCHITECT,
            self::ROLE_REVIEWER,
        ];
    }

    public static function getAllProjectStatuses(): array
    {
        return [
            self::PROJECT_STATUS_DRAFT,
            self::PROJECT_STATUS_OPEN,
            self::PROJECT_STATUS_IN_PROGRESS,
            self::PROJECT_STATUS_PAUSED,
            self::PROJECT_STATUS_COMPLETED,
            self::PROJECT_STATUS_CANCELLED,
            self::PROJECT_STATUS_ARCHIVED,
        ];
    }

    public static function getAllTaskStatuses(): array
    {
        return [
            self::TASK_STATUS_PENDING,
            self::TASK_STATUS_IN_PROGRESS,
            self::TASK_STATUS_REVIEW,
            self::TASK_STATUS_COMPLETED,
            self::TASK_STATUS_BLOCKED,
        ];
    }

    public static function getAllPaymentMethods(): array
    {
        return [
            self::PAYMENT_METHOD_WALLET,
            self::PAYMENT_METHOD_CREDIT_CARD,
            self::PAYMENT_METHOD_BANK_TRANSFER,
            self::PAYMENT_METHOD_ALIPAY,
            self::PAYMENT_METHOD_WECHAT,
        ];
    }

    public static function getDepositAmount(string $role): int
    {
        return match ($role) {
            self::ROLE_DEVELOPER => self::DEPOSIT_DEVELOPER,
            self::ROLE_ARCHITECT => self::DEPOSIT_DEVELOPER + self::DEPOSIT_ARCHITECT_ADDITIONAL,
            self::ROLE_CLIENT => self::DEPOSIT_CLIENT,
            default => 0,
        };
    }
}
