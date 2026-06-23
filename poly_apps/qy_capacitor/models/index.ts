/**
 * Model Center - Unified Data Models Export
 * Central hub for all data models and business logic
 */

// Runtime exports
export { UserModel } from './UserModel';
export { AuthModel } from './AuthModel';

// Type-only exports (erased at runtime, avoid ESM export errors)
export type { UserStats, UserProfile } from './UserModel';
export type { LoginResult, RegisterResult } from './AuthModel';

// Re-export types from ApiCenter for convenience
export type { User, Word, WordGroup, ApiResponse } from '../services/ApiCenter';
