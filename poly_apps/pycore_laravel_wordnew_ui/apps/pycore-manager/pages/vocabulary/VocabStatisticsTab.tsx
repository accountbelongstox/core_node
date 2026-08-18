/**
 * Statistics tab - vocabulary summary, per-language breakdown, and the static
 * resource storage summary. Loaded directly from Laravel.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Database, Languages, BookOpen, Volume2 } from 'lucide-react';
import { laravelApi } from '@/apps/pycore-manager/api';
import { VL, VocabBanner, VocabLoading, humanInt, humanBytes, vp, toArray } from './vocabShared';

const L = {
  summary: 'Summary',
  breakdown: 'Per-language breakdown',
  storage: 'Static resources',
  lang: 'Language',
  words: 'Words',
  translations: 'Translations',
  audio: 'Audio',
  invalid: 'Invalid',
  ttsPct: 'TTS coverage',
  totalLangs: 'Languages',
  totalLibs: 'Libraries',
  totalWords: 'Words',
  audioFiles: 'Audio files',
  imageFiles: 'Image files',
  videoFiles: 'Video files',
  size: 'Size',
};

interface BreakdownRow {
  language?: string;
  words?: number;
  translations?: number;
  audio?: number;
  invalid?: number;
  [k: string]: unknown;
}

export default function VocabStatisticsTab() {
  const [summary, setSummary] = useState<{ total_languages?: number; total_libraries?: number; total_words?: number; tts_percentage?: number } | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [storage, setStorage] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      laravelApi.getVocabStatistics({}),
      laravelApi.getVocabLanguageBreakdown({}),
      laravelApi.getVocabStorageSummary(),
    ]);
    let anyOk = false;
    const s = results[0];
    if (s.status === 'fulfilled') {
      anyOk = true;
      setSummary(vp<any>(s.value)?.summary || null);
    }
    const b = results[1];
    if (b.status === 'fulfilled') {
      anyOk = true;
      setBreakdown(toArray<BreakdownRow>(vp(b.value)));
    }
    const st = results[2];
    if (st.status === 'fulfilled') {
      anyOk = true;
      setStorage(vp<any>(st.value) || null);
    }
    if (!anyOk) {
      setOffline(true);
      const r = results.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
      setError(r?.reason instanceof Error ? r.reason.message : VL.error);
    } else {
      setOffline(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <VocabLoading />;
  if (offline && !summary && !breakdown.length) return <VocabBanner kind="offline" message={VL.offline} />;

  const storageSections: Array<[string, { count?: number; size?: number }]> = storage
    ? Object.entries(storage).filter((entry): entry is [string, { count?: number; size?: number }] => {
        const value = entry[1];
        return !!value && typeof value === 'object';
      })
    : [];

  return (
    <div className="space-y-4">
      {error && <VocabBanner kind="warn" message={error} />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Languages} label={L.totalLangs} value={humanInt(summary?.total_languages)} />
        <SummaryCard icon={BookOpen} label={L.totalLibs} value={humanInt(summary?.total_libraries)} />
        <SummaryCard icon={Database} label={L.totalWords} value={humanInt(summary?.total_words)} />
        <SummaryCard icon={Volume2} label={L.ttsPct} value={summary?.tts_percentage != null ? `${summary.tts_percentage}%` : '-'} />
      </div>

      {/* Per-language breakdown */}
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-3 py-2 bg-slate-800/60 text-sm font-medium text-slate-200">{L.breakdown}</div>
        {breakdown.length === 0 ? (
          <p className="px-3 py-6 text-center text-slate-500">{VL.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/40 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">{L.lang}</th>
                  <th className="px-3 py-2 text-right">{L.words}</th>
                  <th className="px-3 py-2 text-right">{L.translations}</th>
                  <th className="px-3 py-2 text-right">{L.audio}</th>
                  <th className="px-3 py-2 text-right">{L.invalid}</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row, i) => (
                  <tr key={row.language || i} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-100">{row.language || '-'}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{humanInt(row.words)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{humanInt(row.translations)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{humanInt(row.audio)}</td>
                    <td className="px-3 py-2 text-right text-rose-300">{humanInt(row.invalid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage summary */}
      {storageSections.length > 0 && (
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-3 py-2 bg-slate-800/60 text-sm font-medium text-slate-200">{L.storage}</div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {storageSections.map(([key, val]) => (
              <div key={key} className="rounded bg-slate-800/40 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-400">{key}</div>
                <div className="mt-1 text-sm text-slate-200">
                  {L.audioFiles}: <b>{humanInt(val.count)}</b>
                </div>
                <div className="text-sm text-slate-400">{L.size}: {humanBytes(val.size)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 flex items-center gap-3">
      <Icon className="w-5 h-5 text-sky-400" />
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-lg font-semibold text-slate-100">{value}</div>
      </div>
    </div>
  );
}
