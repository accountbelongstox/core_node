import { STORAGE_KEYS, API_BASE_URL } from '../base-constants';

export const CODEMART_API_ENDPOINTS = {
  PROJECTS: `${API_BASE_URL}/api/codemart/projects`,
  TEMPLATES: `${API_BASE_URL}/api/codemart/templates`,
  REVIEWS: `${API_BASE_URL}/api/codemart/reviews`,
  PAYMENTS: `${API_BASE_URL}/api/codemart/payments`,
  CREDITS: `${API_BASE_URL}/api/codemart/credits`,
} as const;

export const CODEMART_STORAGE_KEYS = {
  ...STORAGE_KEYS,
  USER_ROLE: 'codemart_user_role',
  SELECTED_PROJECT: 'codemart_selected_project',
  CART_ITEMS: 'codemart_cart_items',
  CREDIT_BALANCE: 'codemart_credit_balance',
} as const;

export const CODEMART_USER_ROLES = {
  CLIENT: 'client',
  DEVELOPER: 'developer',
  ARCHITECT: 'architect',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
} as const;

export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const CREDIT_CATEGORIES = {
  TEMPLATE: 'template',
  CUSTOM_DEVELOPMENT: 'custom_development',
  CODE_REVIEW: 'code_review',
  CONSULTATION: 'consultation',
} as const;

export type CodemartUserRole = typeof CODEMART_USER_ROLES[keyof typeof CODEMART_USER_ROLES];
export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
export type CreditCategory = typeof CREDIT_CATEGORIES[keyof typeof CREDIT_CATEGORIES];
