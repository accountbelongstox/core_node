/**
 * Offline ECDICT tab (pycore local word query).
 *
 * Queries the shared stardict.db through the pycore ui/dictionary/* routes
 * (pycoreApi.getDictionaryStatus / getDictionaryLookup). The SAME database is
 * also served by Laravel (/laravel-manager vocabulary → Offline Dict tab), so
 * a lock race surfaces as busy=true and the shared panel retries immediately.
 */
import React from 'react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { DictionaryEntry, DictionaryMatchResponse, DictionaryStatus } from '@/apps/pycore-manager/api';
import EcdictLookupPanel from '@/shared/vocabulary/EcdictLookupPanel';
import type { EcdictLookupAdapter } from '@/shared/vocabulary/ecdictLookupTypes';

const adapter: EcdictLookupAdapter = {
  sourceLabel: 'pycore local',
  fetchStatus: async () => {
    const s = await pycoreApi.getDictionaryStatus() as DictionaryStatus;
    return {
      available: !!s?.ecdict?.available,
      dbPath: s?.ecdict?.db_path,
      entries: Number(s?.ecdict?.entries || 0),
      wordnetAvailable: !!s?.wordnet?.available,
      busy: !!s?.busy,
      error: s?.error,
    };
  },
  fetchLookup: async (word, target = 'zh') => {
    const e = await pycoreApi.getDictionaryLookup(word, target) as DictionaryEntry;
    return {
      found: !!e?.found,
      word: e?.word || word,
      translation: e?.translation || '',
      definition: e?.definition || '',
      phonetic: e?.phonetic || '',
      pos: e?.pos || '',
      tags: Array.isArray(e?.tags) ? e.tags : [],
      collins: Number(e?.collins || 0),
      oxford: !!e?.oxford,
      bnc: Number(e?.bnc || 0),
      frq: Number(e?.frq || 0),
      exchange: e?.exchange || '',
      wordnetDefinition: e?.wordnet_definition || '',
      synonyms: Array.isArray(e?.synonyms) ? e.synonyms : [],
      targetTranslation: e?.target_translation ?? null,
      source: e?.source,
      busy: !!e?.busy,
      error: e?.error,
    };
  },
  fetchMatch: async (prefix) => {
    const r = await pycoreApi.getDictionaryMatch(prefix, 20) as DictionaryMatchResponse;
    if (!Array.isArray(r?.items)) return [];
    return r.items.map((i) => ({ word: i.word, translation: i.translation }));
  },
};

export default function VocabOfflineDictTab() {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40">
      <EcdictLookupPanel adapter={adapter} />
    </div>
  );
}
