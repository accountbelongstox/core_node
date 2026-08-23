export const WORDNEW_HASH_ROUTES = Object.freeze({
  dailyReading: 'daily-reading',
  wordGroups: 'shelf',
});

export interface WordNewWordGroupRoute {
  matched: boolean;
  groupId: string | null;
}

function hashPath(hash: string): string {
  return hash.replace(/^#\/?/, '').split('?')[0] ?? '';
}

export function dailyReadingHash(articleId?: string | null): string {
  return articleId
    ? `#/${WORDNEW_HASH_ROUTES.dailyReading}/${encodeURIComponent(articleId)}`
    : `#/${WORDNEW_HASH_ROUTES.dailyReading}`;
}

export function dailyReadingArticleId(hash: string): string | null {
  const path = hashPath(hash);
  const prefix = `${WORDNEW_HASH_ROUTES.dailyReading}/`;

  return path.startsWith(prefix)
    ? decodeURIComponent(path.slice(prefix.length)).trim() || null
    : null;
}

export function wordGroupHash(groupId?: string | null): string {
  return groupId
    ? `#/${WORDNEW_HASH_ROUTES.wordGroups}/${encodeURIComponent(groupId)}`
    : `#/${WORDNEW_HASH_ROUTES.wordGroups}`;
}

export function parseWordGroupHash(hash: string): WordNewWordGroupRoute {
  const path = hashPath(hash);
  const prefix = `${WORDNEW_HASH_ROUTES.wordGroups}/`;

  if (path === WORDNEW_HASH_ROUTES.wordGroups) return { matched: true, groupId: null };
  if (!path.startsWith(prefix)) return { matched: false, groupId: null };
  return {
    matched: true,
    groupId: decodeURIComponent(path.slice(prefix.length)).trim() || null,
  };
}
