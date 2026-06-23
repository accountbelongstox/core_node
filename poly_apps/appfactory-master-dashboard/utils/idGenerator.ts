/**
 * Safe ID Generator
 * Generates unique IDs to avoid conflicts
 */

let idCounter = 0;

/**
 * Generate a unique ID with prefix
 * Format: {prefix}-{timestamp}-{random}-{counter}
 */
export const generateId = (prefix: string): string => {
  idCounter++;
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString(36).padStart(4, '0');
  return `${prefix}-${timestamp}-${random}-${idCounter}`;
};

/**
 * Generate a simple ID with prefix (for backward compatibility)
 * Format: {prefix}-{timestamp}
 * Note: Less safe than generateId, but maintains compatibility
 */
export const generateSimpleId = (prefix: string): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}`;
};

