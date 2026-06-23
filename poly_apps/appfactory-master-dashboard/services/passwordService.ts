/**
 * Password Service - Hardcoded encryption password
 * Provides centralized password management for the application
 */

/**
 * Hardcoded encryption password
 * This password is automatically added to all URLs as ?pp=BuildFactoryEncryptionKey2025
 */
export const HARDCODED_PASSWORD = 'BuildFactoryEncryptionKey2025';

/**
 * Password parameter name used in URLs
 */
export const PASSWORD_PARAM_NAME = 'pp';

/**
 * Get the password parameter string for URL
 * @returns Query string like "?pp=BuildFactoryEncryptionKey2025"
 */
export function getPasswordParam(): string {
  return `?${PASSWORD_PARAM_NAME}=${HARDCODED_PASSWORD}`;
}

/**
 * Get the password parameter object for URLSearchParams
 * @returns Object with password parameter
 */
export function getPasswordParamObject(): Record<string, string> {
  return {
    [PASSWORD_PARAM_NAME]: HARDCODED_PASSWORD,
  };
}

