import { StorageManager } from '../persistence';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../contracts/QueueCenterContract';


const STORAGE_KEY = 'queue_center_diff_context';

export type DiffPage = {
  /** Local sequential page key (server pages are positional chunks, not stable IDs). */
  page: number;
  ids: string[];
  state: 'head' | 'ready' | 'consumed';
  consumedIds?: string[];
  updatedAt: number;
};

export type DiffScope = {
  /** Realtime broadcast revision the page table aligns on (queue.changed). */
  revision: number;
  /** High-water global_tasks.id cursor (numeric PK; 0 = full realign). */
  cursor: number;
  headIds: string[];
  pages: DiffPage[];
  updatedAt: number;
};

/** Server delta applied by align(): new ID pages plus the alignment markers. */
export type DiffAlignUpdate = {
  revision: number;
  cursor: number;
  headIds: string[];
  pages: Array<{ ids: string[] }>;
};

type DiffState = Record<string, DiffScope>;

class DiffQueueContext {
  /** Restore a scope directly from the local store (no network, no cold pull). */
  snapshot(scope: string): DiffScope | null {
    const state = StorageManager.get<DiffState>(STORAGE_KEY, {});
    return state[scope] ? this.scopeOf(state, scope) : null;
  }

  /**
   * Incremental alignment on the server cursor/revision model: appends only
   * server pages with IDs not already known, adopts the high-water cursor,
   * the realtime revision, and the moved-to-head IDs. Never performs
   * a cold full pull — callers pass the server delta pages only. Fully
   * consumed pages are compacted out and the table stays bounded by the
   * contract id_page_limit.
   */
  align(scope: string, update: DiffAlignUpdate): void {
    const state = StorageManager.get<DiffState>(STORAGE_KEY, {});
    const current = this.scopeOf(state, scope);
    const known = new Set(current.pages.flatMap((page) => page.ids));
    let nextPage = current.pages.reduce((max, page) => Math.max(max, page.page), 0) + 1;
    const appended: DiffPage[] = [];
    for (const page of update.pages) {
      const ids = this.normalize(page.ids.filter((id) => !known.has(id)));
      if (ids.length === 0) continue;
      ids.forEach((id) => known.add(id));
      appended.push({ page: nextPage++, ids, state: 'ready', updatedAt: Date.now() });
    }
    const pages = [...current.pages, ...appended]
      .filter((page) => page.state !== 'consumed')
      .slice(0, QUEUE_CENTER_DIFF_DELIVERY.id_page_limit);
    state[scope] = {
      revision: Math.max(current.revision, update.revision),
      cursor: Math.max(current.cursor, update.cursor),
      headIds: this.normalize(update.headIds),
      pages,
      updatedAt: Date.now(),
    };
    StorageManager.set(STORAGE_KEY, state);
  }

  /** Locally promote IDs to the head (queue.changed seam / manual bump). */
  touch(scope: string, ids: string[]): void {
    const normalized = this.normalize(ids);
    if (normalized.length === 0) return;
    const state = StorageManager.get<DiffState>(STORAGE_KEY, {});
    const current = this.scopeOf(state, scope);
    const nextPage = current.pages.reduce((max, page) => Math.max(max, page.page), 0) + 1;
    state[scope] = {
      ...current,
      headIds: this.normalize([...normalized, ...current.headIds]),
      pages: [
        { page: nextPage, ids: normalized, state: 'head' as const, updatedAt: Date.now() },
        ...current.pages,
      ].slice(0, QUEUE_CENTER_DIFF_DELIVERY.id_page_limit),
      updatedAt: Date.now(),
    };
    StorageManager.set(STORAGE_KEY, state);
  }

  consume(scope: string, ids: string[]): void {
    const normalized = new Set(this.normalize(ids));
    if (normalized.size === 0) return;
    const state = StorageManager.get<DiffState>(STORAGE_KEY, {});
    const current = state[scope] ? this.scopeOf(state, scope) : null;
    if (!current) return;
    state[scope] = {
      ...current,
      headIds: current.headIds.filter((id) => !normalized.has(id)),
      pages: current.pages.map((page) => {
        const consumedIds = this.normalize([
          ...(page.consumedIds || []),
          ...page.ids.filter((id) => normalized.has(id)),
        ]);
        return consumedIds.length === page.ids.length
          ? { ...page, consumedIds, state: 'consumed', updatedAt: Date.now() }
          : { ...page, consumedIds };
      }),
      updatedAt: Date.now(),
    };
    StorageManager.set(STORAGE_KEY, state);
  }

  /** Normalize a stored scope, tolerating the pre-cursor persisted shape. */
  private scopeOf(state: DiffState, scope: string): DiffScope {
    const raw = state[scope] as DiffScope | undefined;
    if (!raw) return { revision: 0, cursor: 0, headIds: [], pages: [], updatedAt: 0 };
    return {
      revision: Number(raw.revision ?? 0),
      cursor: Number(raw.cursor ?? 0),
      headIds: this.normalize(raw.headIds ?? []),
      pages: (raw.pages ?? []).map((page, index) => {
        const legacy = page as DiffPage & { revision?: number };
        return {
          page: Number(legacy.page ?? legacy.revision ?? index + 1),
          ids: this.normalize(legacy.ids ?? []),
          state: legacy.state === 'consumed'
            ? 'consumed'
            : legacy.state === 'head' || (legacy as { state?: string }).state === 'priority'
              ? 'head'
              : 'ready',
          consumedIds: legacy.consumedIds ? this.normalize(legacy.consumedIds) : undefined,
          updatedAt: Number(legacy.updatedAt ?? 0),
        };
      }),
      updatedAt: Number(raw.updatedAt ?? 0),
    };
  }

  private normalize(ids: string[]): string[] {
    return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
      .slice(0, QUEUE_CENTER_DIFF_DELIVERY.id_limit);
  }
}

export const diffQueueContext = new DiffQueueContext();
