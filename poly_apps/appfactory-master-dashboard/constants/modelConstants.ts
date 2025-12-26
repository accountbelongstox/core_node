/**
 * Model Constants
 * Centralized constants for business rules and configurations
 */

// CS Level Definitions
export enum CSLevel {
  JUNIOR = '初级',
  INTERMEDIATE = '中级',
  SENIOR = '高级',
}

// Commission Rate by CS Level (percentage)
export const COMMISSION_RATE_BY_LEVEL: Record<CSLevel, number> = {
  [CSLevel.JUNIOR]: 10,
  [CSLevel.INTERMEDIATE]: 12,
  [CSLevel.SENIOR]: 15,
};

// Default Commission Rate (fallback)
export const DEFAULT_COMMISSION_RATE = 10;

/**
 * Get commission rate by CS level
 */
export const getCommissionRateByLevel = (level: string): number => {
  return COMMISSION_RATE_BY_LEVEL[level as CSLevel] || DEFAULT_COMMISSION_RATE;
};

// Promoter Unit Price (can be configured per promoter, but default is constant)
export const DEFAULT_PROMOTER_UNIT_PRICE = 50;

// System Initialization Date (for new system)
export const SYSTEM_INIT_DATE = new Date().toISOString().split('T')[0];

