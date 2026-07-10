/**
 * Task Center — sentences awaiting spoken audio (by language).
 * Lists Laravel's shared sentence library rows with has_audio=false so
 * operators can see what pycore's sentence-audio worker should assist.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Language } from '../../../types';
import { api } from '../../../core/api';
import { AudioLines, ChevronLeft, ChevronRight, Languages, RefreshCw } from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { EmptyState, InlineSpinner } from '../../common';

interface MissingSentenceAudioPanelProps {
  lang: Language;
  refreshToken: number;
}

interface MissingRow {
  content_id: string;
  text: string;
  language: string;
  tts_priority: number;
  tts_status: string;
  occurrence_count: number;
}

const LABELS: Record<Language, Record<string, string>> = {
  en: {
    title: 'Sentences awaiting audio',
    hint: 'Shared sentence library — missing spoken audio, grouped by language. Book reader bumps priority; pycore synthesizes when auto-start is on.',
    allLangs: 'All languages',
    priority: 'priority',
    status: 'status',
    occurrences: 'uses',
    empty: 'No sentences missing audio.',
    loadFailed: 'Failed to load missing sentence audio list.',
    total: 'total',
  },
  zh: {
    title: '等待语音协助的句子',
    hint: '共享句子库中尚无语音的句子，按语言列出。阅读器会提升优先级；pycore 开启自动开始后合成。',
    allLangs: '全部语言',
    priority: '优先级',
    status: '状态',
    occurrences: '引用',
    empty: '没有待生成语音的句子。',
    loadFailed: '加载待协助句子列表失败。',
    total: '共',
  },
};

const MissingSentenceAudioPanel: React.FC<MissingSentenceAudioPanelProps> = ({ lang, refreshToken }) => {
  const t = LABELS[lang] || LABELS.en;
  const [items, setItems] = useState<MissingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.appQyV1.listMissingSentenceAudio({
        language: language || undefined,
        page,
        per_page: perPage,
      });
      if (!mounted.current) return;
      if (res?.success && res.data) {
        const rows = Array.isArray(res.data.items) ? res.data.items : [];
        setItems(rows);
        setTotal(res.data.total ?? rows.length);
        setError(null);
        const langs = Array.from(new Set(rows.map((r) => r.language).filter(Boolean)));
        if (langs.length) {
          setLanguages((prev) => Array.from(new Set([...prev, ...langs])).sort());
        }
      } else {
        setError(res?.error || t.loadFailed);
      }
    } catch (e: any) {
      if (mounted.current) setError(e?.message || t.loadFailed);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [language, page, perPage, t.loadFailed]);

  useEffect(() => {
    fetchList();
  }, [fetchList, refreshToken]);

  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <section className={`${commonClasses.card} p-4 space-y-3`}>
      <div className="flex items-start gap-3 flex-wrap">
        <AudioLines className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.hint}</p>
        </div>
        <button
          type="button"
          onClick={fetchList}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Languages className="w-4 h-4 text-slate-400" />
        <select
          value={language}
          onChange={(e) => { setLanguage(e.target.value); setPage(1); }}
          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">{t.allLangs}</option>
          {languages.map((lng) => (
            <option key={lng} value={lng}>{lng}</option>
          ))}
        </select>
        <span className="text-slate-500 ml-auto">{t.total} <b>{total}</b></span>
      </div>

      {error && (
        <p className="text-xs text-rose-500">{error}</p>
      )}

      {loading && items.length === 0 ? (
        <div className="py-6 flex justify-center"><InlineSpinner /></div>
      ) : items.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-64 overflow-y-auto">
          {items.map((row) => (
            <li key={`${row.language}:${row.content_id}`} className="py-2 flex gap-2 items-start">
              <span className="shrink-0 font-mono uppercase text-[10px] text-teal-600 dark:text-teal-400 w-16 truncate" title={row.language}>
                {row.language}
              </span>
              <p className="flex-1 text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-2" title={row.text}>
                {row.text}
              </p>
              <span className="shrink-0 text-[10px] font-mono text-slate-400" title={t.priority}>
                P{row.tts_priority ?? 0}
              </span>
              <span className="shrink-0 text-[10px] text-slate-400" title={t.occurrences}>
                ×{row.occurrence_count ?? 1}
              </span>
            </li>
          ))}
        </ul>
      )}

      {total > perPage && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-500">{page} / {lastPage}</span>
          <button
            type="button"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => p + 1)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
};

export default MissingSentenceAudioPanel;
