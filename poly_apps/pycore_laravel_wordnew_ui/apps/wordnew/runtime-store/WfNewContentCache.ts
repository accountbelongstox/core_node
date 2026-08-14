/**
 * WfNewContentCache — the ONE local cache for the Content Library data, backed by
 * the Capacitor CapDatabase (native SQLite on device, IndexedDB on web). It lets
 * the home hub render INSTANTLY from cache and fetch only the MISSING fragments:
 *
 *  - Content GROUPS (books / subtitles / libraries / word-groups) are cached per
 *    kind, keyed by the group's stable `id`, with a stored order index. The hub
 *    reads the cache first, then asks the API only for ids it doesn't already
 *    have (fragment / partial fetch) and merges them back.
 *  - WORDS (large volume) are cached per word-group so a re-open never re-fetches
 *    the whole list. Stored in the DB precisely because the volume is high — on
 *    native this is SQLite; on web it is IndexedDB (best-effort, quota-aware).
 *
 * SCOPING (multi-user / multi-endpoint safety)
 *   The collection names are SUFFIXED with the active scope so two users / two
 *   endpoints never collide on a shared device:
 *     - PUBLIC kinds (book / subtitle / library) namespace by endpointId ONLY:
 *         wfnew_content_book__<endpointId>
 *     - AUTH kinds (word groups + per-word lists, per-user private vocabulary)
 *       namespace by endpointId + userId:
 *         wfnew_content_word__<endpointId>__<userId|guest>
 *         wfnew_words__<endpointId>__<userId|guest>
 *   `setCacheScope` swaps the active scope; all reads/writes use the CURRENT
 *   scope. On logout the departing user's auth-scoped collections are deleted
 *   (clearAuthScopedCache) so user B never sees user A's vocabulary.
 *
 * TTL
 *   Every record stamps `cachedAt` on write; on READ a record older than
 *   CACHE_TTL_MS is treated as a MISS so the consumer refetches fresh data.
 *
 * EVICTION
 *   The words collection is capped (WORDS_MAX_GROUPS newest groups by cachedAt)
 *   so it can't grow unbounded on web/IndexedDB.
 *
 * Everything funnels through capDb so a single "Clear all cache" (see
 * WfNewCacheRegistry) can wipe it. NEVER throws out of a public method — a cache
 * miss/failure simply returns empty/null so the caller falls back to the network.
 */
import { capDb } from '@/apps/wordnew/platform/capabilities/CapDatabase';
import type { WfNewContentGroup, WfNewContentKind, Word } from '../api/WfNewApiTypes';

// CapDatabase doc shape (its CapDoc = Record<string, unknown>); we store typed
// objects and cast at the boundary so callers keep full types.
type CapDocLike = Record<string, unknown>;

// --------------------------------------------------------------------------- //
// Dedup chokepoint (defense-in-depth)                                         //
// --------------------------------------------------------------------------- //

/**
 * The ONE place duplicate content groups are collapsed. The backend can (for now)
 * return duplicate public libraries — sometimes the SAME `id` twice, sometimes two
 * DIFFERENT ids for the same logical library (same name + language). This guarantees
 * a duplicate can NEVER reach the cache or the UI regardless of what upstream sends.
 *
 * Strategy — keep the FIRST occurrence, drop later ones, preserving first-seen order:
 *   - PRIMARY key   = `${id}`                              (exact same row)
 *   - SECONDARY key = `${kind}|${title}|${language ?? ''}` (same logical library
 *                     under a different id)
 * A group survives only if BOTH keys are first-seen. O(n), two Sets, stable order.
 */
