import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Loader2, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import { wfNewAdminApi, adminErrorText } from '../../api';
import type {
  WfNewAdminWordRow, WfNewAdminWordsPage, WfNewAdminWordFilter,
  WfNewAdminWordSort, WfNewAdminWordEditable, WfNewAdminBatchAction,
} from '../../api';
import { ADMIN_SEARCH_DEBOUNCE_MS } from '../../constants/uiTiming';
import { WfNewPager } from '../WfNewPager';
import { WfNewAdminWordEditor } from './WfNewAdminWordEditor';
import { WfNewAdminWordRow as WordRowView, WORD_HEAD_GRID, type SentenceSlot } from './WfNewAdminWordRow';
import {
  ADMIN_FALLBACK_LANGUAGES, AdminAsync, AdminCheckbox, AdminTable, AdminTableShell, adminInputClass, useAdminAudio,
  useAdminConfirm, useAdminLanguage, useDebouncedValue, useRequestGuard,
  type AdminPanelProps,
} from './adminKit';

const PAGE_SIZE = 50;

const FILTERS: Array<{ value: WfNewAdminWordFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'admin.w.f.all' },
  { value: 'with_translation', labelKey: 'admin.w.f.withTrans' },
  { value: 'without_translation', labelKey: 'admin.w.f.noTrans' },
  { value: 'with_audio', labelKey: 'admin.w.f.withAudio' },
  { value: 'without_audio', labelKey: 'admin.w.f.noAudio' },
  { value: 'invalid', labelKey: 'admin.w.f.invalid' },
];

const BATCH_ACTIONS: Array<{ action: WfNewAdminBatchAction; labelKey: string }> = [
  { action: 'mark_valid', labelKey: 'admin.w.act.valid' },
  { action: 'mark_invalid', labelKey: 'admin.w.act.invalid' },
  { action: 'requeue_tts', labelKey: 'admin.w.act.requeue' },
  { action: 'delete', labelKey: 'admin.w.act.delete' },
];

const HEADER_BTN_CLS = 'flex items-center gap-1 uppercase tracking-wider text-left hover:text-zinc-300 transition';

