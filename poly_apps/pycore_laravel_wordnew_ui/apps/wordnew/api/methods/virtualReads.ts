import type { WfNewVirtualReadBatch, WfNewVirtualReadBatchList } from '../types/learning';
import { WfNewApiPaths } from '../WfNewApiPaths';
import { authedGetFreshJSON, authedPostJSON, deleteJSON, requireAuthToken } from '../WfNewApiTransport';

const DEFAULT_MAX_BATCHES = 20;

function toBatch(raw: any): WfNewVirtualReadBatch {
  return {
    name: String(raw?.name ?? ''),
    languages: Array.isArray(raw?.languages) ? raw.languages.map(String) : [],
    words: Number(raw?.words) || 0,
    reads: Number(raw?.reads) || 0,
    lastUsedAt: typeof raw?.last_used_at === 'string' ? raw.last_used_at : null,
    referenced: raw?.referenced === true,
  };
}

export const virtualReadMethods = {
  async getVirtualReadBatches(): Promise<WfNewVirtualReadBatchList> {
    const res = await authedGetFreshJSON<any>(WfNewApiPaths.virtualBatches, null);
    return {
      items: (Array.isArray(res?.items) ? res.items : []).map(toBatch).filter((batch: WfNewVirtualReadBatch) => batch.name),
      max: Number(res?.max) || DEFAULT_MAX_BATCHES,
    };
  },

  /** Record one read of each played word; `requestKey` makes a retry a no-op. */
  async recordVirtualReads(name: string, language: string, wordIds: number[], requestKey: string): Promise<number> {
    const res = await authedPostJSON<any>(WfNewApiPaths.virtualBatchReads(name), {
      language,
      word_ids: wordIds,
      request_key: requestKey,
    });
    return Number(res?.data?.recorded_word_count ?? res?.recorded_word_count) || 0;
  },

  async deleteVirtualReadBatch(name: string): Promise<void> {
    requireAuthToken();
    await deleteJSON(WfNewApiPaths.virtualBatch(name));
  },
};

export const mockVirtualReadMethods = {
  async getVirtualReadBatches(): Promise<WfNewVirtualReadBatchList> {
    return { items: [], max: DEFAULT_MAX_BATCHES };
  },
  async recordVirtualReads(_name: string, _language: string, _wordIds: number[], _requestKey: string): Promise<number> {
    return 0;
  },
  async deleteVirtualReadBatch(_name: string): Promise<void> {},
};
