/**
 * CodeMart Centralized Enums and Constants
 * Single source of truth for all data types and enumerations
 * Used across all APIs to prevent data duplication
 */

// ============ USER ROLES ============
export enum UserRoleType {
  DEVELOPER = 'developer',
  CLIENT = 'client',
  ARCHITECT = 'architect',
  REVIEWER = 'reviewer',
  ADMIN = 'admin',
}

export enum UserRoleStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

// ============ VERIFICATION STATUS ============
export enum VerificationStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum EmailVerificationStatus {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
  EXPIRED = 'expired',
}

export enum PhoneVerificationStatus {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
}

export enum IdentityType {
  ID_CARD = 'ID_CARD',
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
}

// ============ PROJECT MANAGEMENT ============
export enum ProjectStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

export enum ProjectBudgetRange {
  UNDER_5K = 'under_5k',
  RANGE_5K_10K = '5k_10k',
  RANGE_10K_50K = '10k_50k',
  RANGE_50K_100K = '50k_100k',
  OVER_100K = 'over_100k',
}

export enum ProjectComplexity {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'very_complex',
}

export enum MilestoneStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ============ TASK MANAGEMENT ============
export enum TaskStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskCommentType {
  GENERAL = 'general',
  CODE_REVIEW = 'code_review',
  QUESTION = 'question',
  SUGGESTION = 'suggestion',
}

// ============ PAYMENT & WALLET ============
export enum PaymentMethod {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  WALLET = 'wallet',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentType {
  DEPOSIT = 'deposit',
  PROJECT_PAYMENT = 'project_payment',
  MILESTONE_PAYMENT = 'milestone_payment',
  REFUND = 'refund',
  WITHDRAWAL = 'withdrawal',
  BONUS = 'bonus',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum WalletTransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  PROJECT_EARNING = 'project_earning',
  BONUS = 'bonus',
  PENALTY = 'penalty',
  REFUND = 'refund',
}

// ============ CODE REVIEW & RATING ============
export enum CodeQualityScore {
  POOR = 1,
  FAIR = 2,
  GOOD = 3,
  VERY_GOOD = 4,
  EXCELLENT = 5,
}

export enum ReviewStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
}

// ============ SKILL & CERTIFICATION ============
export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export enum CertificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  EXPIRED = 'expired',
  REJECTED = 'rejected',
}

// ============ NOTIFICATION ============
export enum NotificationType {
  PROJECT_INVITATION = 'project_invitation',
  TASK_ASSIGNED = 'task_assigned',
  PAYMENT_RECEIVED = 'payment_received',
  SUBMISSION_APPROVED = 'submission_approved',
  SUBMISSION_REJECTED = 'submission_rejected',
  MESSAGE = 'message',
  SYSTEM = 'system',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

// ============ DEVELOPER LEVEL & PROMOTION ============
export enum DeveloperLevel {
  JUNIOR = 'junior',
  INTERMEDIATE = 'intermediate',
  SENIOR = 'senior',
  EXPERT = 'expert',
  ARCHITECT = 'architect',
}

// ============ INDUSTRY & TECH STACK ============
export enum Industry {
  SAAS = 'saas',
  ECOMMERCE = 'ecommerce',
  FINTECH = 'fintech',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  ENTERPRISE = 'enterprise',
  MOBILE = 'mobile',
  IOT = 'iot',
  AI_ML = 'ai_ml',
  OTHER = 'other',
}

export enum ProgrammingLanguage {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  JAVA = 'java',
  PHP = 'php',
  CSHARP = 'csharp',
  GOLANG = 'golang',
  RUST = 'rust',
  RUBY = 'ruby',
  CPP = 'cpp',
  KOTLIN = 'kotlin',
  SWIFT = 'swift',
}

export enum Framework {
  // Frontend
  REACT = 'react',
  VUE = 'vue',
  ANGULAR = 'angular',
  SVELTE = 'svelte',

  // Backend
  LARAVEL = 'laravel',
  DJANGO = 'django',
  EXPRESS = 'express',
  SPRING = 'spring',
  DOTNET = 'dotnet',
  GIN = 'gin',
  FASTAPI = 'fastapi',

  // Full Stack
  NEXTJS = 'nextjs',
  NUXT = 'nuxt',
  REMIX = 'remix',
}

export enum Database {
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
  MONGODB = 'mongodb',
  REDIS = 'redis',
  ELASTICSEARCH = 'elasticsearch',
  DYNAMODB = 'dynamodb',
  FIRESTORE = 'firestore',
  CASSANDRA = 'cassandra',
  MARIADB = 'mariadb',
}

// ============ CONSTANTS ============
export const DEFAULT_DEPOSIT_AMOUNTS = {
  [UserRoleType.DEVELOPER]: 199.00,
  [UserRoleType.CLIENT]: 0.00,
  [UserRoleType.ARCHITECT]: 999.00,
};

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

export const FILE_UPLOAD_LIMITS = {
  MAX_SIZE_MB: 10,
  IMAGE_MAX_SIZE_MB: 5,
  SUPPORTED_IMAGES: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  SUPPORTED_DOCUMENTS: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
};

export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_SECONDS: 60,
};

export const EMAIL_CONFIG = {
  TOKEN_LENGTH: 64,
  EXPIRY_HOURS: 24,
};

export const PROJECT_DEFAULTS = {
  MIN_BUDGET: 100,
  MAX_BUDGET: 1000000,
  MIN_DURATION_DAYS: 1,
  MAX_DURATION_DAYS: 365,
};

export const RATING_SCALE = {
  MIN: 1,
  MAX: 5,
  PRECISION: 2,
};
