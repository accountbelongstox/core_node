/**
 * PcCoreBookPage — open, enrich and submit a portable CoreBook.
 *
 * A CoreBook is ONE book (N chapters, ordered sentences, multi-language
 * correspondence, per-language audio). This page drives the pycore CoreBook
 * engine over the `/api/local/corebook/*` proxy:
 *
 *   1. Convert  — turn a document path (PDF/EPUB/DOCX/TXT/HTML/…) into a saved
 *      CoreBook (reuses the books v3 pipeline).
 *   2. Library  — list saved CoreBooks with a per-language completeness bar.
 *   3. Enrich   — Add a language (ONE batched AI translation of hundreds of
 *      sentences, not one-by-one) / Fill audio locally (TTS) for chosen langs.
 *   4. Submit   — push to laravel_main, whole OR partial (a partial submit files
 *      assist requests so the task-queue finishes the rest).
 *
 * Local React state only; every call is guarded and the UI never crashes when
 * the backend (:59000) is offline. English copy is centralized in `L` (the
 * pycore-manager pages have no `t` object); zh kept as comments.
 *
 * Canonical spec: development-guides/COREBOOK_FORMAT_SPECIFICATION.md.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked, RefreshCw, Plus, Trash2, Languages, Volume2, UploadCloud,
  WifiOff, Sparkles, Loader2, CheckCircle2, AlertTriangle, FileText, Layers,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  CoreBookSummary, CoreBookMissing, CoreBookCompletenessLang,
  CoreBookEnrichResponse, CoreBookSubmitResponse,
} from '@/apps/pycore-manager/api';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../../core/i18n/supportedLearningLanguages';

// i18n labels (single source; the pages use literals, not a `t` object).
const L = {
  title: 'CoreBook',                                 // 书册
  subtitle: 'One book, many chapters, many languages. Convert a document, add a language with AI, fill audio, then submit to Laravel — whole or partial.',
  offline: 'Pycore backend offline — start it to manage CoreBooks.',
  refresh: 'Refresh',                                // 刷新
  // convert
  convert: 'Convert a document',                     // 转换文档
  convertHint: 'Enter an absolute document path (PDF / EPUB / DOCX / TXT / HTML / MD …). It becomes a CoreBook with chapters + sentences.',
  path: 'Document path',                             // 文档路径
  primary: 'Primary language',                       // 主语言
  build: 'Convert',                                  // 转换
  building: 'Converting…',                            // 转换中…
  convertDone: 'CoreBook created',                   // 已创建书册
  convertFailed: 'Convert failed',                   // 转换失败
  enterPath: 'Enter a document path first',
  // library
  library: 'Library',                                // 书库
  noBooks: 'No CoreBooks yet — convert a document above.',
  chapters: 'chapters',                              // 章
  sentences: 'sentences',                            // 句
  completeness: 'Completeness',                      // 完整度
  text: 'text',                                       // 文本
  audio: 'audio',                                     // 音频
  // enrich
  enrich: 'Enrich',                                  // 增补
  addLanguage: 'Add language',                       // 增加语言
  addLanguageHint: 'Translate the whole book into one more language in big batched AI calls (hundreds of sentences per request).',
  fillAudio: 'Fill audio',                           // 补全音频
  fillAudioHint: 'Generate per-sentence audio locally (TTS) for the checked languages.',
  target: 'Target language',                         // 目标语言
  run: 'Run',                                         // 执行
  running: 'Working…',                                // 处理中…
  pickTarget: 'Pick a target language',
  pickAudioLangs: 'Check at least one language',
  // submit
  submit: 'Submit to Laravel',                       // 提交到 Laravel
  submitWhole: 'Submit (with audio)',                // 完整提交
  submitPartial: 'Submit + request assist',          // 提交并请求协助
  submitPartialHint: 'Submit what is ready and file assist requests for the missing languages / audio so the task-queue finishes them.',
  submitting: 'Submitting…',                          // 提交中…
  submitDone: 'Submitted to Laravel',                // 已提交
  submitFailed: 'Submit failed',                     // 提交失败
  // delete
  remove: 'Delete CoreBook',                         // 删除书册
  confirmRemove: 'Delete this CoreBook bundle (json + audio)?',
  missingNone: 'Complete — nothing missing.',         // 已完整
  missingLanguage: 'missing language',               // 缺语言
  missingAudio: 'missing audio',                     // 缺音频
};

const langName = (code: string): string => {
  const l = SUPPORTED_LEARNING_LANGUAGES.find((x) => x.code === code);
  return l ? `${l.name} (${code})` : code;
};

type Busy = '' | 'convert' | 'add' | 'audio' | 'submit-whole' | 'submit-partial' | 'delete';

/**
 * PcCoreBookPanel — the full CoreBook engine UI (library / convert / enrich /
 * submit), embeddable.
 *
 * `embedded` omits the big page-level `<h1>CoreBook</h1>` + subtitle (the host
 * section provides its own heading) but keeps the Refresh control and ALL
 * functionality. Non-embedded it is the standalone page body.
 */
