/**
 * Shared time-formatting helpers used across popup composables.
 */

/**
 * Format a Unix timestamp as a human-friendly relative string.
 * Returns "Never" for null/0, then "Just now" / "Xm ago" / "Xh ago" / "Xd ago".
 */
export const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) return 'Never';

  const diff = Date.now() - timestamp;

  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};
