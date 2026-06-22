/**
 * Result export helpers for the Unified IT Tools page.
 *
 * Small, dependency-free utilities for exporting a tool result to a file
 * and copying it to the clipboard. All functions are framework-agnostic
 * and safe to call from the browser.
 */

/**
 * Trigger a client-side file download for the given text content.
 *
 * Creates a Blob, wraps it in an object URL, clicks a temporary anchor
 * element, then revokes the URL to release memory.
 */
export function downloadAsFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoke asynchronously so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Convert an arbitrary value to a pretty-printed JSON string.
 *
 * Falls back gracefully when the value is undefined or contains circular
 * references (which would otherwise make JSON.stringify throw).
 */
export function toJsonString(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // Likely a circular reference: strip cycles with a seen-set replacer.
    const seen = new WeakSet<object>();
    try {
      return JSON.stringify(
        value,
        (_key, val) => {
          if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) {
              return '[Circular]';
            }
            seen.add(val);
          }
          return val;
        },
        2,
      );
    } catch {
      // Last-resort fallback: best-effort string coercion.
      return String(value);
    }
  }
}

/**
 * Copy text to the clipboard.
 *
 * Prefers the async Clipboard API and falls back to a hidden textarea
 * with document.execCommand for older / non-secure contexts.
 * Resolves to true on success, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy approach below.
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.select();

    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Build a timestamped export filename, e.g.
 * `nexus-base64-encode-20260519-143012.json`.
 */
export function buildExportFilename(toolId: string, ext: string): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');

  const date =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time =
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  // Sanitize the tool id so the result is always a valid filename.
  const safeId = (toolId || 'result').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const safeExt = ext.replace(/^\.+/, '');

  return `nexus-${safeId}-${date}-${time}.${safeExt}`;
}
