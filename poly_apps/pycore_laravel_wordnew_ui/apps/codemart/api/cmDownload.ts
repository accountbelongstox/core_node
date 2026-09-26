const DISPOSITION_UTF8_PATTERN = /filename\*=UTF-8''([^;]+)/i;
const DISPOSITION_PLAIN_PATTERN = /filename="?([^";]+)"?/i;
const REVOKE_DELAY_MS = 1000;

export function cmFileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = DISPOSITION_UTF8_PATTERN.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return encoded[1];
    }
  }
  const plain = DISPOSITION_PLAIN_PATTERN.exec(header);
  return plain?.[1] ?? null;
}

export function cmSaveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
