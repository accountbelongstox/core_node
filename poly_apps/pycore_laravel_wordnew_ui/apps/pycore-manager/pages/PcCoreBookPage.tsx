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
 * the backend (:59000) is offline. `L` maps each label to its `pc` locale key.
 *
 * Canonical spec: development-guides/COREBOOK_FORMAT_SPECIFICATION.md.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookMarked, RefreshCw, Plus, Trash2, Languages, Volume2, UploadCloud,
  WifiOff, Sparkles, Loader2, CheckCircle2, FileText, Layers,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  CoreBookSummary, CoreBookMissing, CoreBookCompletenessLang,
  CoreBookEnrichResponse, CoreBookSubmitResponse,
} from '@/apps/pycore-manager/api';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../../core/i18n/supportedLearningLanguages';
import { notify } from '../../../shared/notify/notify';

const L = {
  title: 'coreBook.title',
  subtitle: 'coreBook.subtitle',
  offline: 'coreBook.offline',
  refresh: 'coreBook.refresh',
  convert: 'coreBook.convert',
  convertHint: 'coreBook.convertHint',
  path: 'coreBook.path',
  primary: 'coreBook.primary',
  build: 'coreBook.build',
  building: 'coreBook.building',
  convertDone: 'coreBook.convertDone',
  convertFailed: 'coreBook.convertFailed',
  enterPath: 'coreBook.enterPath',
  library: 'coreBook.library',
  noBooks: 'coreBook.noBooks',
  addLanguage: 'coreBook.addLanguage',
  addLanguageHint: 'coreBook.addLanguageHint',
  fillAudio: 'coreBook.fillAudio',
  fillAudioHint: 'coreBook.fillAudioHint',
  run: 'coreBook.run',
  running: 'coreBook.running',
  pickTarget: 'coreBook.pickTarget',
  pickAudioLangs: 'coreBook.pickAudioLangs',
  submit: 'coreBook.submit',
  submitWhole: 'coreBook.submitWhole',
  submitPartial: 'coreBook.submitPartial',
  submitPartialHint: 'coreBook.submitPartialHint',
  submitting: 'coreBook.submitting',
  submitDone: 'coreBook.submitDone',
  submitFailed: 'coreBook.submitFailed',
  remove: 'coreBook.remove',
  confirmRemove: 'coreBook.confirmRemove',
  missingNone: 'coreBook.missingNone',
  missingLanguage: 'coreBook.missingLanguage',
  missingAudio: 'coreBook.missingAudio',
  bookCounts: 'coreBook.bookCounts',
  addLanguageDone: 'coreBook.addLanguageDone',
  fillAudioDone: 'coreBook.fillAudioDone',
  textCount: 'coreBook.textCount',
  audioCount: 'coreBook.audioCount',
} as const;

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
  const { t } = useTranslation('pc');
  const [books, setBooks] = useState<CoreBookSummary[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>('');

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
    if (kind === 'ok') notify.success(text);
    else if (kind === 'err') notify.error(text);
    else notify.info(text);
  };

  const doConvert = async () => {
    const p = path.trim();
    if (!p) { flash('err', t(L.enterPath)); return; }
    setBusy('convert');
    try {
      const r = await pycoreApi.corebookConvert({
        path: p, language: primary, languages: [primary], source_type: 'book',
      });
      if (r?.success && r.summary) {
        flash('ok', t(L.convertDone));
        setPath('');
        await reload();
        setSelected(r.summary.source_key || null);
      } else {
        flash('err', `${t(L.convertFailed)}: ${r?.error || ''}`);
      }
    } catch {
      flash('err', t(L.convertFailed));
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
    if (!target) { flash('err', t(L.pickTarget)); return; }
    setBusy('add');
    try {
      const r = await pycoreApi.corebookAddLanguage({
        source_key: current.source_key!, target_language: target,
      });
      afterEnrich(r, t(L.addLanguageDone, { language: langName(target) }), t(L.convertFailed));
    } catch {
      flash('err', t(L.convertFailed));
    } finally {
      setBusy('');
    }
  };

  const doFillAudio = async () => {
    if (!current) return;
    if (!audioLangs.length) { flash('err', t(L.pickAudioLangs)); return; }
    setBusy('audio');
    try {
      const r = await pycoreApi.corebookFillAudio({
        source_key: current.source_key!, languages: audioLangs,
      });
      afterEnrich(r, t(L.fillAudioDone), t(L.convertFailed));
    } catch {
      flash('err', t(L.convertFailed));
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
      if (r?.success) flash('ok', t(L.submitDone));
      else flash('err', `${t(L.submitFailed)}: ${r?.error || JSON.stringify(r?.result || {}).slice(0, 160)}`);
    } catch {
      flash('err', t(L.submitFailed));
    } finally {
      setBusy('');
    }
  };

  const doDelete = async (key: string) => {
    if (!window.confirm(t(L.confirmRemove))) return;
    setBusy('delete');
    try {
      await pycoreApi.corebookDelete(key);
      if (selected === key) setSelected(null);
      await reload();
    } catch {
      flash('err', t(L.submitFailed));
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
              <BookMarked className="w-6 h-6 text-amber-400" /> {t(L.title)}
            </h1>
            <p className="text-zinc-500 text-sm mt-1 max-w-2xl">{t(L.subtitle)}</p>
          </div>
        )}
        <button
          onClick={() => void reload()}
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-zinc-200 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t(L.refresh)}
        </button>
      </div>


      {offline && (
        <div className="rounded-lg px-3 py-2 text-sm border bg-amber-500/10 border-amber-500/30 text-amber-300 flex items-center gap-2">
          <WifiOff className="w-4 h-4" /> {t(L.offline)}
        </div>
      )}

      {/* Convert */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2 text-zinc-100">
          <FileText className="w-4 h-4 text-amber-400" /> {t(L.convert)}
        </h2>
        <p className="text-xs text-zinc-500">{t(L.convertHint)}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={t(L.path)}
            className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
          />
          <select
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-zinc-100 outline-none"
            title={t(L.primary)}
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
            {busy === 'convert' ? t(L.building) : t(L.build)}
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Library */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
          <h2 className="font-semibold flex items-center gap-2 text-zinc-100">
            <Layers className="w-4 h-4 text-amber-400" /> {t(L.library)}
            <span className="text-xs text-zinc-500 font-mono">{books.length}</span>
          </h2>
          {books.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">{t(L.noBooks)}</p>
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
                      {t(L.bookCounts, { chapters: b.chapter_count, sentences: b.slot_count })}
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
            <p className="text-sm text-zinc-500 py-6 text-center">{t(L.noBooks)}</p>
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
                  title={t(L.remove)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <MissingList missing={current.completeness?.missing || []} />

              {/* Add language */}
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <Languages className="w-4 h-4 text-sky-400" /> {t(L.addLanguage)}
                </div>
                <p className="text-xs text-zinc-500">{t(L.addLanguageHint)}</p>
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
                    {busy === 'add' ? t(L.running) : t(L.run)}
                  </button>
                </div>
              </div>

              {/* Fill audio */}
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <Volume2 className="w-4 h-4 text-emerald-400" /> {t(L.fillAudio)}
                </div>
                <p className="text-xs text-zinc-500">{t(L.fillAudioHint)}</p>
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
                  {busy === 'audio' ? t(L.running) : t(L.run)}
                </button>
              </div>

              {/* Submit */}
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <UploadCloud className="w-4 h-4 text-amber-400" /> {t(L.submit)}
                </div>
                <p className="text-xs text-zinc-500">{t(L.submitPartialHint)}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => void doSubmit(false)}
                    disabled={busy === 'submit-whole'}
                    className="flex-1 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'submit-whole' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {busy === 'submit-whole' ? t(L.submitting) : t(L.submitWhole)}
                  </button>
                  <button
                    onClick={() => void doSubmit(true)}
                    disabled={busy === 'submit-partial'}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'submit-partial' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListedIcon />}
                    {busy === 'submit-partial' ? t(L.submitting) : t(L.submitPartial)}
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
  const { t } = useTranslation('pc');
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
              <div className="h-full bg-sky-500/50" style={{ width: `${(c.text / total) * 100}%` }} title={t(L.textCount, { count: c.text })} />
            </div>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden flex">
              <div className="h-full bg-emerald-500/50" style={{ width: `${(c.audio / total) * 100}%` }} title={t(L.audioCount, { count: c.audio })} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** The actionable gap list (= the Task Center assist menu). */
const MissingList: React.FC<{ missing: CoreBookMissing[] }> = ({ missing }) => {
  const { t } = useTranslation('pc');
  if (!missing.length) {
    return (
      <div className="text-xs text-emerald-300 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> {t(L.missingNone)}
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
          {t(m.kind === 'language' ? t(L.missingLanguage) : t(L.missingAudio))}: {langName(m.language)} ({m.count})
        </span>
      ))}
    </div>
  );
};

export default PcCoreBookPage;
