/* Wf global search — the one ranking engine behind the header search. Three
 * providers share one scoring rule: app pages (command palette), loaded home
 * content groups, and dictionary words (backend search with a local-pool and
 * favorites fallback). Pure functions; the overlay owns state and debounce. */

import { House, type LucideIcon } from 'lucide-react';
import { wfNewApi } from '../api';
import type { Word, WfNewContentGroup, WfNewContentKind, WfNewHomeContent } from '../api';
import { wordNewPageHeader, WORDNEW_CONTENT_KIND_ICONS, type WordNewTab } from '../routing/WordNewHashRoutes';

export type WordNewSearchScope = 'all' | 'words' | 'content' | 'pages';

/** A leading '>' switches the query to page commands only. */
export const WORDNEW_SEARCH_COMMAND_PREFIX = '>';

export interface WordNewPageHit {
  kind: 'page';
  key: string;
  tab: WordNewTab;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  score: number;
}

export interface WordNewContentHit {
  kind: 'content';
  key: string;
  group: WfNewContentGroup;
  icon: LucideIcon;
  score: number;
}

export interface WordNewWordHit {
  kind: 'word';
  key: string;
  word: Word;
  score: number;
}

export type WordNewSearchHit = WordNewPageHit | WordNewContentHit | WordNewWordHit;

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

/** Pages reachable without route context (book/library/list pages need a selection). */
const SEARCHABLE_TABS: readonly WordNewTab[] = Object.freeze([
  'home', 'shelf', 'practice', 'daily-reading', 'orch-audio', 'walkman', 'subtitles', 'bilingual',
  'stats', 'labs', 'social', 'settings', 'languages', 'learning-model', 'review-settings',
  'playback', 'cache', 'about', 'download', 'profile', 'admin',
]);

/** Pages offered as one-tap shortcuts while the query is empty. */
export const WORDNEW_SEARCH_QUICK_TABS: readonly WordNewTab[] = Object.freeze([
  'shelf', 'practice', 'daily-reading', 'orch-audio', 'walkman', 'stats',
]);

const CONTENT_SECTIONS: readonly (keyof WfNewHomeContent)[] = Object.freeze(['words', 'books', 'subtitles', 'libraries', 'documents']);

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** 100 exact, 80 prefix, 60 word-prefix, 40 substring, 0 no match. */
export function scoreSearchMatch(query: string, ...fields: (string | undefined)[]): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    const f = normalizeSearchText(field);
    if (f === q) return 100;
    if (f.startsWith(q)) best = Math.max(best, 80);
    else if (f.split(/[\s\-_/·,.]+/).some((part) => part.startsWith(q))) best = Math.max(best, 60);
    else if (f.includes(q)) best = Math.max(best, 40);
  }
  return best;
}

/** Split `text` into [before, match, after] around the first case-insensitive hit. */
export function splitSearchMatch(text: string, query: string): [string, string, string] {
  const q = query.trim();
  if (!q) return [text, '', ''];
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return [text, '', ''];
  return [text.slice(0, index), text.slice(index, index + q.length), text.slice(index + q.length)];
}

export function isCommandQuery(query: string): boolean {
  return query.trimStart().startsWith(WORDNEW_SEARCH_COMMAND_PREFIX);
}

export function stripCommandPrefix(query: string): string {
  return isCommandQuery(query) ? query.trimStart().slice(WORDNEW_SEARCH_COMMAND_PREFIX.length).trim() : query.trim();
}

export function wordNewSearchPage(tab: WordNewTab, trans: Trans): Omit<WordNewPageHit, 'score'> {
  const header = wordNewPageHeader(tab, trans, { contentListKind: null });
  return header
    ? { kind: 'page', key: `page:${tab}`, tab, title: header.title, subtitle: header.subtitle, icon: header.icon }
    : { kind: 'page', key: `page:${tab}`, tab, title: trans('nav.home'), icon: House };
}

export function searchPages(
  query: string,
  trans: Trans,
  access: { isLoggedIn: boolean; isSuperAdmin: boolean },
): WordNewPageHit[] {
  const q = stripCommandPrefix(query);
  return SEARCHABLE_TABS
    .filter((tab) => (tab !== 'profile' || access.isLoggedIn) && (tab !== 'admin' || access.isSuperAdmin))
    .map((tab) => {
      const page = wordNewSearchPage(tab, trans);
      return { ...page, score: q ? scoreSearchMatch(q, page.title, page.subtitle, tab) : 1 };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function searchContent(query: string, content: WfNewHomeContent): WordNewContentHit[] {
  const seen = new Set<string>();
  const hits: WordNewContentHit[] = [];
  for (const section of CONTENT_SECTIONS) {
    for (const group of content[section] ?? []) {
      const key = `content:${group.kind}:${group.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const score = scoreSearchMatch(query, group.title, group.description, group.category, group.language);
      if (score > 0) hits.push({ kind: 'content', key, group, icon: contentKindIcon(group.kind), score });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

export function contentKindIcon(kind: WfNewContentKind): LucideIcon {
  return WORDNEW_CONTENT_KIND_ICONS[kind];
}

function rankWords(query: string, words: Word[]): WordNewWordHit[] {
  const seen = new Set<string>();
  const hits: WordNewWordHit[] = [];
  for (const word of words) {
    const id = String(word.id ?? word.text);
    if (seen.has(id)) continue;
    seen.add(id);
    const score = scoreSearchMatch(query, word.text, word.translation, word.definition);
    hits.push({ kind: 'word', key: `word:${id}`, word, score: Math.max(score, 1) });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/** Local words matching the query (favorites first, then the loaded pool). */
export function searchLocalWords(query: string, favorites: Word[], pool: Word[]): WordNewWordHit[] {
  if (!query.trim()) return [];
  return rankWords(query, [...favorites, ...pool].filter((w) => scoreSearchMatch(query, w.text, w.translation, w.definition) > 0));
}

/** Dictionary words: backend first, merged with local matches; never throws. */
export async function searchWords(query: string, favorites: Word[], pool: Word[]): Promise<WordNewWordHit[]> {
  const local = searchLocalWords(query, favorites, pool).map((hit) => hit.word);
  let remote: Word[] = [];
  try {
    const result = await wfNewApi.searchDictionary(query.trim());
    remote = Array.isArray(result) ? result : [];
  } catch {
    remote = [];
  }
  return rankWords(query, [...remote, ...local]);
}
