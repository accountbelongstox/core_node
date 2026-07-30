import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * Daily short-sentence center — pycore-assisted prompt translations (English +
 * 3 variants + audio) for the wordnew daily-reading view.
 * Mounted with prefix '/api/app_qy_v1/daily-sentences' in core/api/index.ts.
 */

export interface DailySentence {
  id: string;
  english: string;
  original: string;
  source_lang: string;
  variants: string[];
  audio?: { url?: string; language?: string } | null;
  created_at: string;
}

export class DailySentenceAPI extends BaseAPI {
  /** Newest-first list of daily sentences (history). */
  async list(params?: { page?: number; pageSize?: number; limit?: number; offset?: number }):
    Promise<APIResponse<{ items: DailySentence[]; total: number }>> {
    return this.get('/list', params);
  }

  /** Today's recommended sentence (stable within a day). */
  async recommend(): Promise<APIResponse<{ item: DailySentence | null }>> {
    return this.get('/recommend');
  }
}
