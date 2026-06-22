/* [v4.1-Iris] Wf reading progress center — ported from
 * qy_capacitor/services/ReadingProgressCenter.ts, re-shaped for the Wf shell:
 * a simple key → {index,total,updatedAt} dictionary (key = groupId / document
 * id) persisted via WordflowStorage (READING_PROGRESS key), updates broadcast
 * via wfEventBus('reading-progress-updated'). */

import { StorageCenter, StorageKey } from '../api-libs/wordflow/WordflowStorage';
import { wfEventBus } from './WfEventBus';

export interface WfReadingProgress {
  index: number;
  total: number;
  updatedAt: string;
}

type WfReadingProgressMap = Record<string, WfReadingProgress>;

class WfReadingProgressCenterClass {
  private async loadMap(): Promise<WfReadingProgressMap> {
    try {
      const stored = await StorageCenter.get<WfReadingProgressMap>(StorageKey.READING_PROGRESS, {});
      return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    } catch (error: any) {
      // Corrupt entry must not throw: degrade to an empty dictionary.
      console.warn('[WfReadingProgressCenter] Load failed (handled, empty):', error?.message || error);
      return {};
    }
  }

  private async saveMap(map: WfReadingProgressMap): Promise<void> {
    await StorageCenter.set(StorageKey.READING_PROGRESS, map);
  }

  /**
   * Progress for a key (groupId / document id), or null when none stored.
   */
  async get(key: string): Promise<WfReadingProgress | null> {
    const map = await this.loadMap();
    return map[key] ?? null;
  }

  /**
   * Store progress for a key and broadcast 'reading-progress-updated'.
   */
  async set(key: string, p: { index: number; total: number }): Promise<void> {
    const map = await this.loadMap();
    const progress: WfReadingProgress = {
      index: p.index,
      total: p.total,
      updatedAt: new Date().toISOString(),
    };
    map[key] = progress;
    await this.saveMap(map);
    wfEventBus.emit('reading-progress-updated', { key, ...progress });
  }

  /**
   * Clear progress for one key, or all progress when no key is given.
   */
  async clear(key?: string): Promise<void> {
    if (key === undefined) {
      await this.saveMap({});
      wfEventBus.emit('reading-progress-updated', { key: null, cleared: true });
      return;
    }
    const map = await this.loadMap();
    if (key in map) {
      delete map[key];
      await this.saveMap(map);
      wfEventBus.emit('reading-progress-updated', { key, cleared: true });
    }
  }
}

export const wfReadingProgressCenter = new WfReadingProgressCenterClass();
