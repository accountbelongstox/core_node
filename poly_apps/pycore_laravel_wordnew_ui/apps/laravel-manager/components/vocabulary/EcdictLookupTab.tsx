/**
 * Offline ECDICT tab (laravel api word query).
 *
 * Queries the shared stardict.db through the Laravel app_qy_v1 ecdict routes
 * (EcdictDictionary.php, PathMapper-resolved). The SAME database is also
 * served by pycore (/pycore-manager vocabulary → Offline Dict tab), so a lock
 * race surfaces as HTTP 503 busy=true and the shared panel retries immediately.
 */
import React from 'react';
import { api, type APIResponse } from '@/apps/laravel-manager/api';
import EcdictLookupPanel from '@/shared/vocabulary/EcdictLookupPanel';
import type { EcdictLookupAdapter } from '@/shared/vocabulary/ecdictLookupTypes';

/** HTTP 503 + busy payload means the pycore end holds the SQLite lock. */
const isBusyResponse = (r: APIResponse): boolean =>
  r?.status === 503 || (r?.debugInfo as any)?.data?.busy === true;

const adapter: EcdictLookupAdapter = {
  sourceLabel: 'laravel api',
  fetchStatus: async () => {
    const r = await api.appQyV1.getEcdictStatus();
    if (!r.success) {
      return {
        available: false,
        entries: 0,
        busy: isBusyResponse(r),
        error: r.error || undefined,
      };
    }
    const d = (r.data || {}) as any;
    return {
      available: !!d.ecdict?.available,
      dbPath: d.ecdict?.db_path,
      entries: Number(d.ecdict?.entries || 0),
      wordnetAvailable: !!d.wordnet?.available,
      busy: !!d.busy,
      error: d.error,
    };
  },
  fetchLookup: async (word, target = 'zh') => {
    const r = await api.appQyV1.lookupEcdict(word, target);
    if (!r.success) {
      return {
        found: false,
        word,
        translation: '',
        definition: '',
        phonetic: '',
        pos: '',
        tags: [],
        collins: 0,
        oxford: false,
        bnc: 0,
        frq: 0,
        exchange: '',
        busy: isBusyResponse(r),
        error: r.error || undefined,
      };
    }
    const e = (r.data || {}) as any;
    return {
      found: !!e.found,
      word: e.word || word,
      translation: e.translation || '',
      definition: e.definition || '',
      phonetic: e.phonetic || '',
      pos: e.pos || '',
      tags: Array.isArray(e.tags) ? e.tags : [],
      collins: Number(e.collins || 0),
      oxford: !!e.oxford,
      bnc: Number(e.bnc || 0),
      frq: Number(e.frq || 0),
      exchange: e.exchange || '',
      targetTranslation: e.target_translation ?? null,
      source: e.source,
      busy: !!e.busy,
      error: e.error,
    };
  },
};

const EcdictLookupTab: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-white/5">
    <EcdictLookupPanel adapter={adapter} />
  </div>
);

export default EcdictLookupTab;
