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
    public const PROJECT_STATUS_PROPOSAL_REVIEW = 'proposal_review';
    public const PROJECT_STATUS_FUNDING_PENDING = 'funding_pending';
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
    public const TASK_STATUS_OPEN = 'open';
    public const TASK_STATUS_ASSIGNED = 'assigned';
    public const TASK_STATUS_IN_PROGRESS = 'in_progress';
    public const TASK_STATUS_REVIEW = 'review';
    public const TASK_STATUS_COMPLETED = 'completed';
    public const TASK_STATUS_BLOCKED = 'blocked';
    public const TASK_STATUS_CANCELLED = 'cancelled';

    // Task Priority
    public const TASK_PRIORITY_LOW = 'low';
    public const TASK_PRIORITY_MEDIUM = 'medium';
    public const TASK_PRIORITY_HIGH = 'high';
    public const TASK_PRIORITY_URGENT = 'urgent';

    // Submission Status
    public const SUBMISSION_STATUS_PENDING = 'pending';
    public const SUBMISSION_STATUS_PENDING_REVIEW = 'pending_review';
    public const SUBMISSION_STATUS_APPROVED = 'approved';
    public const SUBMISSION_STATUS_NEEDS_REVISION = 'needs_revision';
    public const SUBMISSION_STATUS_REJECTED = 'rejected';

    // Payment Status
    public const PAYMENT_STATUS_PENDING = 'pending';
    public const PAYMENT_STATUS_PROCESSING = 'processing';
    public const PAYMENT_STATUS_COMPLETED = 'completed';
    public const PAYMENT_STATUS_FAILED = 'failed';
    public const PAYMENT_STATUS_CANCELLED = 'cancelled';
    public const PAYMENT_STATUS_DISPUTED = 'disputed';
    public const PAYMENT_STATUS_REFUNDED = 'refunded';

    // Escrow Status
    public const ESCROW_STATUS_HELD = 'held';
    public const ESCROW_STATUS_RELEASED = 'released';
    public const ESCROW_STATUS_REFUNDED = 'refunded';

    // Notification Types
    public const NOTIFICATION_TYPE_ANALYSIS = 'analysis';
    public const NOTIFICATION_TYPE_TASK = 'task';
    public const NOTIFICATION_TYPE_REVIEW = 'review';
    public const NOTIFICATION_TYPE_FINANCE = 'finance';
    public const NOTIFICATION_TYPE_ONBOARDING = 'onboarding';
    public const NOTIFICATION_TYPE_ADMIN = 'admin';

    // Capability keys returned by GET /bootstrap; the UI derives visibility
    // from these instead of inferring role names locally.
    public const CAPABILITY_TASK_BROWSE = 'task.browse';
    public const CAPABILITY_TASK_READ = 'task.read';
    public const CAPABILITY_PROJECT_READ = 'project.read';
    public const CAPABILITY_PROJECT_CREATE = 'project.create';
    public const CAPABILITY_REVIEW_READ = 'review.read';
    public const CAPABILITY_ARCHITECT_READ = 'architect.read';
    public const CAPABILITY_FINANCE_READ = 'finance.read';
    public const CAPABILITY_ONBOARDING_READ = 'onboarding.read';
    public const CAPABILITY_PROFILE_READ = 'profile.read';
    public const CAPABILITY_NOTIFICATION_READ = 'notification.read';
    public const CAPABILITY_ADMIN_ACCESS = 'admin.access';

    // Versioned contract exposed through GET /bootstrap; an incompatible
    // major version blocks mutations with a precise upgrade message.
    public const CONTRACT_VERSION = '1.0.0';
    public const MIN_SUPPORTED_UI_VERSION = '1.0.0';

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

    // Deposit Status
    public const DEPOSIT_STATUS_PENDING = 'pending';
    public const DEPOSIT_STATUS_PAID = 'paid';
    public const DEPOSIT_STATUS_FAILED = 'failed';
    public const DEPOSIT_STATUS_REFUNDED = 'refunded';
    public const DEPOSIT_STATUS_REJECTED = 'rejected';
    public const DEPOSIT_PAYMENT_METHODS = ['alipay', 'wechat', 'bank_transfer'];
    public const DEPOSIT_MIN_AMOUNT = 100;

    // Withdrawal Status
    public const WITHDRAWAL_STATUS_PENDING = 'pending';
    public const WITHDRAWAL_STATUS_APPROVED = 'approved';
    public const WITHDRAWAL_STATUS_REJECTED = 'rejected';
    public const WITHDRAWAL_STATUS_PAID = 'paid';
    public const WITHDRAWAL_METHODS = ['bank_transfer', 'alipay', 'wechat'];
    public const WITHDRAWAL_MIN_AMOUNT = 1;

    // Escrow Types
    public const ESCROW_TYPE_PROJECT_FUNDING = 'project_funding';
    public const ESCROW_STATUS_DISPUTED = 'disputed';

    // Proposal Status (accepted proposal funds the project)
    public const PROPOSAL_STATUS_APPROVED = 'approved';

    // Wallet ledger entry types (immutable rows; corrections are compensating entries)
    public const WALLET_TX_DEPOSIT = 'deposit';
    public const WALLET_TX_WITHDRAWAL = 'withdrawal';
    public const WALLET_TX_PAYMENT = 'payment';
    public const WALLET_TX_REFUND = 'refund';
    public const WALLET_TX_EARNING = 'earning';
    public const WALLET_TX_ESCROW_HOLD = 'escrow_hold';
    public const WALLET_TX_ESCROW_RELEASE = 'escrow_release';
    public const WALLET_TX_STATUS_SUCCESS = 'success';
    public const WALLET_TX_STATUS_PENDING = 'pending';
    public const WALLET_TX_STATUS_CANCELLED = 'cancelled';

    // Business reference prefixes stored on payments.business_ref
    public const BUSINESS_REF_TASK_RELEASE = 'task_release:';

    // Idempotency
    public const IDEMPOTENCY_HEADER = 'Idempotency-Key';
    public const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

    // Dispute resolutions
    public const DISPUTE_RESOLUTION_REFUND = 'refund';
    public const DISPUTE_RESOLUTION_COMPLETE = 'complete';

    // Bank transfer reference prefix shown with deposit bank instructions
    public const DEPOSIT_BANK_REFERENCE_PREFIX = 'CMDEP-';

    // Review Rating Range
    public const MIN_RATING = 1;
    public const MAX_RATING = 5;

    // Code Review Dimensions
    public const REVIEW_DIMENSION_QUALITY = 'quality';
    public const REVIEW_DIMENSION_READABILITY = 'readability';
    public const REVIEW_DIMENSION_EFFICIENCY = 'efficiency';
    public const REVIEW_DIMENSION_SECURITY = 'security';

    // Administration: allowed role status transitions (from => [to]).
    public const ROLE_STATUS_TRANSITIONS = [
        self::ROLE_STATUS_PENDING => [self::ROLE_STATUS_ACTIVE, self::ROLE_STATUS_REJECTED],
        self::ROLE_STATUS_ACTIVE => [self::ROLE_STATUS_SUSPENDED],
        self::ROLE_STATUS_SUSPENDED => [self::ROLE_STATUS_ACTIVE],
        self::ROLE_STATUS_REJECTED => [self::ROLE_STATUS_PENDING],
    ];
    public const ROLE_STATUS_REASON_REQUIRED = [self::ROLE_STATUS_SUSPENDED, self::ROLE_STATUS_REJECTED];

    // Administration: project intervention target states.
    public const ADMIN_PROJECT_TARGET_STATUSES = [
        self::PROJECT_STATUS_PAUSED,
        self::PROJECT_STATUS_OPEN,
        self::PROJECT_STATUS_IN_PROGRESS,
        self::PROJECT_STATUS_CANCELLED,
        self::PROJECT_STATUS_ARCHIVED,
    ];

    // Public statistics: project states that are never counted.
    public const PUBLIC_EXCLUDED_PROJECT_STATUSES = [
        self::PROJECT_STATUS_DRAFT,
        self::PROJECT_STATUS_CANCELLED,
    ];

    // KYC private document storage (never the public disk).
    public const KYC_PRIVATE_DISK = 'local';
    public const KYC_LEGACY_PUBLIC_DISK = 'public';
    public const KYC_FILE_COLUMNS = [
        'front' => 'id_front_image_path',
        'back' => 'id_back_image_path',
        'selfie' => 'selfie_image_path',
    ];

    // Reviewer application status
    public const REVIEWER_APPLICATION_IN_PROGRESS = 'in_progress';
    public const REVIEWER_APPLICATION_PASSED = 'passed';
    public const REVIEWER_APPLICATION_FAILED = 'failed';
    public const REVIEWER_APPLICATION_REVOKED = 'revoked';

    // Testimonial moderation status
    public const TESTIMONIAL_STATUS_PENDING = 'pending';
    public const TESTIMONIAL_STATUS_APPROVED = 'approved';
    public const TESTIMONIAL_STATUS_HIDDEN = 'hidden';
    public const TESTIMONIAL_MAX_QUOTE_LENGTH = 1000;

    // Contact message status
    public const CONTACT_STATUS_NEW = 'new';
    public const CONTACT_STATUS_HANDLED = 'handled';

    // Localized public content
    public const DEFAULT_LOCALE = 'en';
    public const SUPPORTED_LOCALES = ['en', 'zh'];

    // Rate limits (Laravel throttle middleware "attempts,minutes")
    public const THROTTLE_PUBLIC = 'throttle:30,1';
    public const THROTTLE_REGISTER = 'throttle:10,1';
    public const THROTTLE_CONTACT = 'throttle:5,1';

    // Additional capability keys
    public const CAPABILITY_ROLE_REQUEST = 'role.request';
    public const CAPABILITY_TESTIMONIAL_CREATE = 'testimonial.create';
    public const CAPABILITY_FINANCE_WITHDRAW = 'finance.withdraw';

    // Activity resource types (administration and public surface)
    public const RESOURCE_USER = 'user';
    public const RESOURCE_USER_ROLE = 'user_role';
    public const RESOURCE_KYC = 'kyc';
    public const RESOURCE_TESTIMONIAL = 'testimonial';
    public const RESOURCE_REVIEWER_APPLICATION = 'reviewer_application';
    public const RESOURCE_CONTACT_MESSAGE = 'contact_message';

    // Machine error codes (the UI localizes these)
    public const ERROR_INVALID_REGISTRATION_CODE = 'invalid_registration_code';
    public const ERROR_KYC_NOT_PENDING = 'kyc_not_pending';
    public const ERROR_KYC_FILE_NOT_FOUND = 'kyc_file_not_found';
    public const ERROR_REASON_REQUIRED = 'reason_required';
    public const ERROR_INVALID_ROLE_TYPE = 'invalid_role_type';
    public const ERROR_INVALID_ROLE_TRANSITION = 'invalid_role_transition';
    public const ERROR_ROLE_NOT_FOUND = 'role_not_found';
    public const ERROR_ROLE_ALREADY_EXISTS = 'role_already_exists';
    public const ERROR_USER_NOT_FOUND = 'user_not_found';
    public const ERROR_PROJECT_NOT_FOUND = 'project_not_found';
    public const ERROR_INVALID_PROJECT_TRANSITION = 'invalid_project_transition';
    public const ERROR_TESTIMONIAL_NOT_ELIGIBLE = 'testimonial_not_eligible';
    public const ERROR_TESTIMONIAL_NOT_FOUND = 'testimonial_not_found';
    public const ERROR_TESTIMONIAL_ALREADY_SUBMITTED = 'testimonial_already_submitted';
    public const ERROR_ROLE_REQUEST_NOT_ALLOWED = 'role_request_not_allowed';
    public const ERROR_REVIEWER_APPLICATION_NOT_FOUND = 'reviewer_application_not_found';
    public const ERROR_CONTACT_MESSAGE_NOT_FOUND = 'contact_message_not_found';
    public const ERROR_KYC_NOT_FOUND = 'kyc_not_found';
    public const ERROR_VALIDATION_FAILED = 'validation_failed';

    public static function getAllDepositStatuses(): array
    {
        return [
            self::DEPOSIT_STATUS_PENDING,
            self::DEPOSIT_STATUS_PAID,
            self::DEPOSIT_STATUS_FAILED,
            self::DEPOSIT_STATUS_REFUNDED,
            self::DEPOSIT_STATUS_REJECTED,
        ];
    }

    public static function getAllWithdrawalStatuses(): array
    {
        return [
            self::WITHDRAWAL_STATUS_PENDING,
            self::WITHDRAWAL_STATUS_APPROVED,
            self::WITHDRAWAL_STATUS_REJECTED,
            self::WITHDRAWAL_STATUS_PAID,
        ];
    }

    /**
     * Bank-transfer deposit instructions. Values come from configuration
     * (config/services.php codemart_bank_transfer); labels are localized by the UI.
     */
    public static function depositBankTransferInfo(): array
    {
        $bank = (array) config('services.codemart_bank_transfer', []);

        return [
            'bank_name' => $bank['bank_name'] ?? null,
            'account_name' => $bank['account_name'] ?? null,
            'account_number' => $bank['account_number'] ?? null,
            'branch' => $bank['branch'] ?? null,
            'swift_code' => $bank['swift_code'] ?? null,
            'currency' => self::DEFAULT_CURRENCY,
        ];
    }

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
            self::PROJECT_STATUS_PROPOSAL_REVIEW,
            self::PROJECT_STATUS_FUNDING_PENDING,
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
            self::TASK_STATUS_OPEN,
            self::TASK_STATUS_ASSIGNED,
            self::TASK_STATUS_IN_PROGRESS,
            self::TASK_STATUS_REVIEW,
            self::TASK_STATUS_COMPLETED,
            self::TASK_STATUS_BLOCKED,
            self::TASK_STATUS_CANCELLED,
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

    // Delivery flow: AI analysis extra states and project-side analysis_status.
    public const AI_ANALYSIS_REVISING = 'revising';
    public const PROJECT_ANALYSIS_ANALYZING = 'analyzing';
    public const PROJECT_ANALYSIS_REVISING = 'revising';
    public const PROJECT_ANALYSIS_COMPLETED = 'completed';
    public const PROJECT_ANALYSIS_ACCEPTED = 'accepted';
    public const PROJECT_ANALYSIS_FAILED = 'failed';
    public const ANALYSIS_ACTIVE_STATUSES = [self::AI_ANALYSIS_PROCESSING, self::AI_ANALYSIS_REVISING];
    public const ANALYSIS_KEYWORD_SNIPPET_BYTES = 4096;
    public const ANALYSIS_KEYWORD_TEXT_MIME_PREFIX = 'text/';
    public const PROPOSAL_STATUS_PENDING = 'pending';
    public const PROPOSAL_STATUS_REVISED = 'revised';

    // Delivery flow: transition actors.
    public const TRANSITION_ACTOR_OWNER = 'owner';
    public const TRANSITION_ACTOR_MANAGER = 'manager';
    public const TRANSITION_ACTOR_ASSIGNEE = 'assignee';
    public const TRANSITION_ACTOR_ADMIN = 'admin';
    public const TRANSITION_ACTOR_SYSTEM = 'system';

    // Project state machine: from => [to => [actors]]. owner = project client.
    public const PROJECT_TRANSITIONS = [
        self::PROJECT_STATUS_DRAFT => [
            self::PROJECT_STATUS_PROPOSAL_REVIEW => [self::TRANSITION_ACTOR_SYSTEM],
            self::PROJECT_STATUS_CANCELLED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
        ],
        self::PROJECT_STATUS_PROPOSAL_REVIEW => [
            self::PROJECT_STATUS_FUNDING_PENDING => [self::TRANSITION_ACTOR_SYSTEM],
            self::PROJECT_STATUS_DRAFT => [self::TRANSITION_ACTOR_SYSTEM],
            self::PROJECT_STATUS_CANCELLED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
        ],
        self::PROJECT_STATUS_FUNDING_PENDING => [
            self::PROJECT_STATUS_OPEN => [self::TRANSITION_ACTOR_SYSTEM],
            self::PROJECT_STATUS_CANCELLED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
        ],
        self::PROJECT_STATUS_OPEN => [
            self::PROJECT_STATUS_IN_PROGRESS => [self::TRANSITION_ACTOR_SYSTEM],
            self::PROJECT_STATUS_PAUSED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
            self::PROJECT_STATUS_CANCELLED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
        ],
        self::PROJECT_STATUS_IN_PROGRESS => [
            self::PROJECT_STATUS_PAUSED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
            self::PROJECT_STATUS_COMPLETED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
            self::PROJECT_STATUS_CANCELLED => [self::TRANSITION_ACTOR_ADMIN],
        ],
        self::PROJECT_STATUS_PAUSED => [
            self::PROJECT_STATUS_IN_PROGRESS => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
            self::PROJECT_STATUS_OPEN => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
            self::PROJECT_STATUS_CANCELLED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
        ],
        self::PROJECT_STATUS_COMPLETED => [
            self::PROJECT_STATUS_ARCHIVED => [self::TRANSITION_ACTOR_OWNER, self::TRANSITION_ACTOR_ADMIN],
        ],
        self::PROJECT_STATUS_CANCELLED => [
            self::PROJECT_STATUS_ARCHIVED => [self::TRANSITION_ACTOR_ADMIN],
        ],
    ];

    // Project states in which tasks are marketplace-visible and acceptable.
    public const PROJECT_MARKETPLACE_STATUSES = [self::PROJECT_STATUS_OPEN, self::PROJECT_STATUS_IN_PROGRESS];
    // Project states in which scope fields (budget, complexity, stack) are editable.
    public const PROJECT_SCOPE_EDITABLE_STATUSES = [self::PROJECT_STATUS_DRAFT, self::PROJECT_STATUS_PROPOSAL_REVIEW];
    // Project states in which no further edits are accepted.
    public const PROJECT_CLOSED_STATUSES = [
        self::PROJECT_STATUS_COMPLETED,
        self::PROJECT_STATUS_CANCELLED,
        self::PROJECT_STATUS_ARCHIVED,
    ];

    // Task state machine: from => [to => [actors]]. manager = project client or architect.
    public const TASK_TRANSITIONS = [
        self::TASK_STATUS_PENDING => [
            self::TASK_STATUS_OPEN => [self::TRANSITION_ACTOR_SYSTEM],
            self::TASK_STATUS_CANCELLED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_SYSTEM],
        ],
        self::TASK_STATUS_OPEN => [
            self::TASK_STATUS_ASSIGNED => [self::TRANSITION_ACTOR_SYSTEM],
            self::TASK_STATUS_CANCELLED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_SYSTEM],
        ],
        self::TASK_STATUS_ASSIGNED => [
            self::TASK_STATUS_IN_PROGRESS => [self::TRANSITION_ACTOR_ASSIGNEE],
            self::TASK_STATUS_BLOCKED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_ASSIGNEE],
            self::TASK_STATUS_CANCELLED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_SYSTEM],
        ],
        self::TASK_STATUS_IN_PROGRESS => [
            self::TASK_STATUS_REVIEW => [self::TRANSITION_ACTOR_SYSTEM],
            self::TASK_STATUS_BLOCKED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_ASSIGNEE],
            self::TASK_STATUS_CANCELLED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_SYSTEM],
        ],
        self::TASK_STATUS_REVIEW => [
            self::TASK_STATUS_COMPLETED => [self::TRANSITION_ACTOR_SYSTEM],
            self::TASK_STATUS_IN_PROGRESS => [self::TRANSITION_ACTOR_SYSTEM],
            self::TASK_STATUS_OPEN => [self::TRANSITION_ACTOR_SYSTEM],
            self::TASK_STATUS_BLOCKED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_ASSIGNEE],
            self::TASK_STATUS_CANCELLED => [self::TRANSITION_ACTOR_SYSTEM],
        ],
        self::TASK_STATUS_BLOCKED => [
            self::TASK_STATUS_IN_PROGRESS => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_ASSIGNEE],
            self::TASK_STATUS_CANCELLED => [self::TRANSITION_ACTOR_MANAGER, self::TRANSITION_ACTOR_SYSTEM],
        ],
    ];

    public const TASK_TERMINAL_STATUSES = [self::TASK_STATUS_COMPLETED, self::TASK_STATUS_CANCELLED];
    public const TASK_EDITABLE_STATUSES = [
        self::TASK_STATUS_PENDING,
        self::TASK_STATUS_OPEN,
        self::TASK_STATUS_ASSIGNED,
        self::TASK_STATUS_IN_PROGRESS,
        self::TASK_STATUS_BLOCKED,
    ];
    public const SUBMISSION_REVIEWABLE_STATUSES = [
        self::SUBMISSION_STATUS_PENDING,
        self::SUBMISSION_STATUS_PENDING_REVIEW,
    ];
    public const MILESTONE_CLOSED_STATUSES = [
        self::MILESTONE_STATUS_COMPLETED,
        self::MILESTONE_STATUS_FAILED,
        self::MILESTONE_STATUS_CANCELLED,
    ];

    // Code review records: client decision vs. advisory reviewer review.
    public const REVIEW_KIND_CLIENT = 'client';
    public const REVIEW_KIND_REVIEWER = 'reviewer';
    public const REVIEW_RECOMMENDATIONS = [
        self::SUBMISSION_STATUS_APPROVED,
        self::SUBMISSION_STATUS_NEEDS_REVISION,
        self::SUBMISSION_STATUS_REJECTED,
    ];
    // Advisory recommendation derived from the mean dimension score when none is given.
    public const REVIEW_RECOMMEND_APPROVE_MIN = 4.0;
    public const REVIEW_RECOMMEND_REVISION_MIN = 2.5;
    // Code score scale (architect promotion compares against ARCHITECT_MIN_CODE_SCORE).
    public const CODE_SCORE_SCALE = 100;
    public const REVIEWER_COMMENT_MIN_LENGTH = 20;

    // Delivery private storage (never the public disk).
    public const DELIVERY_PRIVATE_DISK = 'local';
    public const PROJECT_ATTACHMENT_DIR = 'codemart/projects';
    public const SUBMISSION_FILE_DIR = 'codemart/submissions';
    public const SUBMISSION_FILE_STORAGE_PRIVATE = 'private';
    public const SUBMISSION_FILE_STORAGE_LINK = 'link';

    // Domain event resource types and actions.
    public const RESOURCE_PROJECT = 'project';
    public const RESOURCE_MILESTONE = 'milestone';
    public const RESOURCE_TASK = 'task';
    public const RESOURCE_SUBMISSION = 'submission';
    public const RESOURCE_ANALYSIS = 'analysis';
    public const RESOURCE_COMMENT = 'comment';
    public const RESOURCE_ATTACHMENT = 'attachment';

    // Notification i18n keys (UI resolves notifications.*).
    public const NOTIFY_TASK_ACCEPTED = 'notifications.taskAccepted';
    public const NOTIFY_TASK_ACCEPTED_BODY = 'notifications.taskAcceptedBody';
    public const NOTIFY_TASK_STATUS_CHANGED = 'notifications.taskStatusChanged';
    public const NOTIFY_TASK_STATUS_CHANGED_BODY = 'notifications.taskStatusChangedBody';
    public const NOTIFY_SUBMISSION_CREATED = 'notifications.submissionCreated';
    public const NOTIFY_SUBMISSION_CREATED_BODY = 'notifications.submissionCreatedBody';
    public const NOTIFY_SUBMISSION_REVIEWED = 'notifications.submissionReviewed';
    public const NOTIFY_SUBMISSION_REVIEWED_BODY = 'notifications.submissionReviewedBody';
    public const NOTIFY_REVIEWER_REVIEW_RECORDED = 'notifications.reviewerReviewRecorded';
    public const NOTIFY_REVIEWER_REVIEW_RECORDED_BODY = 'notifications.reviewerReviewRecordedBody';
    public const NOTIFY_ANALYSIS_COMPLETED = 'notifications.analysisCompleted';
    public const NOTIFY_ANALYSIS_COMPLETED_BODY = 'notifications.analysisCompletedBody';
    public const NOTIFY_ANALYSIS_FAILED = 'notifications.analysisFailed';
    public const NOTIFY_ANALYSIS_FAILED_BODY = 'notifications.analysisFailedBody';
    public const NOTIFY_PROJECT_STATUS_CHANGED = 'notifications.projectStatusChanged';
    public const NOTIFY_PROJECT_STATUS_CHANGED_BODY = 'notifications.projectStatusChangedBody';
    public const NOTIFY_COMMENT_ADDED = 'notifications.commentAdded';
    public const NOTIFY_COMMENT_ADDED_BODY = 'notifications.commentAddedBody';
    public const NOTIFY_MILESTONE_COMPLETED = 'notifications.milestoneCompleted';
    public const NOTIFY_MILESTONE_COMPLETED_BODY = 'notifications.milestoneCompletedBody';

    // Delivery flow machine error codes (the UI localizes these).
    public const ERROR_ACCESS_DENIED = 'access_denied';
    public const ERROR_TASK_NOT_FOUND = 'task_not_found';
    public const ERROR_MILESTONE_NOT_FOUND = 'milestone_not_found';
    public const ERROR_SUBMISSION_NOT_FOUND = 'submission_not_found';
    public const ERROR_ANALYSIS_NOT_FOUND = 'analysis_not_found';
    public const ERROR_ATTACHMENT_NOT_FOUND = 'attachment_not_found';
    public const ERROR_FILE_NOT_FOUND = 'file_not_found';
    public const ERROR_FILE_STORE_FAILED = 'file_store_failed';
    public const ERROR_INVALID_TASK_TRANSITION = 'invalid_task_transition';
    public const ERROR_STATE_CONFLICT = 'state_conflict';
    public const ERROR_PROJECT_INVALID_STATE = 'project_invalid_state';
    public const ERROR_PROJECT_TASKS_UNFINISHED = 'project_tasks_unfinished';
    public const ERROR_PROJECT_FUNDING_REQUIRED = 'project_funding_required';
    public const ERROR_PROJECT_SCOPE_LOCKED = 'project_scope_locked';
    public const ERROR_MILESTONE_CLOSED = 'milestone_closed';
    public const ERROR_MILESTONE_TASKS_UNFINISHED = 'milestone_tasks_unfinished';
    public const ERROR_TASK_INVALID_STATE = 'task_invalid_state';
    public const ERROR_SUBMISSION_INVALID_STATE = 'submission_invalid_state';
    public const ERROR_REVIEW_DUPLICATE = 'review_duplicate';
    public const ERROR_REVIEW_CONFLICT_OF_INTEREST = 'review_conflict_of_interest';
    public const ERROR_REVIEWER_ROLE_REQUIRED = 'reviewer_role_required';
    public const ERROR_DEVELOPER_ROLE_REQUIRED = 'developer_role_required';
    public const ERROR_DEVELOPER_DEPOSIT_REQUIRED = 'developer_deposit_required';
    public const ERROR_TASK_UNAVAILABLE = 'task_unavailable';
    public const ERROR_TASK_OWN_PROJECT = 'task_own_project';
    public const ERROR_ANALYSIS_IN_PROGRESS = 'analysis_in_progress';
    public const ERROR_ANALYSIS_NOT_COMPLETED = 'analysis_not_completed';
    public const ERROR_ANALYSIS_NOT_LATEST = 'analysis_not_latest';

    /** Actors allowed to move a project from $from to $to (empty when not allowed). */
    public static function projectTransitionActors(string $from, string $to): array
    {
        return self::PROJECT_TRANSITIONS[$from][$to] ?? [];
    }

    /** Actors allowed to move a task from $from to $to (empty when not allowed). */
    public static function taskTransitionActors(string $from, string $to): array
    {
        return self::TASK_TRANSITIONS[$from][$to] ?? [];
    }

    /**
     * Server-owned state/policy vocabulary exposed through GET /bootstrap.
     * UI source never duplicates these defaults.
     */
    public static function contractVocabulary(): array
    {
        return [
            'contract_version' => self::CONTRACT_VERSION,
            'min_supported_ui_version' => self::MIN_SUPPORTED_UI_VERSION,
            'states' => [
                'role' => [
                    self::ROLE_STATUS_PENDING,
                    self::ROLE_STATUS_ACTIVE,
                    self::ROLE_STATUS_SUSPENDED,
                    self::ROLE_STATUS_REJECTED,
                ],
                'project' => self::getAllProjectStatuses(),
                'task' => self::getAllTaskStatuses(),
                'submission' => [
                    self::SUBMISSION_STATUS_PENDING_REVIEW,
                    self::SUBMISSION_STATUS_APPROVED,
                    self::SUBMISSION_STATUS_NEEDS_REVISION,
                    self::SUBMISSION_STATUS_REJECTED,
                ],
                'payment' => [
                    self::PAYMENT_STATUS_PENDING,
                    self::PAYMENT_STATUS_PROCESSING,
                    self::PAYMENT_STATUS_COMPLETED,
                    self::PAYMENT_STATUS_FAILED,
                    self::PAYMENT_STATUS_CANCELLED,
                    self::PAYMENT_STATUS_DISPUTED,
                    self::PAYMENT_STATUS_REFUNDED,
                ],
                'analysis' => [
                    self::AI_ANALYSIS_PENDING,
                    self::AI_ANALYSIS_PROCESSING,
                    self::AI_ANALYSIS_REVISING,
                    self::AI_ANALYSIS_COMPLETED,
                    self::AI_ANALYSIS_FAILED,
                ],
                'kyc' => [
                    self::KYC_STATUS_NOT_STARTED,
                    self::KYC_STATUS_PENDING,
                    self::KYC_STATUS_APPROVED,
                    self::KYC_STATUS_REJECTED,
                ],
                'milestone' => [
                    self::MILESTONE_STATUS_PENDING,
                    self::MILESTONE_STATUS_IN_PROGRESS,
                    self::MILESTONE_STATUS_COMPLETED,
                    self::MILESTONE_STATUS_FAILED,
                    self::MILESTONE_STATUS_CANCELLED,
                ],
                'escrow' => [
                    self::ESCROW_STATUS_HELD,
                    self::ESCROW_STATUS_RELEASED,
                    self::ESCROW_STATUS_REFUNDED,
                    self::ESCROW_STATUS_DISPUTED,
                ],
                'deposit' => self::getAllDepositStatuses(),
                'withdrawal' => self::getAllWithdrawalStatuses(),
                'refund' => [
                    self::REFUND_STATUS_PENDING,
                    self::REFUND_STATUS_APPROVED,
                    self::REFUND_STATUS_COMPLETED,
                    self::REFUND_STATUS_REJECTED,
                ],
            ],
            'roles' => self::getAllRoles(),
            'transitions' => [
                'project' => self::PROJECT_TRANSITIONS,
                'task' => self::TASK_TRANSITIONS,
            ],
            'policy' => [
                'currency' => self::DEFAULT_CURRENCY,
                'supported_currencies' => self::SUPPORTED_CURRENCIES,
                'deposit_amounts' => [
                    self::ROLE_CLIENT => self::DEPOSIT_CLIENT,
                    self::ROLE_DEVELOPER => self::DEPOSIT_DEVELOPER,
                    self::ROLE_ARCHITECT => self::DEPOSIT_DEVELOPER + self::DEPOSIT_ARCHITECT_ADDITIONAL,
                ],
                'platform_commission_rate' => self::PLATFORM_COMMISSION_RATE,
                'default_page_size' => self::DEFAULT_PAGE_SIZE,
                'max_page_size' => self::MAX_PAGE_SIZE,
                'max_attachment_size_kb' => self::MAX_ATTACHMENT_SIZE,
                'max_kyc_image_size_kb' => self::MAX_KYC_IMAGE_SIZE,
                'allowed_document_types' => self::ALLOWED_DOCUMENT_TYPES,
                'allowed_image_types' => self::ALLOWED_IMAGE_TYPES,
                'review_dimensions' => [
                    self::REVIEW_DIMENSION_QUALITY,
                    self::REVIEW_DIMENSION_READABILITY,
                    self::REVIEW_DIMENSION_EFFICIENCY,
                    self::REVIEW_DIMENSION_SECURITY,
                ],
                'rating_range' => [self::MIN_RATING, self::MAX_RATING],
                'payment_methods' => self::getAllPaymentMethods(),
            ],
        ];
    }
}
