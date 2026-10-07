export const IMAGE_MIME = /^image\//i;

export type PcClipboardReadResult =
  | { status: 'ok'; images: File[]; text: string }
  | { status: 'unsupported' | 'permission' };

/** Reads this device's clipboard: every image item as a File plus the first plain text. */
export async function readPcClipboard(): Promise<PcClipboardReadResult> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clipboard?.read && !clipboard?.readText) return { status: 'unsupported' };
  const images: File[] = [];
  let text = '';
  try {
    if (clipboard.read) {
      for (const item of await clipboard.read()) {
        const imageType = item.types.find((type) => IMAGE_MIME.test(type));
        if (imageType) {
          images.push(new File([await item.getType(imageType)], `clipboard.${imageType.split('/')[1] || 'png'}`, { type: imageType }));
        } else if (!text && item.types.includes('text/plain')) {
          text = await (await item.getType('text/plain')).text();
        }
      }
    } else {
      text = await clipboard.readText();
    }
  } catch {
    return { status: 'permission' };
  }
  return { status: 'ok', images, text };
}
