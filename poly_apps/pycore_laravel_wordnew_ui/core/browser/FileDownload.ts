/** Offer in-memory text to the browser as a downloaded file. */
export function offerTextFile(name: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch { /* non-DOM environment */ }
}
