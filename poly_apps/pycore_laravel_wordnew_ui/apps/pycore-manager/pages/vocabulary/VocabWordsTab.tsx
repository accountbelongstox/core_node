/**
 * Words tab - dictionary word table with filter / search / sort / paging,
 * batch actions (delete / mark_valid / mark_invalid / requeue_tts) and per-word
 * edit + delete + requeue-TTS + validity-report. Uses Laravel directly.
 *
 * Query params mirror BooksAPI.getDictionaryWords (language/filter/q/start/limit/
 * sort/order) so the direct Laravel request receives its native query shape.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Trash2, RefreshCw, CheckCircle2, XCircle, Pencil, Flag, Search,
} from 'lucide-react';
import { laravelApi } from '@/apps/pycore-manager/api';
import type { VocabDictionaryWordRow } from '@/apps/pycore-manager/api';
import { isWordRowValid } from '@/core/integrations/laravel/wordValidity';
import { VL, VocabBanner, VocabLoading, PresenceBadge, humanInt, vp, toArray } from './vocabShared';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'with_translation', label: 'Has translation' },
  { value: 'without_translation', label: 'No translation' },
  { value: 'with_audio', label: 'Has audio' },
  { value: 'without_audio', label: 'No audio' },
  { value: 'invalid', label: 'Invalid' },
];
const SORTS: Array<{ value: string; label: string }> = [
  { value: 'word', label: 'Word' },
  { value: 'translation', label: 'Translation' },
  { value: 'queries', label: 'Queries' },
  { value: 'status', label: 'Status' },
];
const PAGE_SIZE = 50;

const L = {
  languagePh: 'en',
  filter: 'Filter',
  sort: 'Sort',
  apply: 'Apply',
  word: 'Word',
  translations: 'Translations',
  phonetic: 'Phonetic',
  queries: 'Queries',
  batchTitle: 'Batch',
  markValid: 'Mark valid',
  markInvalid: 'Mark invalid',
  requeueTts: 'Requeue TTS',
  selected: 'selected',
  validity: 'Report validity',
  editWord: 'Edit word',
  sentences: 'Sentences',
  noSentences: 'No example sentences.',
};

interface EditState {
  md5: string;
  language: string;
  content: string;
  translations: string;
  phonetic: string;
  is_valid: boolean;
  validity_note: string;
}

export default function VocabWordsTab() {
  const [language, setLanguage] = useState('en');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('word');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [start, setStart] = useState(0);

  const [rows, setRows] = useState<VocabDictionaryWordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [sentences, setSentences] = useState<{ md5: string; items: any[]; loading: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await laravelApi.getVocabDictionaryWords({
        language, filter, q, start, limit: PAGE_SIZE, sort, order,
      });
      const p = vp<any>(r);
      setRows(toArray<VocabDictionaryWordRow>(p));
      setTotal(Number(p?.total || 0));
      setSelected(new Set());
      setOffline(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : VL.error;
      if (/offline|unavailable|Failed to fetch|timed out/i.test(msg)) setOffline(true);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [language, filter, q, start, sort, order]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setStart(0); }, [language, filter, q, sort, order]);

  const toggle = (md5: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(md5)) n.delete(md5); else n.add(md5);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.md5 || r.content || '').filter(Boolean)));
  };

  const runBatch = async (action: 'delete' | 'mark_valid' | 'mark_invalid' | 'requeue_tts') => {
    const md5s = Array.from(selected).filter(Boolean);
    if (!md5s.length) return;
    if (action === 'delete' && !confirm(VL.confirmDelete)) return;
    try {
      await laravelApi.batchVocabDictionaryWords({ language, md5s, action });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : VL.error);
    }
  };

  const deleteWord = async (row: VocabDictionaryWordRow) => {
    const md5 = row.md5 || '';
    if (!md5 || !confirm(VL.confirmDelete)) return;
    try {
      await laravelApi.deleteVocabDictionaryWord(md5, { language });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : VL.error);
    }
  };

  const requeueTts = async (row: VocabDictionaryWordRow) => {
    const content = row.content || row.word || '';
    if (!content) return;
    try {
      // laravel TTS batch/query takes a BARE ARRAY of {content, language, type}.
      await laravelApi.queueVocabTtsBatchQuery([{ content, language, type: 'word' }]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : VL.error);
    }
  };

  const reportValidity = async (row: VocabDictionaryWordRow) => {
    const md5 = row.md5 || '';
    if (!md5) return;
    try {
      await laravelApi.reportVocabValidity({ language, md5 });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : VL.error);
    }
  };

  const loadSentences = async (row: VocabDictionaryWordRow) => {
    const md5 = row.md5 || '';
    const word = row.content || row.word || '';
    if (!word) return;
    if (sentences?.md5 === md5) { setSentences(null); return; }
    setSentences({ md5, items: [], loading: true });
    try {
      const r = await laravelApi.getVocabDictionarySentences({ word, language, limit: 10 });
      setSentences({ md5, items: toArray(vp<any>(r)), loading: false });
    } catch {
      setSentences({ md5, items: [], loading: false });
    }
  };

  const openEdit = (row: VocabDictionaryWordRow) => {
    setEditError(null);
    setEdit({
      md5: row.md5 || '',
      language,
      content: row.content || row.word || '',
      translations: (row.translations || []).join('\n'),
      phonetic: row.phonetic || row.us_phonetic || '',
      is_valid: isWordRowValid(row),
      validity_note: row.validity_note || '',
    });
  };

  const saveEdit = async () => {
    if (!edit || !edit.md5) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await laravelApi.updateVocabDictionaryWord(edit.md5, {
        language: edit.language,
        translations: edit.translations.split('\n').map((s) => s.trim()).filter(Boolean),
        phonetic: edit.phonetic || null,
        is_valid: edit.is_valid,
        validity_note: edit.validity_note || null,
      });
      setEdit(null);
      await load();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : VL.error);
    } finally {
      setEditBusy(false);
    }
  };

  if (loading && rows.length === 0) return <VocabLoading />;
  if (offline && rows.length === 0) return <VocabBanner kind="offline" message={VL.offline} />;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{VL.language}</span>
          <input value={language} onChange={(e) => setLanguage(e.target.value)}
            placeholder={L.languagePh}
            className="w-24 px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{L.filter}</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{VL.search}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void load(); }}
            placeholder="…"
            className="w-40 px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{L.sort}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          className="px-2 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50">
          {order === 'asc' ? '↑' : '↓'}
        </button>
        <button onClick={load}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm hover:bg-sky-400">
          <Search className="w-3.5 h-3.5" /> {L.apply}
        </button>
      </div>

      {error && <VocabBanner kind="error" message={error} />}

      {/* Batch bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm">
          <span className="text-slate-300">{selected.size} {L.selected}</span>
          <BatchBtn onClick={() => runBatch('mark_valid')} icon={CheckCircle2} label={L.markValid} />
          <BatchBtn onClick={() => runBatch('mark_invalid')} icon={XCircle} label={L.markInvalid} />
          <BatchBtn onClick={() => runBatch('requeue_tts')} icon={RefreshCw} label={L.requeueTts} />
          <BatchBtn onClick={() => runBatch('delete')} icon={Trash2} label={VL.delete} danger />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-400">
            <tr>
              <th className="px-2 py-2 w-8">
                <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll} className="accent-sky-400" />
              </th>
              <th className="px-2 py-2 text-left">{L.word}</th>
              <th className="px-2 py-2 text-left">{L.translations}</th>
              <th className="px-2 py-2 text-left">{L.phonetic}</th>
              <th className="px-2 py-2 text-center">T</th>
              <th className="px-2 py-2 text-center">A</th>
              <th className="px-2 py-2 text-center">V</th>
              <th className="px-2 py-2 text-right">{L.queries}</th>
              <th className="px-2 py-2 text-right">{VL.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const md5 = row.md5 || row.content || '';
              const isSel = selected.has(md5);
              return (
                <React.Fragment key={md5 || i}>
                  <tr className={`border-t border-slate-800 ${isSel ? 'bg-sky-500/5' : 'hover:bg-slate-800/30'}`}>
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={isSel} onChange={() => toggle(md5)} className="accent-sky-400" />
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-100">{row.content || row.word}</td>
                    <td className="px-2 py-2 text-slate-300 max-w-xs">
                      <div className="truncate">{(row.translations || []).join('; ')}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-400">{row.phonetic || row.us_phonetic || '—'}</td>
                    <td className="px-2 py-2 text-center"><PresenceBadge ok={!!row.has_translation} yesLabel="T" noLabel="—" /></td>
                    <td className="px-2 py-2 text-center"><PresenceBadge ok={!!row.has_audio} yesLabel="A" noLabel="—" /></td>
                    <td className="px-2 py-2 text-center"><PresenceBadge ok={isWordRowValid(row)} yesLabel="V" noLabel="—" /></td>
                    <td className="px-2 py-2 text-right text-slate-400">{humanInt(row.query_count)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title={L.sentences} onClick={() => loadSentences(row)}><Search className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title={L.editWord} onClick={() => openEdit(row)}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title={L.requeueTts} onClick={() => requeueTts(row)}><RefreshCw className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title={L.validity} onClick={() => reportValidity(row)}><Flag className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title={VL.delete} onClick={() => deleteWord(row)} danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                  {sentences?.md5 === md5 && (
                    <tr className="border-t border-slate-800 bg-slate-900/40">
                      <td colSpan={9} className="px-4 py-2">
                        {sentences.loading ? <span className="text-slate-400">{VL.loading}</span> :
                          sentences.items.length === 0 ? <span className="text-slate-500">{L.noSentences}</span> :
                          <ul className="space-y-1 text-slate-300">
                            {sentences.items.map((s, j) => (
                              <li key={j} className="text-xs">{s.text || s.sentence || JSON.stringify(s)}</li>
                            ))}
                          </ul>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-slate-500">{VL.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paging */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{humanInt(total)} {VL.total} · {start + 1}–{Math.min(start + PAGE_SIZE, total)} {VL.of} {humanInt(total)}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setStart(Math.max(0, start - PAGE_SIZE))} disabled={start === 0}
            className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{VL.prev}</button>
          <button onClick={() => setStart(start + PAGE_SIZE)} disabled={start + PAGE_SIZE >= total}
            className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{VL.next}</button>
        </div>
      </div>

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">{L.editWord}</h3>
              <button onClick={() => setEdit(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <Field label={L.word}>
              <input value={edit.content} readOnly
                className="w-full px-2 py-1.5 rounded bg-slate-800/60 border border-slate-700 text-slate-400" />
            </Field>
            <Field label={L.translations}>
              <textarea value={edit.translations}
                onChange={(e) => setEdit({ ...edit, translations: e.target.value })} rows={3}
                placeholder="one per line"
                className="w-full px-2 py-1.5 rounded bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400" />
            </Field>
            <Field label={L.phonetic}>
              <input value={edit.phonetic}
                onChange={(e) => setEdit({ ...edit, phonetic: e.target.value })}
                className="w-full px-2 py-1.5 rounded bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={edit.is_valid}
                onChange={(e) => setEdit({ ...edit, is_valid: e.target.checked })} className="accent-sky-400" />
              valid
            </label>
            {editError && <VocabBanner kind="error" message={editError} />}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEdit(null)}
                className="px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-700/50">{VL.cancel}</button>
              <button onClick={saveEdit} disabled={editBusy}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-sky-500 text-white disabled:opacity-50 hover:bg-sky-400">
                {editBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} {VL.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchBtn({ onClick, icon: Icon, label, danger }: {
  onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs ${danger ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10' : 'border-slate-600 text-slate-300 hover:bg-slate-700/50'}`}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

function IconBtn({ title, onClick, children, danger }: {
  title: string; onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button title={title} onClick={onClick}
      className={`p-1 rounded hover:bg-slate-700/50 ${danger ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'}`}>
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}
