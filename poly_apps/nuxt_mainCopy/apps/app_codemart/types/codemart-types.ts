/**
 * CodeMart Centralized Type Definitions
 * Shared across all APIs and services
 */

import * as Enums from './codemart-enums';

// ============ USER & PROFILE TYPES ============
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  name: string;
  nickname?: string;
  avatar?: string;
  about?: string;
  website?: string;
  github?: string;
  wechat?: string;
  roles: UserRoleType[];
  emailVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleType {
  id: number;
  userId: number;
  roleType: Enums.UserRoleType;
  roleStatus: Enums.UserRoleStatus;
  depositAmount: number;
  roleActivatedAt?: string;
}

export interface DeveloperProfile {
  id: number;
  userId: number;
  companyName?: string;
  bio?: string;
  skills: string[];
  certifications: Certification[];
  completedProjects: number;
  averageRating: number;
  followersCount: number;
  profileCompletedAt?: string;
}

export interface ClientProfile {
  id: number;
  userId: number;
  companyName: string;
  companyRegistrationNumber?: string;
  industry?: Enums.Industry;
  companyDescription?: string;
  contactPerson?: string;
  contactPhone?: string;
  companyWebsite?: string;
  postedProjects: number;
  averageRating: number;
  profileCompletedAt?: string;
}

export interface Certification {
  id: number;
  name: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  status: Enums.CertificationStatus;
  credentialUrl?: string;
  credentialId?: string;
}

// ============ PROJECT TYPES ============
export interface Project {
  id: number;
  clientId: number;
  title: string;
  description: string;
  status: Enums.ProjectStatus;
  complexity: Enums.ProjectComplexity;
  budget: number;
  budgetType: 'fixed' | 'hourly';
  currency: string;
  startDate: string;
  endDate: string;
  skills: string[];
  languages: Enums.ProgrammingLanguage[];
  frameworks: Enums.Framework[];
  databases: Enums.Database[];
  attachments: Attachment[];
  referenceUrls: string[];
  totalMilestones: number;
  completedMilestones: number;
  currentMilestone?: Milestone;
  aiProposal?: ProjectProposal;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProposal {
  id: number;
  projectId: number;
  status: Enums.ProjectStatus;
  recommendedTechStack: {
    languages: Enums.ProgrammingLanguage[];
    frameworks: Enums.Framework[];
    databases: Enums.Database[];
  };
  suggestedTeamComposition: {
    seniorDevelopers: number;
    midLevelDevelopers: number;
    juniorDevelopers: number;
  };
  estimatedDuration: number; // days
  estimatedCost: number;
  costBreakdown: CostBreakdownItem[];
  aiNotes: string;
  generatedAt: string;
}

export interface CostBreakdownItem {
  description: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
}

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: Enums.MilestoneStatus;
  order: number;
  dueDate: string;
  budget: number;
  deliverables: string[];
  tasks: Task[];
  completedAt?: string;
  createdAt: string;
}

// ============ TASK TYPES ============
export interface Task {
  id: number;
  projectId: number;
  milestoneId?: number;
  title: string;
  description: string;
  status: Enums.TaskStatus;
  priority: Enums.TaskPriority;
  assignedTo?: number; // Developer ID
  createdBy: number;
  estimatedHours: number;
  actualHours?: number;
  dueDate: string;
  budget: number;
  skills: string[];
  attachments: Attachment[];
  comments: TaskComment[];
  submittedCode?: TaskSubmission;
  reviews: CodeReview[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskSubmission {
  id: number;
  taskId: number;
  developerId: number;
  repositoryUrl: string;
  description: string;
  submittedAt: string;
  status: 'pending_review' | 'approved' | 'rejected';
  rejectionReason?: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number;
  type: Enums.TaskCommentType;
  content: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CodeReview {
  id: number;
  taskId: number;
  submissionId: number;
  reviewerId: number;
  status: Enums.ReviewStatus;
  codeQualityScore: Enums.CodeQualityScore;
  comments: string;
  suggestions: string[];
  attachments?: Attachment[];
  submittedAt?: string;
  createdAt: string;
}

// ============ PAYMENT & WALLET TYPES ============
export interface Payment {
  id: number;
  userId: number;
  projectId?: number;
  taskId?: number;
  paymentType: Enums.PaymentType;
  amount: number;
  currency: string;
  method: Enums.PaymentMethod;
  status: Enums.PaymentStatus;
  transactionId?: string;
  paymentGatewayResponse?: object;
  paidAt?: string;
  createdAt: string;
}

export interface Wallet {
  id: number;
  userId: number;
  balance: number;
  currency: string;
  totalEarnings: number;
  totalSpent: number;
  totalDeposited: number;
  totalWithdrawn: number;
  transactions: WalletTransaction[];
  updatedAt: string;
}

export interface WalletTransaction {
  id: number;
  walletId: number;
  type: Enums.WalletTransactionType;
  amount: number;
  description: string;
  relatedEntityId?: number;
  status: Enums.TransactionStatus;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface Escrow {
  id: number;
  projectId: number;
  milestoneId: number;
  amount: number;
  status: 'held' | 'released' | 'refunded';
  holdStartDate: string;
  releaseDate?: string;
  releasedAt?: string;
}

// ============ NOTIFICATION TYPES ============
export interface Notification {
  id: number;
  userId: number;
  type: Enums.NotificationType;
  title: string;
  content: string;
  status: Enums.NotificationStatus;
  relatedEntityType?: string;
  relatedEntityId?: number;
  metadata?: object;
  createdAt: string;
  readAt?: string;
}

// ============ FILE ATTACHMENT TYPES ============
export interface Attachment {
  id: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedBy: number;
  uploadedAt: string;
}

// ============ PAGINATION & API TYPES ============
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ListFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

// ============ STATISTICS TYPES ============
export interface UserStatistics {
  userId: number;
  totalProjectsCompleted: number;
  totalTasksCompleted: number;
  totalEarnings: number;
  averageRating: number;
  totalReviews: number;
  responseTime: number; // hours
  completionRate: number; // percentage
  lastActiveAt: string;
}

export interface ProjectStatistics {
  projectId: number;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  milestonesCompleted: number;
  tasksCompleted: number;
  averageTaskCompletionTime: number; // hours
  teamSize: number;
  averageTeamRating: number;
}
