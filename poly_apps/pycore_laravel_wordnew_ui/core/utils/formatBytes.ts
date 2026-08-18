/** Format a byte count with binary units and one decimal above bytes. */
export function formatBytes(
  bytes: number | null | undefined,
  invalidLabel = '0 B',
): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return invalidLabel;
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`;
  if (megabytes < 1024 * 1024) return `${(megabytes / 1024).toFixed(1)} GB`;
  return `${(megabytes / (1024 * 1024)).toFixed(1)} TB`;
}
