/**
 * Generate encrypted string utility function
 * Uses simple Base64 encoding + timestamp to generate unique string
 */
export function generateEncryptedString(appId: string, timestamp?: number): string {
  const time = timestamp || Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const combined = `${appId}-${time}-${random}`;
  
  // Use Base64 encoding
  const encoded = btoa(combined)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return encoded.substring(0, 32); // Limit length to 32 characters
}

/**
 * Parse APP ID from encrypted string (if needed)
 */
export function parseEncryptedString(encrypted: string): string | null {
  try {
    // Try to decode
    const decoded = atob(encrypted.replace(/-/g, '+').replace(/_/g, '/'));
    const parts = decoded.split('-');
    return parts[0] || null;
  } catch {
    return null;
  }
}

