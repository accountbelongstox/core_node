/**
 * Extract a human-readable task content label from local input_data or Laravel payload.
 */

type LooseRecord = Record<string, unknown> | null | undefined;

function wordLabelsFromList(words: unknown): string[] {
  if (!Array.isArray(words)) return [];
  const labels: string[] = [];
  for (const entry of words) {
    if (typeof entry === 'string' && entry.trim()) {
      labels.push(entry.trim());
    } else if (entry && typeof entry === 'object') {
      const w = (entry as Record<string, unknown>).word ?? (entry as Record<string, unknown>).content;
      if (typeof w === 'string' && w.trim()) labels.push(w.trim());
    }
  }
  return labels;
}

function scalarText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/** One-line summary for list rows and modal headers. */
export function extractTaskContentSummary(data: LooseRecord): string {
  if (!data) return '—';

  const preview = scalarText(data.content_preview);
  if (preview) return preview;

  const labels = wordLabelsFromList(data.words);
  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return `${labels[0]} (+${labels.length - 1})`;

  const single = scalarText(data.content) || scalarText(data.text) || scalarText(data.word);
  if (single) return single;

  const contentId = data.content_id;
  if (contentId != null && String(contentId).trim()) return String(contentId);

  const md5 = scalarText(data.md5);
  if (md5) return `md5:${md5}`;

  return '—';
}

/** Merge local input_data with optional remote Laravel payload for display. */
export function mergeTaskContentSources(
  local: LooseRecord,
  remotePayload: unknown,
): string {
  const fromLocal = extractTaskContentSummary(local);
  if (fromLocal !== '—') return fromLocal;
  if (remotePayload && typeof remotePayload === 'object') {
    return extractTaskContentSummary(remotePayload as Record<string, unknown>);
  }
  return '—';
}
