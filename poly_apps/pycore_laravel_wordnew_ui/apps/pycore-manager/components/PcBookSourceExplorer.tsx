/**
 * PcBookSourceExplorer — rich per-source browser (words / sentences / chapters).
 *
 * Opened from the Books page Details control. Shows language + sentence + chapter
 * counts, sortable word frequencies, searchable/filterable sentences (per chapter
 * and per language for multi-lang correspondence), and a chapter index.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, RefreshCw, Type, AlignLeft, BookMarked, Languages, Volume2,
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Hash,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type {
  BooksAnalyzeResponse, BookTextStats, BookChapter, BookSlot, CoreBookSummary,
  CoreBookCompletenessLang,
} from '../../../core/api-libs/pycore';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../../core/i18n/supportedLearningLanguages';

const L = {
  title: 'Source explorer',
  close: 'Close',
  words: 'Words',
  sentences: 'Sentences',
  chapters: 'Chapters',
  languages: 'Languages',
  voices: 'Voices (audio)',
  sentencesN: 'Sentences',
  chaptersN: 'Chapters',
  langsN: 'Languages',
  search: 'Search sentences…',
  sortCount: 'Sort by count',
  asc: 'Low → high',
  desc: 'High → low',
  allChapters: 'All chapters',
  chapter: 'Chapter',
  loading: 'Loading…',
  empty: 'No items.',
  prev: 'Prev',
  next: 'Next',
  showing: 'Showing',
  of: 'of',
  matched: 'matched',
  sideBySide: 'Side by side',
  noAnalysis: 'No analysis yet.',
  audioFilled: 'with audio',
};

const PAGE = 80;
const nf = (n: number | undefined | null) => (typeof n === 'number' ? n.toLocaleString() : '0');

const langLabel = (code: string): string =>
  SUPPORTED_LEARNING_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();

type Tab = 'words' | 'sentences' | 'chapters';

export interface PcBookSourceExplorerProps {
  path: string;
  analysis: BooksAnalyzeResponse | null;
  selectedLangs: string[];
  lockedLang: string;
  sourceKey?: string;
  onClose: () => void;
}

const PcBookSourceExplorer: React.FC<PcBookSourceExplorerProps> = ({
  path, analysis, selectedLangs, lockedLang, sourceKey, onClose,
}) => {
  const [tab, setTab] = useState<Tab>('sentences');
  const [corebook, setCorebook] = useState<CoreBookSummary | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loadingMeta, setLoadingMeta] = useState(true);

  // words
  const [wordSort, setWordSort] = useState<'asc' | 'desc'>('desc');
  const [wordStart, setWordStart] = useState(0);
  const [wordItems, setWordItems] = useState<{ word: string; count: number }[]>([]);
  const [wordTotal, setWordTotal] = useState(0);
  const [wordLoading, setWordLoading] = useState(false);

  // sentences
  const [sentQuery, setSentQuery] = useState('');
  const [sentQueryDebounced, setSentQueryDebounced] = useState('');
  const [sentChapter, setSentChapter] = useState<number | null>(null);
  const [sentLang, setSentLang] = useState<string>(lockedLang);
  const [sentSideBySide, setSentSideBySide] = useState(false);
  const [sentStart, setSentStart] = useState(0);
  const [sentItems, setSentItems] = useState<any[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentLoading, setSentLoading] = useState(false);

  const langs = useMemo(
    () => SUPPORTED_LEARNING_LANGUAGES.map((l) => l.code).filter((c) => selectedLangs.includes(c)),
    [selectedLangs],
  );
  const agg: BookTextStats | null = analysis?.aggregate || null;
  const multiLang = langs.length > 1;

  useEffect(() => {
    const t = window.setTimeout(() => setSentQueryDebounced(sentQuery.trim()), 350);
    return () => window.clearTimeout(t);
  }, [sentQuery]);

  useEffect(() => { setSentLang(lockedLang); }, [lockedLang]);

  // Meta: chapters + totals + optional CoreBook audio completeness.
  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    (async () => {
      try {
        const r = await pycoreApi.booksList(path, 'chapters', 0, 2000, { languages: langs });
        if (cancelled) return;
        const ch = Array.isArray(r?.chapters) ? r.chapters
          : (Array.isArray(r?.items) ? (r.items as BookChapter[]) : []);
        setChapters(ch);
        setTotals(r?.totals || {});
      } catch { /* offline-safe */ }
      if (sourceKey) {
        try {
          const cl = await pycoreApi.corebookList();
          const hit = (cl?.items || []).find((b) => b.source_key === sourceKey);
          if (!cancelled && hit) setCorebook(hit);
        } catch { /* optional */ }
      }
      if (!cancelled) setLoadingMeta(false);
    })();
    return () => { cancelled = true; };
  }, [path, sourceKey, langs]);

  const loadWords = useCallback(async (start: number) => {
    setWordLoading(true);
    try {
      const r = await pycoreApi.booksList(path, 'words', start, PAGE, { sort_order: wordSort });
      if (r?.success) {
        setWordItems(r.items || []);
        setWordTotal(r.total || 0);
        setWordStart(r.start || start);
      }
    } finally {
      setWordLoading(false);
    }
  }, [path, wordSort]);

  const loadSentences = useCallback(async (start: number) => {
    setSentLoading(true);
    try {
      const q = sentQueryDebounced || undefined;
      const useSlots = multiLang && sentChapter !== null && (sentSideBySide || sentLang);
      if (useSlots && sentSideBySide) {
        const r = await pycoreApi.booksList(path, 'sentences', start, PAGE, {
          chapter_index: sentChapter!,
          languages: langs,
          query: q,
        });
        if (r?.success) {
          setSentItems(r.items || []);
          setSentTotal(r.total || 0);
          setSentStart(r.start || start);
        }
      } else if (useSlots && sentLang) {
        const r = await pycoreApi.booksList(path, 'sentences', start, PAGE, {
          chapter_index: sentChapter!,
          languages: langs,
          query: q,
          view_language: sentLang,
        });
        if (r?.success) {
          setSentItems(r.items || []);
          setSentTotal(r.total || 0);
          setSentStart(r.start || start);
        }
      } else {
        const r = await pycoreApi.booksList(path, 'sentences', start, PAGE, {
          chapter_index: sentChapter ?? undefined,
          query: q,
        });
        if (r?.success) {
          setSentItems(r.items || []);
          setSentTotal(r.total || 0);
          setSentStart(r.start || start);
        }
      }
    } finally {
      setSentLoading(false);
    }
  }, [path, langs, multiLang, sentChapter, sentLang, sentSideBySide, sentQueryDebounced]);

  useEffect(() => { if (tab === 'words') void loadWords(0); }, [tab, loadWords]);
  useEffect(() => {
    if (tab === 'sentences') void loadSentences(0);
  }, [tab, loadSentences]);

  const chapterCount = chapters.length || totals.chapters || 0;
  const sentenceCount = agg?.sentence_count ?? totals.sentences ?? 0;
  const langCount = langs.length;
  const voiceStats: Record<string, CoreBookCompletenessLang> = corebook?.completeness?.languages || {};
  const voiceCount = Object.values(voiceStats).filter((v) => (v?.audio || 0) > 0).length;

  const chapterTitle = (ch: BookChapter): string => {
    const t = ch.titles;
    if (t?.[lockedLang]) return t[lockedLang]!;
    if (t) {
      const v = Object.values(t).find((x) => !!x);
      if (v) return v;
    }
    return ch.title || `${L.chapter} ${(ch.chapter_index ?? 0) + 1}`;
  };

  const summaryBar = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {[
        { icon: <Languages className="w-3.5 h-3.5" />, label: L.langsN, value: nf(langCount) },
        { icon: <AlignLeft className="w-3.5 h-3.5" />, label: L.sentencesN, value: nf(sentenceCount) },
        { icon: <BookMarked className="w-3.5 h-3.5" />, label: L.chaptersN, value: nf(chapterCount) },
        {
          icon: <Volume2 className="w-3.5 h-3.5" />,
          label: L.voices,
          value: voiceCount > 0 ? `${voiceCount}/${langCount}` : '—',
        },
      ].map((s) => (
        <div key={s.label} className="rounded-xl p-3 border bg-slate-100/60 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">{s.icon}{s.label}</div>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{loadingMeta ? '…' : s.value}</div>
        </div>
      ))}
    </div>
  );

  const pager = (start: number, total: number, loading: boolean, onPage: (s: number) => void) => {
    const from = total === 0 ? 0 : start + 1;
    const to = Math.min(start + PAGE, total);
    return (
      <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
        <span>{L.showing} {nf(from)}–{nf(to)} {L.of} {nf(total)}{sentQueryDebounced ? ` (${L.matched})` : ''}</span>
        <div className="flex gap-2">
          <button type="button" disabled={start <= 0 || loading}
            onClick={() => onPage(Math.max(0, start - PAGE))}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> {L.prev}
          </button>
          <button type="button" disabled={start + PAGE >= total || loading}
            onClick={() => onPage(start + PAGE)}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 flex items-center gap-1">
            {L.next} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3"
      onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}>
        <div className="p-5 pb-3 border-b border-slate-200/60 dark:border-white/5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{L.title}</h3>
              <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5" title={path}>{path.split(/[\\/]/).pop()}</p>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          {!agg ? (
            <p className="text-xs text-slate-500 mt-3">{L.noAnalysis}</p>
          ) : summaryBar}
          <div className="flex gap-1 mt-3 flex-wrap">
            {(['sentences', 'words', 'chapters'] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                  tab === t
                    ? 'border-rose-500/60 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500'}`}>
                {t === 'words' ? L.words : t === 'sentences' ? L.sentences : L.chapters}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 pt-3">
          {tab === 'words' && (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[11px] text-slate-400 flex items-center gap-1"><ArrowUpDown className="w-3.5 h-3.5" />{L.sortCount}</span>
                {(['desc', 'asc'] as const).map((o) => (
                  <button key={o} type="button" onClick={() => { setWordSort(o); setWordStart(0); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                      wordSort === o ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-500' : 'border-slate-200 dark:border-white/10 text-slate-400'}`}>
                    {o === 'desc' ? L.desc : L.asc}
                  </button>
                ))}
                {wordLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[120px]">
                {wordItems.length === 0 && !wordLoading ? (
                  <p className="text-xs text-slate-400 py-6 w-full text-center">{L.empty}</p>
                ) : wordItems.map((w, i) => (
                  <span key={`${w.word}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-200">
                    {w.word} <span className="text-slate-400">×{nf(w.count)}</span>
                  </span>
                ))}
              </div>
              {pager(wordStart, wordTotal, wordLoading, (s) => void loadWords(s))}
            </div>
          )}

          {tab === 'sentences' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={sentQuery} onChange={(e) => { setSentQuery(e.target.value); setSentStart(0); }}
                    placeholder={L.search}
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500/50" />
                </div>
                <select value={sentChapter === null ? '' : String(sentChapter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSentChapter(v === '' ? null : Number(v));
                    setSentStart(0);
                  }}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none min-w-[140px]">
                  <option value="">{L.allChapters}</option>
                  {chapters.map((ch) => (
                    <option key={ch.chapter_index} value={ch.chapter_index}>
                      {chapterTitle(ch)} ({nf(ch.sentence_count ?? 0)})
                    </option>
                  ))}
                </select>
              </div>

              {multiLang && sentChapter !== null && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <button type="button" onClick={() => { setSentSideBySide(true); setSentStart(0); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                      sentSideBySide ? 'border-sky-500/50 bg-sky-500/10 text-sky-500' : 'border-slate-200 dark:border-white/10 text-slate-400'}`}>
                    {L.sideBySide}
                  </button>
                  {langs.map((code) => (
                    <button key={code} type="button"
                      onClick={() => { setSentSideBySide(false); setSentLang(code); setSentStart(0); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                        !sentSideBySide && sentLang === code
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                          : 'border-slate-200 dark:border-white/10 text-slate-400'}`}>
                      {code.toUpperCase()} <span className="font-normal opacity-70">{langLabel(code)}</span>
                    </button>
                  ))}
                </div>
              )}

              {multiLang && sentChapter === null && (
                <p className="text-[11px] text-amber-500 mb-2">{L.chapter}: pick one chapter to browse per-language sentences.</p>
              )}

              {sentLoading ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> {L.loading}
                </div>
              ) : sentSideBySide && multiLang ? (
                <div className="overflow-auto max-h-[50vh] rounded-xl border border-slate-200/60 dark:border-white/5">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                      <tr>
                        <th className="px-2 py-1 text-right text-slate-400 w-10">#</th>
                        {langs.map((c) => (
                          <th key={c} className="px-2 py-1 text-left text-slate-400">{c.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(sentItems as BookSlot[]).map((slot, i) => (
                        <tr key={slot.corr_id || i} className="border-t border-slate-200/50 dark:border-white/5 align-top">
                          <td className="px-2 py-1 text-right tabular-nums text-slate-400">{nf((slot.seq ?? i) + 1)}</td>
                          {langs.map((c) => (
                            <td key={c} className={`px-2 py-1 break-words ${slot.langs?.[c] ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 italic'}`}>
                              {slot.langs?.[c] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ol className="space-y-1.5 min-h-[120px]">
                  {sentItems.length === 0 ? (
                    <li className="text-xs text-slate-400 py-6 text-center list-none">{L.empty}</li>
                  ) : sentItems.map((s: any, i: number) => (
                    <li key={`${s.seq}-${i}`} className="flex gap-2 text-[11px] text-slate-700 dark:text-slate-200 list-none">
                      <span className="shrink-0 text-slate-400 tabular-nums w-12 text-right">{nf((s.seq ?? (sentStart + i)) + 1)}</span>
                      {s.language && (
                        <span className="shrink-0 font-mono uppercase text-[10px] text-emerald-500">{s.language}</span>
                      )}
                      <span className="break-words flex-1">{s.text}</span>
                    </li>
                  ))}
                </ol>
              )}
              {pager(sentStart, sentTotal, sentLoading, (s) => void loadSentences(s))}
            </div>
          )}

          {tab === 'chapters' && (
            <div className="space-y-1.5">
              {loadingMeta ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> {L.loading}
                </div>
              ) : chapters.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">{L.empty}</p>
              ) : chapters.map((ch) => (
                <button key={ch.chapter_index} type="button"
                  onClick={() => {
                    setSentChapter(ch.chapter_index);
                    setTab('sentences');
                    setSentStart(0);
                  }}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] text-left hover:border-rose-500/40 transition">
                  <BookMarked className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-800 dark:text-slate-100 truncate flex-1">{chapterTitle(ch)}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{nf(ch.sentence_count)} {L.sentences.toLowerCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200/60 dark:border-white/5 shrink-0 flex justify-end">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition">
            {L.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PcBookSourceExplorer;
