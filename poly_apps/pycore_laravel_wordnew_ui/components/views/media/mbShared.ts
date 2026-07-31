import { getDefaultBaseURL } from '../../../config/constants';
import { getSharedBaseURL } from '@/apps/laravel-manager/api';
import type {
  MediaSourceListItem,
  MediaSegment,
  MediaSentence,
  MediaGrain,
} from '@/apps/laravel-manager/api';
import type { FileNode } from '../../../types';

/** Resolve a possibly-relative media/clip/audio URL against the live API base. */
export function resolveMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getSharedBaseURL() || getDefaultBaseURL();
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

/** Format seconds as m:ss (or h:mm:ss). */
export function formatTime(sec: number | undefined): string {
  if (sec === undefined || sec === null || isNaN(sec)) return '--:--';
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  if (h > 0) return `${h}:${mm}:${String(ss).padStart(2, '0')}`;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export type Segment = 'movies' | 'books' | 'files' | 'code';

export type Selection =
  | { kind: 'source'; source: MediaSourceListItem & { kind: 'movies' | 'books' } }
  | { kind: 'file'; file: FileNode }
  | null;

export type { MediaSourceListItem, MediaSegment, MediaSentence, MediaGrain };
export type { FileNode };