export function dedupGroups(groups: WfNewContentGroup[]): WfNewContentGroup[] {
  if (!Array.isArray(groups) || groups.length === 0) return groups || [];
  const seenIds = new Set<string>();
  const seenLogical = new Set<string>();
  const out: WfNewContentGroup[] = [];
  for (const g of groups) {
    if (!g) continue;
    const idKey = `${g.id}`;
    if (seenIds.has(idKey)) continue;
    const logicalKey = `${g.kind}|${g.title}|${g.language ?? ''}`;
    if (seenLogical.has(logicalKey)) continue;
    seenIds.add(idKey);
    seenLogical.add(logicalKey);
    out.push(g);
  }
  return out;
}

// Content kinds we cache as GROUPS (documents removed from the hub; words are a
// group kind too but their per-word lists live in the words cache below).
export type WfNewCachedKind = Exclude<WfNewContentKind, 'document'>;

// Which kinds carry PER-USER private data (must namespace by user, cleared on
// logout). Word groups come from the AUTH-only /query_all_groups endpoint and
// the per-word lists are likewise private vocabulary.
const AUTH_KINDS: ReadonlySet<WfNewCachedKind> = new Set<WfNewCachedKind>(['word']);
function isAuthKind(kind: WfNewCachedKind): boolean {
  return AUTH_KINDS.has(kind);
}

// --------------------------------------------------------------------------- //
// Active scope (endpoint + user)                                              //
// --------------------------------------------------------------------------- //

// Safe defaults so reads/writes never crash before the consumer calls
// setCacheScope (e.g. an early render before the endpoint/user are known).
const DEFAULT_ENDPOINT = 'default';
const GUEST = 'guest';

let _endpointId: string = DEFAULT_ENDPOINT;
let _userId: string = GUEST;

/** Sanitize a scope token so it is a safe collection-name suffix (the SQLite
 *  backend already strips unsafe chars, but we keep the index keys clean too). */
function sanitizeScope(s: string): string {
  return (s || '').replace(/[^a-zA-Z0-9_-]/g, '_') || GUEST;
}

/**
 * Set the module-level active scope. PUBLIC kinds namespace by endpointId only;
 * AUTH kinds namespace by endpointId + (userId ?? 'guest'). All subsequent
 * read/write/clear calls operate on the CURRENT scope.
 */
export function setCacheScope(endpointId: string, userId: string | null): void {
  _endpointId = sanitizeScope(endpointId || DEFAULT_ENDPOINT);
  _userId = sanitizeScope(userId || GUEST);
}

// --------------------------------------------------------------------------- //
// TTL + eviction tuning                                                       //
// --------------------------------------------------------------------------- //

/** Records older than this (by `cachedAt`) are ignored on read so the consumer
 *  refetches fresh content. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Cap the words collection to the newest N groups (by cachedAt) to bound the
 *  store size on web/IndexedDB. */
export const WORDS_MAX_GROUPS = 200;

function isFresh(cachedAt: number | undefined): boolean {
  if (typeof cachedAt !== 'number' || !Number.isFinite(cachedAt)) return false;
  return Date.now() - cachedAt <= CACHE_TTL_MS;
}

// --------------------------------------------------------------------------- //
// Scoped collection naming + cross-scope index                                //
// --------------------------------------------------------------------------- //

/**
 * Resolve the scoped collection name for a group kind under the CURRENT scope.
 * PUBLIC kinds -> `wfnew_content_<kind>__<endpointId>`
 * AUTH kinds   -> `wfnew_content_<kind>__<endpointId>__<userId>`
 */
function groupCollectionFor(kind: WfNewCachedKind, endpointId: string, userId: string): string {
  const base = `wfnew_content_${kind}__${endpointId}`;
  return isAuthKind(kind) ? `${base}__${userId}` : base;
}
function GROUP_COLLECTION(kind: WfNewCachedKind): string {
  return groupCollectionFor(kind, _endpointId, _userId);
}

/** Words are always AUTH-scoped (private vocabulary). */
function wordsCollectionFor(endpointId: string, userId: string): string {
  return `wfnew_words__${endpointId}__${userId}`;
}
function WORDS_COLLECTION(): string {
  return wordsCollectionFor(_endpointId, _userId);
}

