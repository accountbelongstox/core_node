/**
 * Duoreader CDN .pz fetch + decode + paragraph extraction.
 */

import type { DuoreaderParagraph } from './duoreader-importer-core';
import { unpackDuoreaderPzBytesAsync } from './pz-bunzip';

export const DUOREADER_CDN_BASE = 'https://dl-public.xiangyin.mobi/multi_lang_read/';

export interface DuoreaderArticleRef {
  articleId: string;
  segmentIndex: number;
  articleIndex: number;
  titleEn: string;
  titleZh: string;
}

export interface DuoreaderApiTestResult {
  ok: boolean;
  bookId: string;
  bookPzBytes: number;
  articleCount: number;
  sampleArticleId: string;
  sampleParagraphs: number;
  sampleEnPreview: string;
  sampleZhPreview: string;
  elapsedMs: number;
  error?: string;
  mode: 'cdn_api';
}

export function articlePzUrl(bookId: string, segmentIndex: number, articleIndex: number, myLang: string, learnLang: string): string {
  return `${DUOREADER_CDN_BASE}${bookId}/article_part_${segmentIndex}_art_${articleIndex}__${myLang}_${learnLang}.pz`;
}

export function bookPzUrl(bookId: string): string {
  return `${DUOREADER_CDN_BASE}${bookId}/book.pz`;
}

export async function unpackPzBytes(raw: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  return unpackDuoreaderPzBytesAsync(bytes);
}

export async function fetchPz(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`PZ HTTP ${res.status}: ${url}`);
  }
  const buf = await res.arrayBuffer();
  return unpackPzBytes(buf);
}

export function parseArticleIdsFromBook(bookBytes: Uint8Array): DuoreaderArticleRef[] {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bookBytes);
  const ids = [...text.matchAll(/part_(\d+)_art_(\d+)/g)].map((m) => ({
    articleId: m[0],
    segmentIndex: Number(m[1]),
    articleIndex: Number(m[2]),
    titleEn: '',
    titleZh: '',
  }));
  const seen = new Set<string>();
  return ids.filter((row) => {
    if (seen.has(row.articleId)) return false;
    seen.add(row.articleId);
    return true;
  });
}

function readVarint(data: Uint8Array, start: number): { value: number; next: number } | null {
  let shift = 0;
  let value = 0;
  let i = start;
  while (i < data.length) {
    const b = data[i];
    i += 1;
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) {
      return { value, next: i };
    }
    shift += 7;
    if (shift > 35) return null;
  }
  return null;
}

function collectWireStrings(data: Uint8Array, out: Array<{ field: number; text: string }>, depth = 0): void {
  if (depth > 12) return;
  let i = 0;
  while (i < data.length) {
    const tag = readVarint(data, i);
    if (!tag) break;
    i = tag.next;
    const field = tag.value >> 3;
    const wire = tag.value & 7;
    if (wire === 0) {
      const v = readVarint(data, i);
      if (!v) break;
      i = v.next;
    } else if (wire === 2) {
      const lenVar = readVarint(data, i);
      if (!lenVar) break;
      i = lenVar.next;
      const len = lenVar.value;
      if (len < 0 || i + len > data.length) break;
      const chunk = data.subarray(i, i + len);
      i += len;
      let decoded = '';
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(chunk);
      } catch {
        collectWireStrings(chunk, out, depth + 1);
        continue;
      }
      if (decoded.length >= 2) {
        out.push({ field, text: decoded });
      }
    } else if (wire === 1) {
      i += 8;
    } else if (wire === 5) {
      i += 4;
    } else {
      break;
    }
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMetadata(text: string): boolean {
  if (text.includes('pride_and_prejudice') && text.includes('Pride and Prejudice')) return true;
  if (/^part_\d+_art_\d+$/i.test(text)) return true;
  if (/^Chapter \d+$/i.test(text) && text.length < 20) return true;
  if (/^第.+章$/u.test(text) && text.length < 12) return true;
  return false;
}

function splitBilingualBlob(text: string): Array<{ en: string; zh: string }> {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  const parts = cleaned.split(/\x12/g).map((p) => cleanText(p.replace(/^[\W\d]+/, ''))).filter(Boolean);
  const enParts = parts.filter((p) => /^[A-Za-z"'!]/.test(p) && !/[\u4e00-\u9fff]/.test(p));
  const zhParts = parts.filter((p) => /[\u4e00-\u9fff]/.test(p));
  if (enParts.length && zhParts.length) {
    return [{ en: enParts[0], zh: zhParts[zhParts.length - 1] }];
  }
  return [];
}

export function parseArticleParagraphs(articleBytes: Uint8Array): DuoreaderParagraph[] {
  const wire: Array<{ field: number; text: string }> = [];
  collectWireStrings(articleBytes, wire);

  const paragraphs: DuoreaderParagraph[] = [];
  let pendingEn = '';

  for (const item of wire) {
    const text = cleanText(item.text);
    if (!text || isMetadata(text)) continue;

    const embedded = splitBilingualBlob(item.text);
    for (const pair of embedded) {
      if (pair.en.length > 8 && pair.zh.length > 2) {
        paragraphs.push({ seq: paragraphs.length, en: pair.en, zh: pair.zh });
      }
    }

    const isEn = /^[A-Za-z"'!]/.test(text) && !/[\u4e00-\u9fff]/.test(text);
    const isZh = /[\u4e00-\u9fff]/.test(text);

    if (isEn && text.length > 12) {
      pendingEn = text;
      continue;
    }
    if (isZh && text.length > 2) {
      if (pendingEn) {
        paragraphs.push({ seq: paragraphs.length, en: pendingEn, zh: text });
        pendingEn = '';
      }
    }
  }

  const deduped: DuoreaderParagraph[] = [];
  const seen = new Set<string>();
  for (const p of paragraphs) {
    const key = `${p.en.slice(0, 40)}|${p.zh.slice(0, 20)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...p, seq: deduped.length });
  }
  return deduped;
}
