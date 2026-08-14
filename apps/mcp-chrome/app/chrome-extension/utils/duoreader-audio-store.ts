/**
 * Local backup for Duoreader import text + audio (OPFS data directory).
 *
 * Layout:
 *   cache/duoreader/books/{bookId}/chapters/{chapterIndex}/chapter.json
 *   cache/duoreader/books/{bookId}/chapters/{chapterIndex}/{lang}/{contentId}.mp3
 *   cache/duoreader/books/{bookId}/chapters/{chapterIndex}/{lang}/{contentId}.json
 */

import type { DuoreaderChapter } from '@/utils/duoreader-importer-core';
import { isOpfsAvailable, writeOpfsFile } from '@/utils/opfs';

export const DUOREADER_DATA_ROOT = 'cache/duoreader';

export interface DuoreaderAudioMeta {
  bookId: string;
  chapterIndex: number;
  lang: string;
  contentId: string;
  text: string;
  mime: string;
  bytes: number;
  source: 'duoreader-api';
  fetchedAt: string;
}

export function describeDuoreaderDataLocation(): string {
  if (isOpfsAvailable()) {
    return `OPFS · ${DUOREADER_DATA_ROOT}/books/{bookId}/chapters/{ch}/`;
  }
  return `OPFS unavailable — intended: ${DUOREADER_DATA_ROOT}/books/{bookId}/chapters/{ch}/`;
}

async function getRootDir(): Promise<FileSystemDirectoryHandle> {
  const opfs = await navigator.storage.getDirectory();
  return opfs.getDirectoryHandle(DUOREADER_DATA_ROOT, { create: true });
}

async function getBookChapterDir(bookId: string, chapterIndex: number): Promise<FileSystemDirectoryHandle> {
  const root = await getRootDir();
  const books = await root.getDirectoryHandle('books', { create: true });
  const book = await books.getDirectoryHandle(sanitizeSegment(bookId), { create: true });
  const chapters = await book.getDirectoryHandle('chapters', { create: true });
  return chapters.getDirectoryHandle(String(chapterIndex), { create: true });
}

async function getLangDir(
  bookId: string,
  chapterIndex: number,
  lang: string,
): Promise<FileSystemDirectoryHandle> {
  const chapterDir = await getBookChapterDir(bookId, chapterIndex);
  return chapterDir.getDirectoryHandle(sanitizeSegment(lang), { create: true });
}

function sanitizeSegment(value: string): string {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Persist chapter bilingual text once per chapter. */
export async function backupChapterText(
  bookId: string,
  chapter: DuoreaderChapter,
): Promise<boolean> {
  if (!isOpfsAvailable()) return false;
  try {
    const dir = await getBookChapterDir(bookId, chapter.chapterIndex);
    const handle = await dir.getFileHandle('chapter.json', { create: true });
    const payload = {
      bookId,
      chapterIndex: chapter.chapterIndex,
      segmentIndex: chapter.segmentIndex,
      articleIndex: chapter.articleIndex,
      titleEn: chapter.titleEn,
      titleZh: chapter.titleZh,
      paragraphs: chapter.paragraphs,
      savedAt: new Date().toISOString(),
    };
    await writeOpfsFile(handle, JSON.stringify(payload, null, 0));
    return true;
  } catch {
    return false;
  }
}

/** Persist one sentence MP3 + sidecar metadata. */
export async function backupSentenceAudio(
  bookId: string,
  chapterIndex: number,
  lang: string,
  contentId: string,
  text: string,
  audioBytes: Uint8Array,
): Promise<boolean> {
  if (!isOpfsAvailable() || !audioBytes?.length) return false;
  try {
    const dir = await getLangDir(bookId, chapterIndex, lang);
    const mp3Handle = await dir.getFileHandle(`${contentId}.mp3`, { create: true });
    await writeOpfsFile(mp3Handle, audioBytes);
    const meta: DuoreaderAudioMeta = {
      bookId,
      chapterIndex,
      lang,
      contentId,
      text,
      mime: 'audio/mpeg',
      bytes: audioBytes.length,
      source: 'duoreader-api',
      fetchedAt: new Date().toISOString(),
    };
    const metaHandle = await dir.getFileHandle(`${contentId}.json`, { create: true });
    await writeOpfsFile(metaHandle, JSON.stringify(meta, null, 0));
    return true;
  } catch {
    return false;
  }
}

/** True when both mp3 and meta exist locally (skip re-fetch). */
export async function hasLocalSentenceAudio(
  bookId: string,
  chapterIndex: number,
  lang: string,
  contentId: string,
): Promise<boolean> {
  if (!isOpfsAvailable()) return false;
  try {
    const dir = await getLangDir(bookId, chapterIndex, lang);
    await dir.getFileHandle(`${contentId}.mp3`, { create: false });
    await dir.getFileHandle(`${contentId}.json`, { create: false });
    return true;
  } catch {
    return false;
  }
}

/** Read cached MP3 bytes when present. */
export async function readLocalSentenceAudio(
  bookId: string,
  chapterIndex: number,
  lang: string,
  contentId: string,
): Promise<Uint8Array | null> {
  if (!isOpfsAvailable()) return null;
  try {
    const dir = await getLangDir(bookId, chapterIndex, lang);
    const handle = await dir.getFileHandle(`${contentId}.mp3`, { create: false });
    const file = await handle.getFile();
    const buf = await file.arrayBuffer();
    return buf.byteLength ? new Uint8Array(buf) : null;
  } catch {
    return null;
  }
}
