// THIS FILE IS AUTO-GENERATED FROM FLUTTER CODEMART_ENUMS.DART
// DO NOT EDIT MANUALLY - Changes will be overwritten
// Last updated: 2025-11-03

export enum UserRoleType {
  DEVELOPER = 'developer',
  CLIENT = 'client',
  ARCHITECT = 'architect',
  REVIEWER = 'reviewer',
  ADMIN = 'admin',
}

// Developer sub-types
export enum DeveloperType {
  REGULAR = 'regular',      // Regular developer
  ARCHITECT = 'architect',  // Architect
}

// Client sub-types
export enum ClientType {
  INDIVIDUAL = 'individual',  // Individual
  ENTERPRISE = 'enterprise',  // Enterprise
}

export enum UserRoleStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum VerificationStatus {
  NOT_STARTED = 'notStarted',
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
  ID_CARD = 'idCard',
  PASSPORT = 'passport',
  DRIVING_LICENSE = 'drivingLicense',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  IN_PROGRESS = 'inProgress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

export enum ProjectBudgetRange {
  UNDER_5K = 'under5k',
  RANGE_5K_10K = 'range5k10k',
  RANGE_10K_50K = 'range10k50k',
  RANGE_50K_100K = 'range50k100k',
  OVER_100K = 'over100k',
}

export enum ProjectComplexity {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'veryComplex',
}

export enum MilestoneStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'inProgress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'inProgress',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'underReview',
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

export enum PaymentMethod {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
  BANK_TRANSFER = 'bankTransfer',
  CREDIT_CARD = 'creditCard',
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
  PROJECT_PAYMENT = 'projectPayment',
  MILESTONE_PAYMENT = 'milestonePayment',
  REFUND = 'refund',
  WITHDRAWAL = 'withdrawal',
  BONUS = 'bonus',
}

// Developer levels (based on points and completed projects)
export enum DeveloperLevel {
  LEVEL_1 = 'level1',  // Newbie (0-100 points)
  LEVEL_2 = 'level2',  // Junior (101-500 points)
  LEVEL_3 = 'level3',  // Intermediate (501-1500 points)
  LEVEL_4 = 'level4',  // Senior (1501-3000 points)
  LEVEL_5 = 'level5',  // Expert (3001-5000 points)
  LEVEL_6 = 'level6',  // Master (5001+ points)
}

// Client levels (based on projects posted and payment amount)
export enum ClientLevel {
  LEVEL_1 = 'level1',  // New (0-5 projects)
  LEVEL_2 = 'level2',  // Bronze (6-15 projects)
  LEVEL_3 = 'level3',  // Silver (16-30 projects)
  LEVEL_4 = 'level4',  // Gold (31-50 projects)
  LEVEL_5 = 'level5',  // Platinum (51-100 projects)
  LEVEL_6 = 'level6',  // Diamond (100+ projects)
}

// Attachment types
export enum AttachmentType {
  PROJECT_DOCUMENT = 'projectDocument',
  TASK_DOCUMENT = 'taskDocument',
  PROPOSAL_DOCUMENT = 'proposalDocument',
  SUBMISSION_DOCUMENT = 'submissionDocument',
  VERIFICATION_DOCUMENT = 'verificationDocument',
  OTHER = 'other',
}

// File types
export enum FileType {
  PDF = 'pdf',
  DOC = 'doc',
  DOCX = 'docx',
  XLS = 'xls',
  XLSX = 'xlsx',
  PPT = 'ppt',
  PPTX = 'pptx',
  TXT = 'txt',
  ZIP = 'zip',
  RAR = 'rar',
  IMAGE = 'image',
}

// Certification types
export enum CertificationType {
  EDUCATION = 'education',        // Educational certificate
  PROFESSIONAL = 'professional',  // Professional certification
  SKILL = 'skill',                // Skill certification
  PROJECT = 'project',            // Project completion certificate
  AWARD = 'award',                // Award or recognition
}

// Budget types
export enum BudgetType {
  FIXED = 'fixed',       // Fixed price
  HOURLY = 'hourly',     // Hourly rate
  MILESTONE = 'milestone', // Milestone-based
}

export enum NotificationType {
  PROJECT_INVITATION = 'projectInvitation',
  TASK_ASSIGNED = 'taskAssigned',
  PAYMENT_RECEIVED = 'paymentReceived',
  SUBMISSION_APPROVED = 'submissionApproved',
  SUBMISSION_REJECTED = 'submissionRejected',
  MESSAGE = 'message',
  SYSTEM = 'system',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

// Constants
export const CodeMartConstants = {
  defaultDepositAmounts: {
    [UserRoleType.DEVELOPER]: 199.00,
    [UserRoleType.CLIENT]: 0.00,
    [UserRoleType.ARCHITECT]: 999.00,
  },

  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 100,

  maxFileSizeMb: 10,
  imageMaxSizeMb: 5,
  supportedImages: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  supportedDocuments: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],

