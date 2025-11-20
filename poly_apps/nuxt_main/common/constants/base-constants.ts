export const API_VERSION = 'v1';

export const API_BASE_URL = process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export const APP_NAMESPACES = {
  EXAMPLE: 'example',
  CODEMART: 'codemart',
  DEV: 'dev',
  ADMIN: 'admin',
  DASHBOARD: 'dashboard',
} as const;

export const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
  USER_PROFILE: 'user_profile',
  THEME_PREFERENCE: 'theme_preference',
  LANGUAGE: 'language',
  MENU_STATE: 'menu_state',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const DATE_FORMATS = {
  DEFAULT: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  TIME: 'HH:mm:ss',
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_DATETIME: 'MMM DD, YYYY HH:mm',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
} as const;

export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 3000,
  LONG: 5000,
} as const;

export type AppNamespace = typeof APP_NAMESPACES[keyof typeof APP_NAMESPACES];
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
