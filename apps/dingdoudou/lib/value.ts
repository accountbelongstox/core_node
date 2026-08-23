export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

export function errorText(value: unknown, fallback = ''): string {
  if (value instanceof Error && value.message.trim()) return value.message;
  if (typeof value === 'string' && value.trim()) return value;
  const record = asRecord(value);
  const message = record?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