  otpLength: 6,
  otpExpiryMinutes: 10,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,

  emailTokenLength: 64,
  emailExpiryHours: 24,

  minBudget: 100,
  maxBudget: 1000000,
  minDurationDays: 1,
  maxDurationDays: 365,

  ratingMin: 1,
  ratingMax: 5,
  ratingPrecision: 2,

  // Level point ranges
  developerLevelRanges: {
    level1: [0, 100],
    level2: [101, 500],
    level3: [501, 1500],
    level4: [1501, 3000],
    level5: [3001, 5000],
    level6: [5001, Infinity],
  },

  clientLevelRanges: {
    level1: [0, 5],
    level2: [6, 15],
    level3: [16, 30],
    level4: [31, 50],
    level5: [51, 100],
    level6: [101, Infinity],
  },
} as const;

// Helper functions for level calculation
export function calculateDeveloperLevel(points: number): DeveloperLevel {
  if (points <= 100) return DeveloperLevel.LEVEL_1;
  if (points <= 500) return DeveloperLevel.LEVEL_2;
  if (points <= 1500) return DeveloperLevel.LEVEL_3;
  if (points <= 3000) return DeveloperLevel.LEVEL_4;
  if (points <= 5000) return DeveloperLevel.LEVEL_5;
  return DeveloperLevel.LEVEL_6;
}

export function calculateClientLevel(projectCount: number): ClientLevel {
  if (projectCount <= 5) return ClientLevel.LEVEL_1;
  if (projectCount <= 15) return ClientLevel.LEVEL_2;
  if (projectCount <= 30) return ClientLevel.LEVEL_3;
  if (projectCount <= 50) return ClientLevel.LEVEL_4;
  if (projectCount <= 100) return ClientLevel.LEVEL_5;
  return ClientLevel.LEVEL_6;
}

export function getDeveloperLevelName(level: DeveloperLevel): string {
  const names: Record<DeveloperLevel, string> = {
    [DeveloperLevel.LEVEL_1]: 'Newbie',
    [DeveloperLevel.LEVEL_2]: 'Junior',
    [DeveloperLevel.LEVEL_3]: 'Intermediate',
    [DeveloperLevel.LEVEL_4]: 'Senior',
    [DeveloperLevel.LEVEL_5]: 'Expert',
    [DeveloperLevel.LEVEL_6]: 'Master',
  };
  return names[level];
}

export function getClientLevelName(level: ClientLevel): string {
  const names: Record<ClientLevel, string> = {
    [ClientLevel.LEVEL_1]: 'New',
    [ClientLevel.LEVEL_2]: 'Bronze',
    [ClientLevel.LEVEL_3]: 'Silver',
    [ClientLevel.LEVEL_4]: 'Gold',
    [ClientLevel.LEVEL_5]: 'Platinum',
    [ClientLevel.LEVEL_6]: 'Diamond',
  };
  return names[level];
}