export const PcCoreBookPanel: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [books, setBooks] = useState<CoreBookSummary[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>('');
  const [note, setNote] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  // convert form
  const [path, setPath] = useState('');
  const [primary, setPrimary] = useState('en');

  // enrich form
  const [target, setTarget] = useState('zh');
  const [audioLangs, setAudioLangs] = useState<string[]>([]);

  const current = useMemo(
    () => books.find((b) => b.source_key === selected) || null,
    [books, selected]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pycoreApi.corebookList();
      setOffline(false);
      const items = r?.items || [];
      setBooks(items);
      if (!items.find((b) => b.source_key === selected)) {
        setSelected(items[0]?.source_key || null);
      }
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { void reload(); }, [reload]);

  // Keep the enrich forms in step with the selected book's languages.
  useEffect(() => {
    if (!current) return;
    setAudioLangs(current.selected_languages || []);
  }, [current?.source_key]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (kind: 'ok' | 'err' | 'info', text: string) => {
    setNote({ kind, text });
    window.setTimeout(() => setNote(null), 6000);
  };

  const doConvert = async () => {
    const p = path.trim();
    if (!p) { flash('err', L.enterPath); return; }
    setBusy('convert');
    try {
      const r = await pycoreApi.corebookConvert({
        path: p, language: primary, languages: [primary], source_type: 'book',
      });
      if (r?.success && r.summary) {
        flash('ok', L.convertDone);
        setPath('');
        await reload();
        setSelected(r.summary.source_key || null);
      } else {
        flash('err', `${L.convertFailed}: ${r?.error || ''}`);
      }
    } catch {
      flash('err', L.convertFailed);
    } finally {
      setBusy('');
    }
  };

  const afterEnrich = (r: CoreBookEnrichResponse, okMsg: string, failMsg: string) => {
    if (r?.summary) {
      setBooks((prev) => prev.map((b) => (b.source_key === r.summary!.source_key ? r.summary! : b)));
    }
    if (r?.success) flash('ok', okMsg);
    else flash('err', `${failMsg}: ${r?.error || JSON.stringify(r?.result || {}).slice(0, 120)}`);
  };

  const doAddLanguage = async () => {
    if (!current) return;
    if (!target) { flash('err', L.pickTarget); return; }
    setBusy('add');
    try {
      const r = await pycoreApi.corebookAddLanguage({
        source_key: current.source_key!, target_language: target,
      });
      afterEnrich(r, `${L.addLanguage}: ${langName(target)} ✓`, L.convertFailed);
    } catch {
      flash('err', L.convertFailed);
    } finally {
      setBusy('');
    }
  };

  const doFillAudio = async () => {
    if (!current) return;
    if (!audioLangs.length) { flash('err', L.pickAudioLangs); return; }
    setBusy('audio');
    try {
      const r = await pycoreApi.corebookFillAudio({
        source_key: current.source_key!, languages: audioLangs,
      });
      afterEnrich(r, `${L.fillAudio} ✓`, L.convertFailed);
    } catch {
      flash('err', L.convertFailed);
    } finally {
      setBusy('');
    }
  };

  const doSubmit = async (partial: boolean) => {
    if (!current) return;
    setBusy(partial ? 'submit-partial' : 'submit-whole');
    try {
      const r: CoreBookSubmitResponse = await pycoreApi.corebookSubmit({
        source_key: current.source_key!, upload_audio: true, request_assist: partial,
      });
      if (r?.success) flash('ok', L.submitDone);
      else flash('err', `${L.submitFailed}: ${r?.error || JSON.stringify(r?.result || {}).slice(0, 160)}`);
    } catch {
      flash('err', L.submitFailed);
    } finally {
      setBusy('');
    }
  };

  const doDelete = async (key: string) => {
    if (!window.confirm(L.confirmRemove)) return;
    setBusy('delete');
    try {
      await pycoreApi.corebookDelete(key);
      if (selected === key) setSelected(null);
      await reload();
    } catch {
      flash('err', L.submitFailed);
    } finally {
      setBusy('');
    }
  };

  const toggleAudioLang = (code: string) =>
    setAudioLangs((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <div className="space-y-6">
      {/* Header — full page title when standalone; embedded mode keeps only the
          Refresh control (the host section supplies the heading). */}
      <div className={`flex items-start gap-3 flex-wrap ${embedded ? 'justify-end' : 'justify-between'}`}>
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-amber-400" /> {L.title}
            </h1>
            <p className="text-zinc-500 text-sm mt-1 max-w-2xl">{L.subtitle}</p>
          </div>
        )}
        <button
          onClick={() => void reload()}
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-zinc-200 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {L.refresh}
        </button>
      </div>

      {note && (
        <div className={`rounded-lg px-3 py-2 text-sm border flex items-center gap-2 ${
          note.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : note.kind === 'err' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'}`}>
          {note.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" />
            : note.kind === 'err' ? <AlertTriangle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {note.text}
        </div>
      )}

      {offline && (
        <div className="rounded-lg px-3 py-2 text-sm border bg-amber-500/10 border-amber-500/30 text-amber-300 flex items-center gap-2">
          <WifiOff className="w-4 h-4" /> {L.offline}
        </div>
      )}

      {/* Convert */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2 text-zinc-100">
          <FileText className="w-4 h-4 text-amber-400" /> {L.convert}
        </h2>
        <p className="text-xs text-zinc-500">{L.convertHint}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={L.path}
            className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
          />
          <select
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-zinc-100 outline-none"
            title={L.primary}
          >
            {SUPPORTED_LEARNING_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
            ))}
          </select>
          <button
            onClick={() => void doConvert()}
            disabled={busy === 'convert'}
            className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {busy === 'convert' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {busy === 'convert' ? L.building : L.build}
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Library */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
          <h2 className="font-semibold flex items-center gap-2 text-zinc-100">
            <Layers className="w-4 h-4 text-amber-400" /> {L.library}
            <span className="text-xs text-zinc-500 font-mono">{books.length}</span>
          </h2>
          {books.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">{L.noBooks}</p>
          ) : (
            <div className="space-y-2">
              {books.map((b) => (
                <button
                  key={b.source_key}
                  onClick={() => setSelected(b.source_key || null)}
                  className={`w-full text-left rounded-lg border p-3 cursor-pointer transition-colors ${
                    selected === b.source_key
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-100 truncate">{b.title || b.source_key}</span>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      {b.chapter_count} {L.chapters} · {b.slot_count} {L.sentences}
                    </span>
                  </div>
                  <CompletenessBar summary={b} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Detail / enrich / submit */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
          {!current ? (
            <p className="text-sm text-zinc-500 py-6 text-center">{L.noBooks}</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-zinc-100 truncate">{current.title}</h2>
                  <p className="text-[11px] font-mono text-zinc-500 truncate">{current.source_key}</p>
                </div>
                <button
                  onClick={() => current.source_key && void doDelete(current.source_key)}
                  className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer shrink-0"
                  title={L.remove}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <MissingList missing={current.completeness?.missing || []} />

              {/* Add language */}
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <Languages className="w-4 h-4 text-sky-400" /> {L.addLanguage}
                </div>
                <p className="text-xs text-zinc-500">{L.addLanguageHint}</p>
                <div className="flex gap-2">
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-zinc-100 outline-none"
                  >
                    {SUPPORTED_LEARNING_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => void doAddLanguage()}
                    disabled={busy === 'add'}
                    className="px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {busy === 'add' ? L.running : L.run}
                  </button>
                </div>
              </div>

              {/* Fill audio */}
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <Volume2 className="w-4 h-4 text-emerald-400" /> {L.fillAudio}
                </div>
                <p className="text-xs text-zinc-500">{L.fillAudioHint}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(current.selected_languages || []).map((code) => (
                    <button
                      key={code}
                      onClick={() => toggleAudioLang(code)}
                      className={`px-2.5 py-1 rounded-full text-xs border cursor-pointer ${
                        audioLangs.includes(code)
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                          : 'bg-white/5 border-white/10 text-zinc-400'}`}
                    >
                      {langName(code)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => void doFillAudio()}
                  disabled={busy === 'audio'}
                  className="px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {busy === 'audio' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                  {busy === 'audio' ? L.running : L.run}
                </button>
              </div>

              {/* Submit */}
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <UploadCloud className="w-4 h-4 text-amber-400" /> {L.submit}
                </div>
                <p className="text-xs text-zinc-500">{L.submitPartialHint}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => void doSubmit(false)}
                    disabled={busy === 'submit-whole'}
                    className="flex-1 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'submit-whole' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {busy === 'submit-whole' ? L.submitting : L.submitWhole}
                  </button>
                  <button
                    onClick={() => void doSubmit(true)}
                    disabled={busy === 'submit-partial'}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'submit-partial' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListedIcon />}
                    {busy === 'submit-partial' ? L.submitting : L.submitPartial}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

/** Thin standalone page wrapper (kept so direct references don't break). */
const PcCoreBookPage: React.FC = () => <PcCoreBookPanel />;

const ListedIcon: React.FC = () => <Plus className="w-4 h-4" />;

/** Per-language text/audio completeness bars for one CoreBook. */
const CompletenessBar: React.FC<{ summary: CoreBookSummary }> = ({ summary }) => {
  const langs: Record<string, CoreBookCompletenessLang> = summary.completeness?.languages || {};
  const total = Math.max(1, ...Object.values(langs).map((c) => c.text || 0));
  const codes = summary.selected_languages || Object.keys(langs);
  return (
    <div className="mt-2 space-y-1">
      {codes.map((code) => {
        const c = langs[code] || { text: 0, audio: 0 };
        return (
          <div key={code} className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-zinc-500 w-7 shrink-0">{code}</span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden flex">
              <div className="h-full bg-sky-500/50" style={{ width: `${(c.text / total) * 100}%` }} title={`${L.text}: ${c.text}`} />
            </div>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden flex">
              <div className="h-full bg-emerald-500/50" style={{ width: `${(c.audio / total) * 100}%` }} title={`${L.audio}: ${c.audio}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** The actionable gap list (= the Task Center assist menu). */
const MissingList: React.FC<{ missing: CoreBookMissing[] }> = ({ missing }) => {
  if (!missing.length) {
    return (
      <div className="text-xs text-emerald-300 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> {L.missingNone}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {missing.map((m, i) => (
        <span
          key={`${m.kind}-${m.language}-${i}`}
          className="px-2 py-0.5 rounded-full text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-300"
        >
          {m.kind === 'language' ? L.missingLanguage : L.missingAudio}: {langName(m.language)} ({m.count})
        </span>
      ))}
    </div>
  );
};

export default PcCoreBookPage;
