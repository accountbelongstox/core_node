// Upload progress model + type classification for the media browser.
// classifyUploadType reuses the extension buckets lifted VERBATIM from
// MediaBrowser.tsx detectFileType (~464-475), narrowed to the upload type union.

export type UploadFileStatus = 'queued' | 'uploading' | 'encoding' | 'done' | 'failed';

export interface UploadItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'other';
  status: UploadFileStatus;
  pct: number;
  error?: string;
}

// NO || or ?? allowed
export function classifyUploadType(name: string): 'video' | 'audio' | 'image' | 'other' {
  const parts = name.split('.');
  const ext = parts[parts.length - 1].toLowerCase();
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'm3u8'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  return 'other';
}