const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const WfNewAdminWords: React.FC<AdminPanelProps> = ({ activeTheme, trans, addToast }) => {
  const { language, setLanguage, options: langOptions } = useAdminLanguage(ADMIN_FALLBACK_LANGUAGES[0]);
  const [filter, setFilter] = useState<WfNewAdminWordFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const q = useDebouncedValue(searchInput.trim(), ADMIN_SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState<WfNewAdminWordSort | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [start, setStart] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  const [data, setData] = useState<WfNewAdminWordsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sentencesByMd5, setSentencesByMd5] = useState<Record<string, SentenceSlot>>({});
  const sentenceRequested = useRef<Set<string>>(new Set());

  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; row: WfNewAdminWordRow | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchBusy, setBatchBusy] = useState<WfNewAdminBatchAction | null>(null);

  const audio = useAdminAudio();
  const guard = useRequestGuard();
  const { confirm, dialog } = useAdminConfirm(trans);

  const toastError = useCallback((e: any): void => {
    addToast(adminErrorText(e), 'warning');
  }, [addToast]);

  const bumpReload = useCallback((): void => setReloadTick((t) => t + 1), []);

  useEffect(() => { setStart(0); }, [q]);

  useEffect(() => {
    const reqId = guard.begin();
    setLoading(true);
    setError(null);
    wfNewAdminApi.getWords({
      language,
      filter,
      q: q || undefined,
      sort: sort ?? undefined,
      order: sort ? order : undefined,
      start,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (!guard.isCurrent(reqId)) return;
        setData(res);
        setExpanded(new Set());
      })
      .catch((e: any) => {
        if (!guard.isCurrent(reqId)) return;
        setError(adminErrorText(e));
        setData(null);
      })
      .finally(() => {
        if (guard.isCurrent(reqId)) setLoading(false);
      });
  }, [language, filter, q, sort, order, start, reloadTick, guard]);

  useEffect(() => {
    setSelected(new Set());
    sentenceRequested.current = new Set();
    setSentencesByMd5({});
  }, [language]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = Math.floor(start / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeLanguage = (lang: string): void => {
    setLanguage(lang);
    setStart(0);
  };

  const changeFilter = (f: WfNewAdminWordFilter): void => {
    setFilter(f);
    setStart(0);
  };

  const goTo = useCallback((p: number): void => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    if (clamped !== page) {
      setStart((clamped - 1) * PAGE_SIZE);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, totalPages]);

  const cycleSort = (key: WfNewAdminWordSort, firstOrder: 'asc' | 'desc' = 'asc'): void => {
    if (sort !== key) {
      setSort(key);
      setOrder(firstOrder);
    } else if (order === firstOrder) {
      setOrder(firstOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(null);
    }
  };

  const togglePlay = (row: WfNewAdminWordRow): void => {
    const url = wfNewAdminApi.absUrl(row.audio_url);
    if (url) audio.toggle(row.md5, url);
  };

  const loadSentences = useCallback((row: WfNewAdminWordRow): void => {
    if (sentenceRequested.current.has(row.md5)) return;
    sentenceRequested.current.add(row.md5);
    setSentencesByMd5((prev) => ({ ...prev, [row.md5]: { loading: true, error: null, sentences: [] } }));
    wfNewAdminApi.getWordSentences(row.content, language)
      .then((r) => {
        if (!guard.isAlive()) return;
        setSentencesByMd5((prev) => ({
          ...prev,
          [row.md5]: { loading: false, error: null, sentences: r?.sentences ?? [] },
        }));
      })
      .catch((e: any) => {
        if (!guard.isAlive()) return;
        sentenceRequested.current.delete(row.md5);
        setSentencesByMd5((prev) => ({
          ...prev,
          [row.md5]: { loading: false, error: adminErrorText(e), sentences: [] },
        }));
      });
  }, [language, guard]);

  const toggleExpand = useCallback((row: WfNewAdminWordRow): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(row.md5)) {
        next.delete(row.md5);
      } else {
        next.add(row.md5);
        loadSentences(row);
      }
      return next;
    });
  }, [loadSentences]);

  const toggleSelect = (md5: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(md5)) next.delete(md5);
      else next.add(md5);
      return next;
    });
  };

  const pageAllSelected = items.length > 0 && items.every((r) => selected.has(r.md5));
  const toggleSelectPage = (): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) items.forEach((r) => next.delete(r.md5));
      else items.forEach((r) => next.add(r.md5));
      return next;
    });
  };

  const runBatch = async (action: WfNewAdminBatchAction): Promise<void> => {
    const md5s = Array.from<string>(selected);
    if (md5s.length === 0 || batchBusy) return;
    if (action === 'delete' && !(await confirm(trans('admin.w.batchAsk', { n: md5s.length })))) return;
    setBatchBusy(action);
    try {
      const res = await wfNewAdminApi.batchWords({ language, md5s, action });
      if (!guard.isAlive()) return;
      addToast(trans('admin.w.batchOk', { n: res?.affected ?? md5s.length }), 'success');
      setSelected(new Set());
      bumpReload();
    } catch (e: any) {
      toastError(e);
    } finally {
      if (guard.isAlive()) setBatchBusy(null);
    }
  };

  const deleteRow = async (row: WfNewAdminWordRow): Promise<void> => {
    if (!(await confirm(trans('admin.w.deleteAsk', { word: row.content })))) return;
    try {
      await wfNewAdminApi.deleteWord(row.md5, language);
      if (!guard.isAlive()) return;
      addToast(trans('admin.w.deleted'), 'success');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.md5);
        return next;
      });
      bumpReload();
    } catch (e: any) {
      toastError(e);
    }
  };

  const handleEditorSave = async (payload: { content: string } & WfNewAdminWordEditable): Promise<void> => {
    if (!editor) return;
    setSaving(true);
    try {
      const { content, ...editable } = payload;
      if (editor.mode === 'create') {
        await wfNewAdminApi.createWord({ language, content, ...editable });
        if (!guard.isAlive()) return;
        addToast(trans('admin.w.created'), 'success');
      } else if (editor.row) {
        await wfNewAdminApi.updateWord(editor.row.md5, { language, ...editable });
        if (!guard.isAlive()) return;
        addToast(trans('admin.w.updated'), 'success');
      }
      setEditor(null);
      bumpReload();
    } catch (e: any) {
      toastError(e);
    } finally {
      if (guard.isAlive()) setSaving(false);
    }
  };

  const sortIndicator = (key: WfNewAdminWordSort): React.ReactNode => {
    if (sort !== key) return null;
    return order === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 sm:p-6 rounded-3xl ${activeTheme.cardClass}`}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={language} onChange={(e) => changeLanguage(e.target.value)} title={trans('admin.w.language')} className={adminInputClass(activeTheme)}>
            {langOptions.map((lang) => <option key={lang} value={lang}>{capitalize(lang)}</option>)}
          </select>
          <select value={filter} onChange={(e) => changeFilter(e.target.value as WfNewAdminWordFilter)} title={trans('admin.w.filter')} className={adminInputClass(activeTheme)}>
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{trans(f.labelKey)}</option>)}
          </select>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={trans('admin.w.search')}
            className={adminInputClass(activeTheme, 'flex-1 min-w-[10rem]')}
          />
          <ChipButton variant="active" onClick={() => setEditor({ mode: 'create', row: null })} className="gap-1.5 hover:bg-indigo-500/25">
            <Plus className="w-3.5 h-3.5" /> {trans('admin.w.add')}
          </ChipButton>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-500">{trans('admin.w.total', { n: total })}</span>
            <ChipButton variant={sort === 'queries' ? 'active' : 'default'} onClick={() => cycleSort('queries', 'desc')} title={trans('admin.w.queries', { n: total })}>
              <BarChart2 className="w-3.5 h-3.5" />
              {sortIndicator('queries')}
            </ChipButton>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.08] px-4 py-2.5 flex flex-wrap gap-2 items-center"
          >
            <span className="text-[11px] font-mono font-bold text-indigo-300">{trans('admin.w.selected', { n: selected.size })}</span>
            {BATCH_ACTIONS.map(({ action, labelKey }) => (
              <ChipButton key={action} variant={action === 'delete' ? 'danger' : 'default'} onClick={() => { void runBatch(action); }} disabled={batchBusy !== null}>
                {batchBusy === action && <Loader2 className="w-3 h-3 animate-spin" />}
                {trans(labelKey)}
              </ChipButton>
            ))}
            <div className="flex-1" />
            <ChipButton onClick={() => setSelected(new Set())} disabled={batchBusy !== null} className="px-1.5" title={trans('admin.cancel')}>
              <X className="w-3.5 h-3.5" />
            </ChipButton>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminTableShell>
        <AdminAsync trans={trans} loading={loading} error={error} empty={items.length === 0} onRetry={bumpReload}>
          <AdminTable
            grid={WORD_HEAD_GRID}
            headClassName="hidden sm:grid items-center"
            head={(
              <>
                <span><AdminCheckbox checked={pageAllSelected} onChange={toggleSelectPage} /></span>
                <span>#</span>
                <button type="button" onClick={() => cycleSort('word')} className={HEADER_BTN_CLS}>
                  {trans('admin.w.col.word')} {sortIndicator('word')}
                </button>
                <span>{trans('admin.w.col.translation')}</span>
                <button type="button" onClick={() => cycleSort('status')} className={HEADER_BTN_CLS}>
                  {trans('admin.w.col.status')} {sortIndicator('status')}
                </button>
                <span className="text-right">{trans('admin.w.col.actions')}</span>
              </>
            )}
          >
            {items.map((row, i) => (
              <WordRowView
                key={row.md5}
                row={row}
                position={start + i + 1}
                selected={selected.has(row.md5)}
                open={expanded.has(row.md5)}
                playing={audio.playingKey === row.md5}
                sentences={sentencesByMd5[row.md5]}
                trans={trans}
                onToggleSelect={() => toggleSelect(row.md5)}
                onPlay={() => togglePlay(row)}
                onEdit={() => setEditor({ mode: 'edit', row })}
                onDelete={() => { void deleteRow(row); }}
                onToggleExpand={() => toggleExpand(row)}
              />
            ))}
          </AdminTable>
        </AdminAsync>
      </AdminTableShell>

      {!loading && !error && <WfNewPager variant="compact" page={page} totalPages={totalPages} onGoTo={goTo} trans={trans} />}

      {editor && (
        <WfNewAdminWordEditor
          key={`${editor.mode}-${editor.row?.md5 ?? 'new'}`}
          mode={editor.mode}
          row={editor.row}
          saving={saving}
          activeTheme={activeTheme}
          trans={trans}
          onCancel={() => { if (!saving) setEditor(null); }}
          onSave={handleEditorSave}
        />
      )}
      {dialog}
    </div>
  );
};
