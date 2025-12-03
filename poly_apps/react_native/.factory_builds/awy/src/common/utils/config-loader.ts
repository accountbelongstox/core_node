/**
 * Configuration Loader
 * 
 * Configuration constants - no file reading in React Native
 * Each app should define its own API configuration constants
 * 
 * Note: React Native cannot read files at runtime like Node.js.
 * Configuration should be defined as constants in each app's config directory.
 */

/**
 * Get config value from section
 * Helper function for accessing config objects
 */
export function getConfigValue(
  config: Record<string, Record<string, string>>,
  section: string,
  key: string,
  defaultValue?: string
): string | undefined {
  return config[section]?.[key] || defaultValue;
}

