/* [v4.1-Iris] Wf library center — vocabulary library + public-content ops for
 * the Wf shell, mirroring qy_capacitor/services/VocabularyLibraryManager.ts at
 * the shell's altitude: data comes from wordflowApi (which owns the TTL caches —
 * recommendations 30 min, selected collections 5 min in WordflowStorage; public
 * books/subtitles ~10 min in-memory; all degrading to empty when the backend is
 * unreachable); this layer only adds force-refresh (cache invalidation),
 * select/deselect with a 'library-selection-changed' broadcast, and group
 * media-source mutations with a 'group-sources-changed' broadcast via
 * wfEventBus. */

import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type {
  VocabularyRecommendation,
  WfPublicLibrary,
  WfBookListResult,
  WfSubtitleListResult,
  WfAddMediaSourceResult,
  WfGroupSourcesResult,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { StorageCenter, StorageKey } from '../../../core/api-libs/wordflow/WordflowStorage';
import { wfEventBus } from './WfEventBus';

class WfLibraryCenterClass {
  /**
   * Recommended vocabulary libraries (GET /learning/recommendations with the
   * /vocabulary/libraries/recommended fallback; TTL-cached by wordflowApi,
   * degrades to []). Pass force=true to drop the cache and re-fetch.
   */
  async getRecommendations(force?: boolean): Promise<VocabularyRecommendation[]> {
    if (force) {
      await StorageCenter.cache.invalidate(StorageKey.RECOMMENDED_LIBRARIES_CACHE);
    }
    return wordflowApi.getRecommendedLibraries();
  }

  /**
   * The user's selected collections (TTL-cached by wordflowApi, degrades
   * to []). Pass force=true to drop the cache and re-fetch.
   */
  async getSelectedCollections(force?: boolean): Promise<any[]> {
    if (force) {
      await StorageCenter.cache.invalidate(StorageKey.SELECTED_COLLECTIONS_CACHE);
    }
    return wordflowApi.getSelectedCollections();
  }

  /**
   * Whether a collection/library id is currently in the selected set
   * (tolerates id / collection_id / library_id item shapes).
   */
  async isSelected(collectionId: number | string): Promise<boolean> {
    const selected = await this.getSelectedCollections();
    const target = String(collectionId);
    return (
      Array.isArray(selected) &&
      selected.some((it: any) => {
        const id = it?.collection_id ?? it?.library_id ?? it?.id;
        return id !== undefined && id !== null && String(id) === target;
      })
    );
  }

  /**
   * Select/deselect a collection (POST /learning/collections/select — the API
   * layer invalidates the selected-collections cache) and broadcast
   * 'library-selection-changed' so subscribers re-fetch. Also drops the
   * recommendations cache: items carry an is_selected flag that just changed.
   */
  async selectCollection(collectionId: number | string, selected: boolean = true): Promise<any> {
    const result = await wordflowApi.selectCollection({ collection_id: collectionId, selected });
    await StorageCenter.cache.invalidate(StorageKey.RECOMMENDED_LIBRARIES_CACHE);
    wfEventBus.emit('library-selection-changed', { collectionId, selected });
    return result;
  }

  // ---- Public content (vocabulary libraries / books / subtitles) ----

  /**
   * PUBLIC vocabulary libraries — the REAL library rows whose ids work with
   * /group/add_library (GET /vocabulary/libraries/recommended with the
   * /vocabulary/libraries fallback; anonymous-safe, ~10 min in-memory cache in
   * wordflowApi, degrades to []). `language` accepts the 2-char UI code (the
   * API layer maps it to the backend's full name). Pass force=true to drop the
   * public-content cache and re-fetch.
   */
  async getPublicLibraries(language?: string, force?: boolean): Promise<WfPublicLibrary[]> {
    if (force) wordflowApi.invalidatePublicMediaCache();
    return wordflowApi.getPublicVocabularyLibraries(language);
  }

  /**
   * Public synced books (PUBLIC GET /media/books, MediaBrowseController
   * paginator: page/per_page; ~10 min in-memory cache in wordflowApi, degrades
   * to an empty page). Pass force=true to drop the public-content cache and
   * re-fetch.
   */
  async getBooks(
    params: { language?: string; search?: string; page?: number; perPage?: number } = {},
    force?: boolean
  ): Promise<WfBookListResult> {
    if (force) wordflowApi.invalidatePublicMediaCache();
    return wordflowApi.getPublicBooks(params);
  }

  /**
   * Public synced subtitles (PUBLIC GET /media/subtitles; same paginator and
   * caching/degrade behavior as getBooks()). Pass force=true to drop the cache
   * and re-fetch.
   */
  async getSubtitles(
    params: { language?: string; search?: string; page?: number; perPage?: number } = {},
    force?: boolean
  ): Promise<WfSubtitleListResult> {
    if (force) wordflowApi.invalidatePublicMediaCache();
    return wordflowApi.getPublicSubtitles(params);
  }

  // ---- Group media sources ----

  /**
   * Attach a public book/subtitle to a group (AUTH; the API layer invalidates
   * the word-groups cache) and broadcast 'group-sources-changed' so group
   * views re-fetch. Returns { gid, source_type, source_key, words_added,
   * total_words }.
   */
  async addMediaSource(
    gid: string,
    sourceType: 'book' | 'subtitle',
    sourceKey: string
  ): Promise<WfAddMediaSourceResult> {
    const result = await wordflowApi.addMediaSourceToGroup(gid, sourceType, sourceKey);
    wfEventBus.emit('group-sources-changed', { gid, sourceType, sourceKey, action: 'add' });
    return result;
  }

  /**
   * Detach a book/subtitle from a group (AUTH; word-groups cache invalidated
   * by the API layer) and broadcast 'group-sources-changed'.
   */
  async removeMediaSource(
    gid: string,
    sourceType: 'book' | 'subtitle',
    sourceKey: string
  ): Promise<any> {
    const result = await wordflowApi.removeMediaSourceFromGroup(gid, sourceType, sourceKey);
    wfEventBus.emit('group-sources-changed', { gid, sourceType, sourceKey, action: 'remove' });
    return result;
  }

  /**
   * Every content source linked to a group (AUTH POST /group/get_sources):
   * { libraries, media_sources }. Not cached — group views should reflect
   * mutations immediately (subscribe to 'group-sources-changed').
   */
  async getSources(gid: string): Promise<WfGroupSourcesResult> {
    return wordflowApi.getGroupSources(gid);
  }

  /**
   * Drop the library-related caches and broadcast so subscribers re-fetch.
   */
  async refresh(): Promise<void> {
    wordflowApi.invalidatePublicMediaCache();
    await Promise.all([
      StorageCenter.cache.invalidate(StorageKey.RECOMMENDED_LIBRARIES_CACHE),
      StorageCenter.cache.invalidate(StorageKey.SELECTED_COLLECTIONS_CACHE),
    ]);
    wfEventBus.emit('library-selection-changed');
  }

  /**
   * Subscribe to 'library-selection-changed'. Returns an unsubscribe function.
   */
  subscribe(cb: () => void): () => void {
    return wfEventBus.on('library-selection-changed', () => cb());
  }

  /**
   * Subscribe to 'group-sources-changed' (media source / library added or
   * removed on any group). Returns an unsubscribe function.
   */
  subscribeGroupSources(
    cb: (payload?: { gid: string; sourceType?: string; sourceKey?: string; action?: string }) => void
  ): () => void {
    return wfEventBus.on('group-sources-changed', (payload) => cb(payload));
  }
}

export const wfLibraryCenter = new WfLibraryCenterClass();
