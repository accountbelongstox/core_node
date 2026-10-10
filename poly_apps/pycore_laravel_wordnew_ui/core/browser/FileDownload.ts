const OBJECT_URL_REVOKE_DELAY_MS = 60_000;

/** Offer a blob to the browser as a downloaded file; the object URL outlives the handoff to slow webviews. */
export function offerBlobFile(name: string, blob: Blob): void {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
  } catch { /* non-DOM environment */ }
}

/** Offer in-memory text to the browser as a downloaded file. */
export function offerTextFile(name: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  offerBlobFile(name, new Blob([content], { type: mime }));
}