// Every group kind we cache.
const ALL_KINDS: WfNewCachedKind[] = ['word', 'book', 'subtitle', 'library'];

/** The collections owned under the CURRENT scope (content groups + words). */
function currentScopeCollections(): string[] {
  return [...ALL_KINDS.map((k) => GROUP_COLLECTION(k)), WORDS_COLLECTION()];
}

// CapDatabase has no "list collections" API, so to support clearAllCaches across
// EVERY scope (and across reloads) we persist an index of every scoped collection
// name we have ever written. The index lives in the DB's reserved _kv store.
const SCOPE_INDEX_KEY = 'wfnew_scope_collection_index';
let _indexLoaded = false;
let _knownCollections = new Set<string>();

async function loadIndex(): Promise<void> {
  if (_indexLoaded) return;
  try {
    const stored = (await capDb.kvGet<string[]>(SCOPE_INDEX_KEY, [])) ?? [];
    _knownCollections = new Set(Array.isArray(stored) ? stored : []);
  } catch {
    _knownCollections = new Set();
  } finally {
    _indexLoaded = true;
  }
}

async function rememberCollections(names: string[]): Promise<void> {
  await loadIndex();
  let changed = false;
  for (const n of names) {
    if (!_knownCollections.has(n)) {
      _knownCollections.add(n);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    await capDb.kvSet(SCOPE_INDEX_KEY, [..._knownCollections]);
  } catch {
    /* index persistence is best-effort */
  }
}

async function forgetCollections(names: string[]): Promise<void> {
  await loadIndex();
  let changed = false;
  for (const n of names) {
    if (_knownCollections.delete(n)) changed = true;
  }
  if (!changed) return;
  try {
    await capDb.kvSet(SCOPE_INDEX_KEY, [..._knownCollections]);
  } catch {
    /* best-effort */
  }
}

// Stored group doc = the group + cache metadata (order + when cached).
interface CachedGroupDoc extends WfNewContentGroup {
  _order: number;
  _cachedAt: number;
}
// Stored words doc = one per group: { id: groupId, words, cachedAt }.
interface CachedWordsDoc {
  id: string;
  words: Word[];
  cachedAt: number;
}

let _ready: Promise<void> | null = null;

/** Open the shared CapDatabase once (idempotent). Resolves even if open fails so
 *  callers degrade to the network instead of hanging. */
async function ensureOpen(): Promise<void> {
  if (!_ready) {
    _ready = capDb.open().then(() => undefined).catch(() => undefined);
  }
  return _ready;
}

// --------------------------------------------------------------------------- //
// Content GROUPS (per kind)                                                   //
// --------------------------------------------------------------------------- //

/** Cached groups for a kind in the CURRENT scope, in their stored order. Stale
 *  records (older than CACHE_TTL_MS) are ignored so the caller refetches. Empty
 *  array on miss/error. */
export async function getCachedGroups(kind: WfNewCachedKind): Promise<WfNewContentGroup[]> {
  try {
    await ensureOpen();
    const docs = (await capDb.collection(GROUP_COLLECTION(kind)).all()) as unknown as CachedGroupDoc[];
    const groups = docs
      .filter((d) => isFresh(d._cachedAt))
      .slice()
      .sort((a, b) => (a._order ?? 0) - (b._order ?? 0))
      .map(stripGroupMeta);
    // Defense-in-depth: a cache populated by a prior version (or a write that
    // slipped through) may hold dups — collapse them on read so they never reach
    // the UI. Stable, first-seen order (matches the stored `_order`).
    return dedupGroups(groups);
  } catch {
    return [];
  }
}

/** The set of group ids already cached (and still FRESH) for a kind in the
 *  current scope — for "fetch only the missing". */
export async function getCachedGroupIds(kind: WfNewCachedKind): Promise<Set<string>> {
  const groups = await getCachedGroups(kind);
  return new Set(groups.map((g) => g.id));
}

// Per-collection write serialization: putCachedGroups reads (max _order) THEN
// writes (bulkPut) — two awaited steps with no DB transaction. Chaining writes to
// the same collection prevents two concurrent calls from reading the same base and
// colliding `_order` (CapDatabase has no cross-call transaction on web/IndexedDB).
const _writeChain = new Map<string, Promise<void>>();

/** Upsert groups for a kind in the CURRENT scope. `replace=true` first clears the
 *  kind (full refresh); otherwise it MERGES (new ids added, existing ids
 *  refreshed) — the fragment path. `startOrder` lets a "load more" append after
 *  the already-cached items. */
export async function putCachedGroups(
  kind: WfNewCachedKind,
  groups: WfNewContentGroup[],
  opts: { replace?: boolean; startOrder?: number } = {},
): Promise<void> {
  // Belt-and-suspenders auth-leak guard: a logged-in-but-identityless session
  // (scope userId resolved to the empty/'guest' bucket) must NOT persist
  // AUTH-scoped private data into the SHARED guest bucket. Public kinds
  // (book/subtitle/library) still cache normally. No-op early so the caller is
  // unaffected (a cache write is best-effort anyway).
  if (isAuthKind(kind) && _userId === GUEST) return;
  const colName = GROUP_COLLECTION(kind);
  const prev = _writeChain.get(colName) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(async () => {
    try {
      await ensureOpen();
      // Await the scope-index flush INSIDE the serialized write chain so this
      // write does not resolve until the collection name is durably indexed —
      // a clearAllContentCaches fired right after can then never miss it.
      // Graceful: rememberCollections swallows its own persistence failure.
      await rememberCollections([colName]);
      const col = capDb.collection(colName);
      if (opts.replace) await col.clear();
      // Self-dedup the incoming batch FIRST (id + secondary key) so a single
      // write can never store the same group twice — bulkPut already collapses
      // by id, but this also drops same name+language rows with different ids.
      let incoming = dedupGroups(groups);
      // Order base = the next free slot. Derive from the MAX existing `_order`
      // (+1), NOT count(), so a merge/append stays correctly ordered even if a
      // prior write left gaps or upserted an existing id.
      let base = opts.startOrder;
      if (base == null) {
        if (opts.replace) {
          base = 0;
        } else {
          const existing = (await col.all()) as unknown as CachedGroupDoc[];
          base = existing.reduce((m, d) => Math.max(m, (d._order ?? -1) + 1), 0);
          // Merge path: drop incoming groups whose id OR logical (kind|title|
          // language) key already exists in the cache, so a re-add can't create a
          // second doc for an already-cached library. (Replace clears first, so it
          // only needs the self-dedup above.)
          const existIds = new Set<string>();
          const existLogical = new Set<string>();
          for (const d of existing) {
            existIds.add(`${d.id}`);
            existLogical.add(`${d.kind}|${d.title}|${d.language ?? ''}`);
          }
          incoming = incoming.filter(
            (g) => !existIds.has(`${g.id}`) && !existLogical.has(`${g.kind}|${g.title}|${g.language ?? ''}`),
          );
        }
      }
      const ts = Date.now();
      const items = incoming.map((g, i) => ({
        id: g.id,
        doc: { ...g, _order: (base as number) + i, _cachedAt: ts } as unknown as CapDocLike,
      }));
      if (items.length) await col.bulkPut(items);
    } catch {
      /* cache write is best-effort */
    }
  });
  _writeChain.set(colName, run);
  return run;
}

/** Count of ALL cached group docs for a kind in the current scope (stale
 *  included — used for stats). */
export async function countCachedGroups(kind: WfNewCachedKind): Promise<number> {
  try {
    await ensureOpen();
    return await capDb.collection(GROUP_COLLECTION(kind)).count();
  } catch {
    return 0;
  }
}

function stripGroupMeta(doc: CachedGroupDoc): WfNewContentGroup {
  const { _order, _cachedAt, ...group } = doc;
  void _order; void _cachedAt;
  return group as WfNewContentGroup;
}

// --------------------------------------------------------------------------- //
// WORDS (per word-group — large; full local cache, AUTH-scoped)               //
// --------------------------------------------------------------------------- //

/** Cached words for a group in the current scope, or null on a miss / stale
 *  record (so the caller fetches). */
export async function getCachedWords(groupId: string): Promise<Word[] | null> {
  if (!groupId) return null;
  try {
    await ensureOpen();
    const doc = (await capDb.collection(WORDS_COLLECTION()).get(groupId)) as unknown as CachedWordsDoc | null;
    if (!doc || !Array.isArray(doc.words)) return null;
    if (!isFresh(doc.cachedAt)) return null;
    return doc.words;
  } catch {
    return null;
  }
}

/** Cache the full word list for a group (current scope), then evict so the
 *  collection stays bounded. */
export async function putCachedWords(groupId: string, words: Word[]): Promise<void> {
  if (!groupId) return;
  // Words are ALWAYS auth-scoped private vocabulary — never persist them into
  // the shared guest bucket for a logged-in-but-identityless session (see the
  // matching guard in putCachedGroups).
  if (_userId === GUEST) return;
  const colName = WORDS_COLLECTION();
  const prev = _writeChain.get(colName) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(async () => {
    try {
      await ensureOpen();
      // Await the index flush inside the write chain (durable before resolve)
      // — same rationale as putCachedGroups.
      await rememberCollections([colName]);
      const doc: CachedWordsDoc = { id: groupId, words: words || [], cachedAt: Date.now() };
      await capDb.collection(colName).put(groupId, doc as unknown as CapDocLike);
      await evictWords(colName);
    } catch {
      /* best-effort */
    }
  });
  _writeChain.set(colName, run);
  return run;
}

/** Keep only the newest WORDS_MAX_GROUPS docs (by cachedAt) in a words
 *  collection; delete the rest. Best-effort, never throws. */
async function evictWords(colName: string): Promise<void> {
  try {
    const col = capDb.collection(colName);
    const docs = (await col.all()) as unknown as CachedWordsDoc[];
    if (docs.length <= WORDS_MAX_GROUPS) return;
    const victims = docs
      .slice()
      .sort((a, b) => (b.cachedAt ?? 0) - (a.cachedAt ?? 0))
      .slice(WORDS_MAX_GROUPS);
    for (const v of victims) {
      if (v && v.id) await col.delete(v.id);
    }
  } catch {
    /* eviction is best-effort */
  }
}

// --------------------------------------------------------------------------- //
// Stats + clear (consumed by WfNewCacheRegistry / the settings UI)            //
// --------------------------------------------------------------------------- //

export interface WfNewContentCacheStats {
  backend: string | null;     // 'sqlite' | 'indexeddb' | null
  groups: Record<WfNewCachedKind, number>;
  wordGroups: number;         // how many groups have cached words
  totalWords: number;
}

export async function contentCacheStats(): Promise<WfNewContentCacheStats> {
  const stats: WfNewContentCacheStats = {
    backend: null,
    groups: { word: 0, book: 0, subtitle: 0, library: 0 },
    wordGroups: 0, totalWords: 0,
  };
  try {
    await ensureOpen();
    for (const k of ALL_KINDS) stats.groups[k] = await countCachedGroups(k);
    const wordDocs = (await capDb.collection(WORDS_COLLECTION()).all()) as unknown as CachedWordsDoc[];
    stats.wordGroups = wordDocs.length;
    stats.totalWords = wordDocs.reduce((n, d) => n + (Array.isArray(d.words) ? d.words.length : 0), 0);
    stats.backend = (capDb as unknown as { backendKind?: string }).backendKind ?? null;
  } catch {
    /* return what we have */
  }
  return stats;
}

/** Clear a specific list of collections; returns the ones successfully cleared.
 *  Also drops them from the persisted scope index. Never throws.
 *
 *  Each clear is routed through the SAME per-collection `_writeChain` the writers
 *  use, so it (a) awaits any in-flight / queued write for that collection before
 *  clearing and (b) makes any later write queue AFTER the clear. Without this, a
 *  put still pending in the chain could resolve after the clear and re-populate a
 *  just-cleared (auth-scoped) collection — the residual flagged by review. */
async function clearCollections(names: string[]): Promise<string[]> {
  const cleared: string[] = [];
  for (const name of names) {
    const prev = _writeChain.get(name) ?? Promise.resolve();
    let ok = false;
    // Body is fully try/catch-guarded so `run` never rejects (matches the
    // writers); the next chained op's `.catch` covers it regardless.
    const run = prev.catch(() => {}).then(async () => {
      try {
        await ensureOpen();
        await capDb.collection(name).clear();
        ok = true;
      } catch {
        /* skip one — db unavailable or collection missing */
      }
    });
    _writeChain.set(name, run);
    await run;
    if (ok) cleared.push(name);
  }
  if (cleared.length) await forgetCollections(cleared);
  return cleared;
}

/** Clear the CURRENT scope's content + word cache collections. Returns the
 *  collections cleared. */
export async function clearContentCache(): Promise<string[]> {
  return clearCollections(currentScopeCollections());
}

/**
 * Delete a SPECIFIC user's AUTH-scoped collections (word groups + per-word
 * lists) for an endpoint — called on logout so the departing user's private
 * vocabulary is removed for real (not left for the next user on the device).
 * PUBLIC content (book/subtitle/library) is intentionally left intact.
 */
export async function clearAuthScopedCache(endpointId: string, userId: string): Promise<string[]> {
  const ep = sanitizeScope(endpointId || DEFAULT_ENDPOINT);
  const uid = sanitizeScope(userId || GUEST);
  const names = [
    ...ALL_KINDS.filter(isAuthKind).map((k) => groupCollectionFor(k, ep, uid)),
    wordsCollectionFor(ep, uid),
  ];
  return clearCollections(names);
}

/**
 * Clear EVERY scope's content + word collections (Settings "Clear all cache").
 * Uses the persisted scope index so collections from other endpoints/users
 * (and prior sessions) are wiped too. Does NOT touch auth/login/endpoint stores.
 */
export async function clearAllContentCaches(): Promise<string[]> {
  await ensureOpen();
  await loadIndex();
  // Union of the persisted index + the current scope (in case the current scope
  // hasn't been written/indexed yet).
  const names = new Set<string>([..._knownCollections, ...currentScopeCollections()]);
  return clearCollections([...names]);
}

/** Stable collection-name prefixes for the per-ITEM cache clear (the cache
 *  manager). Each matches that kind's collections across ALL scopes. */
export const CONTENT_PREFIX = {
  book: 'wfnew_content_book__',
  subtitle: 'wfnew_content_subtitle__',
  library: 'wfnew_content_library__',
  word: 'wfnew_content_word__',
  words: 'wfnew_words__',
} as const;

/**
 * Clear ONE cache item: every collection (across ALL scopes) whose name starts
 * with `prefix` (use a CONTENT_PREFIX value). Returns the collections cleared.
 * This is what lets the cache manager wipe a single category (books / subtitles /
 * libraries / word-groups / words) without touching the others. NEVER throws.
 */
export async function clearContentByPrefix(prefix: string): Promise<string[]> {
  await ensureOpen();
  await loadIndex();
  const names = new Set<string>([..._knownCollections, ...currentScopeCollections()]);
  return clearCollections([...names].filter((n) => n.startsWith(prefix)));
}
