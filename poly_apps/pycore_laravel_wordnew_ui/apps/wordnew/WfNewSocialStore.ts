/**
 * WfNewSocialStore — persisted /wordnew social caches (partners / posts / chat
 * histories), as a sibling subclass of the shared `PersistedStore`. Replaces the
 * raw `localStorage` keys wf_social_partners / wf_social_posts / wf_social_chats
 * with ONE consolidated key.
 *
 * Defaults are null so the WfNewSocial component keeps owning its (large) seed
 * data: it reads `get('partners') ?? INITIAL_PARTNERS`, matching the previous
 * `cached ? JSON.parse(cached) : INITIAL` behaviour exactly. Collections are
 * stored as `unknown[]` here (typed by the component on read) to avoid a
 * circular import with the component that defines those shapes.
 */
import { PersistedStore, StorageManager } from '../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from './persistence/WordNewStorageKeys';

export interface WfNewSocialCache {
  partners: unknown[] | null;
  posts: unknown[] | null;
  chats: Record<string, unknown[]> | null;
}

const makeDefaults = (): WfNewSocialCache => ({ partners: null, posts: null, chats: null });

class WfNewSocialStore extends PersistedStore<WfNewSocialCache> {
  constructor() {
    super(StorageKeys.WORDNEW_SOCIAL, makeDefaults);
    this.migrateLegacyKeys();
  }

  setField<K extends keyof WfNewSocialCache>(key: K, value: WfNewSocialCache[K]): void {
    this.patch({ [key]: value } as Partial<WfNewSocialCache>);
  }

  private migrateLegacyKeys(): void {
    if (StorageManager.has(StorageKeys.WORDNEW_SOCIAL)) return;
    const patch: Partial<WfNewSocialCache> = {};
    try { const v = StorageManager.getLegacyRaw('wf_social_partners'); if (v) patch.partners = JSON.parse(v); } catch { /* keep default */ }
    try { const v = StorageManager.getLegacyRaw('wf_social_posts'); if (v) patch.posts = JSON.parse(v); } catch { /* keep default */ }
    try { const v = StorageManager.getLegacyRaw('wf_social_chats'); if (v) patch.chats = JSON.parse(v); } catch { /* keep default */ }
    if (Object.keys(patch).length > 0) this.patch(patch);
    StorageManager.removeLegacyRaw(['wf_social_partners', 'wf_social_posts', 'wf_social_chats']);
  }
}

/** Global singleton — the one persisted social cache for /wordnew. */
export const wfNewSocial = new WfNewSocialStore();
