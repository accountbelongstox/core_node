export const SYSTEM_CLIPBOARD_IMAGE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp',
]);

export type SystemClipboardCopyResult = 'copied' | 'unsupported' | 'failed';

export async function copyTextToSystemClipboard(text: string): Promise<boolean> {
  const textarea = typeof document === 'undefined' ? null : document.createElement('textarea');
  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  const selection = typeof window === 'undefined' ? null : window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const inputSelection = typeof HTMLInputElement !== 'undefined' && typeof HTMLTextAreaElement !== 'undefined'
    && (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)
    ? { start: activeElement.selectionStart, end: activeElement.selectionEnd, direction: activeElement.selectionDirection } : null;
  let copied = false;

  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  if (!textarea) return false;
  try {
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    if (typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement) activeElement.focus({ preventScroll: true });
    if (inputSelection && (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)
      && inputSelection.start !== null && inputSelection.end !== null) {
      activeElement.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction ?? undefined);
    }
    if (selection && ranges.length) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
  return copied;
}

async function imageAsPng(blob: Blob): Promise<Blob> {
  const image = new Image();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let objectUrl = '';

  if (blob.type === 'image/png') return blob;
  if (!context) throw new Error('SYSTEM_CLIPBOARD_IMAGE_CONVERSION_FAILED');
  try {
    objectUrl = URL.createObjectURL(blob);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SYSTEM_CLIPBOARD_IMAGE_DECODE_FAILED'));
      image.src = objectUrl;
    });
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => png ? resolve(png) : reject(new Error('SYSTEM_CLIPBOARD_IMAGE_CONVERSION_FAILED')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function copyImageToSystemClipboard(load: () => Promise<Blob>): Promise<SystemClipboardCopyResult> {
  let png: Promise<Blob> | null = null;

  if (typeof navigator === 'undefined' || !window.isSecureContext
    || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined'
    || (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports('image/png'))) return 'unsupported';
  try {
    png = load().then(imageAsPng);
    void png.catch(() => {});
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return 'copied';
  } catch {
    return 'failed';
  }
}
