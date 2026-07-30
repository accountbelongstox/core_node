/**
 * Web shim for @capacitor/camera.
 *
 * Backs the Capacitor Camera plugin with an <input type="file"> picker
 * (capture="environment" for the camera source) returning the image as a
 * dataUrl / base64. Multi-pick uses `multiple`. Aliased on the web build.
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working. Editing/crop is ignored on
 * web; width/height resizing is applied via a canvas when requested.
 */

export enum CameraResultType {
  Uri = 'uri',
  Base64 = 'base64',
  DataUrl = 'dataUrl',
}
export enum CameraSource {
  Prompt = 'PROMPT',
  Camera = 'CAMERA',
  Photos = 'PHOTOS',
}
export enum CameraDirection {
  Rear = 'REAR',
  Front = 'FRONT',
}

export interface ImageOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
  saveToGallery?: boolean;
  width?: number;
  height?: number;
  correctOrientation?: boolean;
  source?: CameraSource;
  direction?: CameraDirection;
}
export interface GalleryImageOptions {
  quality?: number;
  limit?: number;
  width?: number;
  height?: number;
}

export interface Photo {
  base64String?: string;
  dataUrl?: string;
  webPath?: string;
  path?: string;
  format: string;
  saved: boolean;
}
export interface GalleryPhoto {
  webPath: string;
  dataUrl?: string;
  base64String?: string;
  format: string;
}

function pickFiles(opts: { multiple?: boolean; capture?: boolean }): Promise<File[]> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No DOM available for the camera fallback.'));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (opts.multiple) input.multiple = true;
    if (opts.capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    let settled = false;
    const cleanup = (): void => {
      window.removeEventListener('focus', onFocus, true);
      setTimeout(() => input.remove(), 0);
    };
    const onChange = (): void => {
      settled = true;
      const files = input.files ? Array.from(input.files) : [];
      cleanup();
      if (files.length) resolve(files);
      else reject(new Error('No image selected.'));
    };
    // Detect cancel (focus returns without a change after a tick).
    const onFocus = (): void => {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          cleanup();
          reject(new Error('User cancelled photos app'));
        }
      }, 500);
    };
    input.addEventListener('change', onChange);
    window.addEventListener('focus', onFocus, true);
    document.body.appendChild(input);
    input.click();
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function maybeResize(dataUrl: string, opts: { width?: number; height?: number; quality?: number }): Promise<string> {
  if (!opts.width && !opts.height) return dataUrl;
  if (typeof document === 'undefined' || typeof Image === 'undefined') return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const maxW = opts.width ?? width;
      const maxH = opts.height ?? height;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', (opts.quality ?? 90) / 100));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function stripBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function formatOf(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl);
  return m ? m[1] : 'jpeg';
}

export const Camera = {
  async getPhoto(options: ImageOptions = {}): Promise<Photo> {
    const useCamera = options.source === CameraSource.Camera;
    const files = await pickFiles({ capture: useCamera });
    let dataUrl = await fileToDataUrl(files[0]);
    dataUrl = await maybeResize(dataUrl, options);
    const format = formatOf(dataUrl);
    const resultType = options.resultType ?? CameraResultType.DataUrl;
    const photo: Photo = { format, saved: false };
    if (resultType === CameraResultType.Base64) photo.base64String = stripBase64(dataUrl);
    else if (resultType === CameraResultType.Uri) photo.webPath = dataUrl;
    else photo.dataUrl = dataUrl;
    return photo;
  },
  async pickImages(options: GalleryImageOptions = {}): Promise<{ photos: GalleryPhoto[] }> {
    const files = await pickFiles({ multiple: true });
    const limited = options.limit ? files.slice(0, options.limit) : files;
    const photos: GalleryPhoto[] = [];
    for (const f of limited) {
      let dataUrl = await fileToDataUrl(f);
      dataUrl = await maybeResize(dataUrl, options);
      photos.push({ webPath: dataUrl, dataUrl, format: formatOf(dataUrl) });
    }
    return { photos };
  },
  async checkPermissions(): Promise<{ camera: string; photos: string }> {
    return { camera: 'prompt', photos: 'granted' };
  },
  async requestPermissions(): Promise<{ camera: string; photos: string }> {
    return { camera: 'granted', photos: 'granted' };
  },
};

export default { Camera, CameraResultType, CameraSource, CameraDirection };
