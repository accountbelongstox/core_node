/**
 * Array validation utilities
 * Reusable functions for defensive array handling
 */

/**
 * Ensures a value is an array, with fallback
 * @param value - Value to check
 * @param fallback - Default array to use if value is not an array
 * @returns Valid array
 */
export function ensureArray<T>(value: any, fallback: T[] = []): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.results)) return value.results;
    if (Array.isArray(value.list)) return value.list;
    if (Array.isArray(value.voices)) return value.voices;
    if (Array.isArray(value.languages)) return value.languages;
  }

  console.info('[ensureArray] Value is not an array, using fallback:', value);
  return fallback;
}

/**
 * Safely extract array from API response
 * @param response - API response object
 * @param fallback - Default array to use if extraction fails
 * @returns Valid array
 */
export function extractArrayFromResponse<T>(
  response: any,
  fallback: T[] = []
): T[] {
  if (!response) return fallback;

  if (response.success && response.data) {
    return ensureArray(response.data, fallback);
  }

  return ensureArray(response, fallback);
}

/**
 * Safely map over array-like values
 * @param value - Value to map over
 * @param mapFn - Mapping function
 * @param fallback - Fallback result if value is not array
 * @returns Mapped array
 */
export function safeMap<T, R>(
  value: any,
  mapFn: (item: T, index: number) => R,
  fallback: R[] = []
): R[] {
  const arr = ensureArray<T>(value, []);
  if (arr.length === 0) return fallback;
  return arr.map(mapFn);
}

/**
 * Safely filter array-like values
 * @param value - Value to filter
 * @param filterFn - Filter predicate
 * @param fallback - Fallback result if value is not array
 * @returns Filtered array
 */
export function safeFilter<T>(
  value: any,
  filterFn: (item: T, index: number) => boolean,
  fallback: T[] = []
): T[] {
  const arr = ensureArray<T>(value, fallback);
  if (arr.length === 0) return fallback;
  return arr.filter(filterFn);
}
