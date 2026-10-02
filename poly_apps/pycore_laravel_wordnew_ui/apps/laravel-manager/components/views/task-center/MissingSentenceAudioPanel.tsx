/**
 * Task Center — sentences awaiting spoken audio (by language).
 * Lists Laravel's canonical sentence-audio queue rows so
 * operators can see what pycore's persistent sentence-audio worker should
 * assist. UI controls must not start a browser-owned queue pump; see
 * `_prompts/队列中心.txt`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { api } from '@/apps/laravel-manager/api';
import { pycoreApi } from '@/apps/laravel-manager/integrations/pycore';
import type { SentenceAudioAutoStatus } from '@/apps/laravel-manager/integrations/pycore';
import type { MissingSentenceAudioPage, MissingSentenceAudioRow } from '@/apps/laravel-manager/api/modules/AppQyV1';
import { useKeysetPages, type KeysetPage } from '@/core/integrations/pycore/useKeysetPages';
import { AudioLines, ChevronLeft, ChevronRight, Languages, RefreshCw, Power, Check, ExternalLink } from 'lucide-react';
import { commonClasses } from '@/shared/styles/theme';
import { EmptyState, InlineSpinner } from '../../common';

interface MissingSentenceAudioPanelProps {
  lang: Language;
  refreshToken: number;
}

type MissingPage = KeysetPage<MissingSentenceAudioRow> & Omit<MissingSentenceAudioPage, 'items' | 'next_cursor'>;

const LABELS: Record<Language, Record<string, string>> = {
  en: {
    title: 'Sentences awaiting audio',
    hint: 'Shared sentence library — missing spoken audio, grouped by language. Book reader moves visible work to the queue head; pycore synthesizes when auto-start is on.',
    position: 'queue position',
    status: 'status',
    occurrences: 'uses',
    empty: 'No sentences missing audio.',
    loadFailed: 'Failed to load missing sentence audio list.',
    total: 'total',
    pycoreWorker: 'pycore sentence worker',
    pycoreOn: 'auto-start ON',
    pycoreOff: 'auto-start OFF',
    pycorePending: 'Laravel pending',
    openQueue: 'Open Queue Center',
    pycoreUnreachable: 'pycore offline — start pyservice.ps1 to enable auto synthesis',
  },
  zh: {
    title: '等待语音协助的句子',
    hint: '共享句子库中尚无语音的句子，按语言列出。阅读器会将可见任务移到队首；pycore 开启自动开始后合成。',
    position: '队列位置',
    status: '状态',
    occurrences: '引用',
    empty: '没有待生成语音的句子。',
    loadFailed: '加载待协助句子列表失败。',
    total: '共',
    pycoreWorker: 'pycore 句子 worker',
    pycoreOn: '自动开始 开',
    pycoreOff: '自动开始 关',
    pycorePending: 'Laravel 待处理',
    openQueue: '打开队列中心',
    pycoreUnreachable: 'pycore 离线 — 请启动 pyservice.ps1 以启用自动合成',
  },
};

const PAGE_SIZE = 20;

const MissingSentenceAudioPanel: React.FC<MissingSentenceAudioPanelProps> = ({ lang, refreshToken }) => {
  const t = LABELS[lang] || LABELS.en;
  const [language, setLanguage] = useState('');
  const [pcAudio, setPcAudio] = useState<SentenceAudioAutoStatus | null>(null);
  const [pcBusy, setPcBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchPage = useCallback(async (cursor: string | null): Promise<MissingPage> => {
    const res = await api.appQyV1.listMissingSentenceAudio({
      language: language || undefined,
      cursor_id: cursor === null ? 0 : Number(cursor),
      per_page: PAGE_SIZE,
    });
    if (!res?.success || !res.data) throw new Error(res?.error || t.loadFailed);
    return { ...res.data, next_cursor: res.data.next_cursor == null ? null : String(res.data.next_cursor) };
  }, [language, t.loadFailed]);
  const pages = useKeysetPages<MissingSentenceAudioRow, MissingPage>(fetchPage, true, refreshToken);
  const { page: data, items, loading, reload: fetchList } = pages;
  const error = pages.error ? (pages.error instanceof Error ? pages.error.message : t.loadFailed) : null;
  const total = data?.total ?? 0;
  const languages = useMemo(() => Object.entries(data?.summary?.languages ?? {}).sort((a, b) => b[1] - a[1]), [data]);

  const fetchPcStatus = useCallback(async () => {
    try {
      const s = await pycoreApi.getSentenceAudioAutoStatus();
      if (mounted.current) setPcAudio(s);
    } catch {
      if (mounted.current) setPcAudio(null);
    }
  }, []);

  useEffect(() => {
    fetchPcStatus();
  }, [fetchPcStatus, refreshToken]);

  const togglePcAuto = async () => {
    if (pcBusy || !pcAudio) return;
    setPcBusy(true);
    try {
      const s = await pycoreApi.setSentenceAudioConfig({ auto_start: !pcAudio.auto_start });
      if (mounted.current) setPcAudio(s);
    } finally {
      if (mounted.current) setPcBusy(false);
    }
  };

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

      <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-teal-200/60 dark:border-teal-800/60 bg-teal-500/5 p-2">
        <span className="font-semibold text-teal-700 dark:text-teal-300">{t.pycoreWorker}</span>
        {pcAudio ? (
          <>
            <span className="font-mono text-slate-500">
              {t.pycorePending}: <b>{pcAudio.laravel?.pending ?? 0}</b>
              {' · '}leased: <b>{pcAudio.laravel?.leased ?? 0}</b>
            </span>
            <button
              type="button"
              disabled={pcBusy}
              onClick={togglePcAuto}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition disabled:opacity-50 ${
                pcAudio.auto_start
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : 'bg-slate-500/10 text-slate-500'
              }`}>
              {pcAudio.auto_start ? <Check className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              {pcAudio.auto_start ? t.pycoreOn : t.pycoreOff}
            </button>
            <a
              href="/pycore-manager/queue-center"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-teal-600 hover:underline ml-auto">
              <ExternalLink className="w-3 h-3" /> {t.openQueue}
            </a>
          </>
        ) : (
          <span className="text-slate-500">{t.pycoreUnreachable}</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Languages className="w-4 h-4 text-slate-400" />
        <select
          value={language || data?.language || ''}
          onChange={(e) => setLanguage(e.target.value)}
          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {languages.map(([code, gap]) => (
            <option key={code} value={code}>{code} ({gap})</option>
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
              <span className="shrink-0 text-[10px] font-mono text-slate-400" title={t.position}>
                #{row.queue_position ?? 0}
              </span>
              <span
                className={`shrink-0 text-[10px] ${row.tts_status === 'leased' ? 'text-sky-500' : row.tts_status === 'failed' ? 'text-rose-500' : 'text-slate-400'}`}
                title={row.tts_locked_by ? `${t.status}: ${row.tts_locked_by}` : t.status}
              >
                {row.tts_status}
              </span>
              <span className="shrink-0 text-[10px] text-slate-400" title={t.occurrences}>
                ×{row.occurrence_count ?? 1}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(pages.pageIndex > 1 || pages.hasMore) && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            type="button"
            disabled={pages.pageIndex <= 1 || loading}
            onClick={pages.previous}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-500">{pages.pageIndex}</span>
          <button
            type="button"
            disabled={!pages.hasMore || loading}
            onClick={pages.next}
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
