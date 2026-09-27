/**
 * PcAddDocumentView — the "Add Document" sub-tab of the unified Content page.
 *
 * Upload/select a plain-text or document file → analyze it locally (words /
 * sentences / languages + preview) → ingest it into the SHARED sentence library
 * as `source_type='document'`. It deliberately reuses the EXISTING pycore local
 * Books flow rather than introducing a new HTTP layer:
 *
 *   - analyze:  pycoreApi.booksAnalyzeUpload(files, { source_type:'document' })
 *   - ingest :  pycoreApi.booksSubmit(stagedPaths, undefined, languages, 'document')
 *
 * The same language multi-select built for Books is reused here (>=1 required,
 * the detected primary language auto-checked + locked), and the checked set is
 * passed as `languages: string[]` to both calls.
 *
 * BACKEND GAP (reported, not faked): pycore's /books/analyze-upload + /books/submit
 * currently stage/ingest under source_type='book'. The FE now SENDS
 * `source_type='document'`; the backend must honor it to land these rows under
 * the document source type. Until then the ingest still succeeds but is recorded
 * as a book source. No success is faked — failures surface verbatim.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, UploadCloud, RefreshCw, Languages, Lock, Library,
  Type, Hash, AlignLeft, Eye, EyeOff, Trash2, BookOpen,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { BookTextStats, BookFileAnalysis } from '@/apps/pycore-manager/api';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../../core/i18n/supportedLearningLanguages';
import { BookStatTile, formatBookMetric as nf } from '@/shared/books/BookStats';

const L = {
  title: 'addDocument.title',
  subtitle: 'addDocument.subtitle',
  upload: 'addDocument.upload',
  uploading: 'addDocument.uploading',
  dropHere: 'addDocument.dropHere',
  languages2: 'addDocument.languages2',
  languagesHint: 'addDocument.languagesHint',
  needOneLang: 'addDocument.needOneLang',
  primaryLang: 'addDocument.primaryLang',
  selectedCount: 'addDocument.selectedCount',
  analyzed: 'addDocument.analyzed',
  none: 'addDocument.none',
  ingest: 'addDocument.ingest',
  ingesting: 'addDocument.ingesting',
  ingestDone: 'addDocument.ingestDone',
  ingestFailed: 'addDocument.ingestFailed',
  analyzeFailed: 'addDocument.analyzeFailed',
  words: 'addDocument.words',
  uniqueWords: 'addDocument.uniqueWords',
  sentences: 'addDocument.sentences',
  langs: 'addDocument.langs',
  showPreview: 'addDocument.showPreview',
  hidePreview: 'addDocument.hidePreview',
  remove: 'addDocument.remove',
  noText: 'addDocument.noText',
  uploadSummary: 'addDocument.uploadSummary',
  skippedDetail: 'addDocument.skippedDetail',
  fileSkipped: 'addDocument.fileSkipped',
  uploadFailed: 'addDocument.uploadFailed',
  ingestSummary: 'addDocument.ingestSummary',
  submitFailed: 'addDocument.submitFailed',
} as const;

interface DocEntry { path: string; analysis: BookFileAnalysis; }

const PcAddDocumentView: React.FC = () => {
  const { t } = useTranslation('pc');
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [ingesting, setIngesting] = useState<Set<string>>(new Set());
  const [openPreview, setOpenPreview] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // language multi-select (>=1; primary auto-checked + locked) — same as Books.
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(['en']));
  const [lockedLang, setLockedLang] = useState<string>('en');

  // supported formats (for the file picker accept list).
  const [supportedFormats, setSupportedFormats] = useState<string[]>([]);

  useEffect(() => {
    pycoreApi.getBooksSupportedFormats()
      .then((r) => { if (r?.success && Array.isArray(r.formats)) setSupportedFormats(r.formats); })
      .catch(() => { /* offline — accept anything */ });
  }, []);

  // Derive + lock the detected primary language (last analyzed wins).
  useEffect(() => {
    const valid = new Set(SUPPORTED_LEARNING_LANGUAGES.map((l) => l.code));
    let primary = '';
    for (const d of docs) {
      const code = d.analysis.stats?.primary_language;
      if (code && valid.has(code)) primary = code;
    }
    if (!primary) primary = 'en';
    setLockedLang(primary);
    setSelectedLangs((prev) => (prev.has(primary) ? prev : new Set(prev).add(primary)));
  }, [docs]);

  const toggleLang = useCallback((code: string) => {
    if (code === lockedLang) return;
    setSelectedLangs((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      n.add(lockedLang);
      return n;
    });
  }, [lockedLang]);
  const selectedLangList = useCallback(
    (): string[] => SUPPORTED_LEARNING_LANGUAGES.map((l) => l.code).filter((c) => selectedLangs.has(c)),
    [selectedLangs],
  );

  // --- upload + analyze (source_type='document') ------------------------- #
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const langs = selectedLangList();
    if (!langs.length) { setNotice(t(L.needOneLang)); return; }
    setUploading(true);
    setNotice(null);
    try {
      const r = await pycoreApi.booksAnalyzeUpload(files, {
        languages: langs, preview_chars: 1200, persist: true, source_type: 'document',
      });
      if (!r || !r.success) { setNotice(`${t(L.analyzeFailed)}${r?.error ? ': ' + r.error : ''}`); return; }
      let added = 0;
      const errs: string[] = [];
      r.files.forEach((f) => {
        if (!f.path) { errs.push(`${f.name}: ${f.error || t(L.fileSkipped)}`); return; }
        setDocs((prev) => (prev.some((d) => d.path === f.path) ? prev : [{ path: f.path, analysis: f }, ...prev]));
        added += 1;
      });
      setNotice(`${t(L.uploadSummary, { count: added })}${errs.length
        ? ` · ${t(L.skippedDetail, { count: errs.length, detail: errs.join('; ') })}`
        : ''}`);
    } catch (e: any) {
      setNotice(`${t(L.analyzeFailed)}: ${e?.message || t(L.uploadFailed)}`);
    } finally {
      setUploading(false);
    }
  }, [selectedLangList, t]);

  const onPickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) void uploadFiles(files);
    e.target.value = '';
  };
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length) void uploadFiles(files);
  }, [uploadFiles]);

  // --- ingest (source_type='document') ----------------------------------- #
  const ingest = useCallback(async (path: string) => {
    const langs = selectedLangList();
    if (!langs.length) { setNotice(t(L.needOneLang)); return; }
    if (ingesting.has(path)) return;
    setIngesting((prev) => new Set(prev).add(path));
    setNotice(null);
    try {
      const r = await pycoreApi.booksSubmit([path], undefined, langs, 'document');
      if (!r || !r.success) {
        const errs = (r?.items || []).flatMap((it) => it.errors || []);
        setNotice(`${t(L.ingestFailed)}${errs.length ? ': ' + errs.slice(0, 3).join('; ') : (r?.error ? ': ' + r.error : '')}`);
      } else {
        setNotice(`${t(L.ingestDone)} — ${t(L.ingestSummary, { sentences: r.total_sentences, words: r.total_words })}`);
      }
    } catch (e: any) {
      setNotice(`${t(L.ingestFailed)}: ${e?.message || t(L.submitFailed)}`);
    } finally {
      setIngesting((prev) => { const n = new Set(prev); n.delete(path); return n; });
    }
  }, [ingesting, selectedLangList, t]);

  const removeDoc = (path: string) => {
    setDocs((prev) => prev.filter((d) => d.path !== path));
    setOpenPreview((prev) => { const n = new Set(prev); n.delete(path); return n; });
  };
  const togglePreview = (path: string) =>
    setOpenPreview((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });

  const acceptList = useMemo(
    () => (supportedFormats.length ? supportedFormats.map((f) => (f.startsWith('.') ? f : `.${f}`)).join(',') : undefined),
    [supportedFormats],
  );

  const renderStats = (s: BookTextStats) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
      <BookStatTile variant="source" icon={<Type className="w-3 h-3" />} label={t(L.words)} value={nf(s.word_count)} />
      <BookStatTile variant="source" icon={<Hash className="w-3 h-3" />} label={t(L.uniqueWords)} value={nf(s.unique_word_count)} accent="text-indigo-500" />
      <BookStatTile variant="source" icon={<AlignLeft className="w-3 h-3" />} label={t(L.sentences)} value={nf(s.sentence_count)} />
      <BookStatTile variant="source" icon={<Languages className="w-3 h-3" />} label={t(L.langs)} value={(s.primary_language || 'und').toUpperCase()} accent="text-emerald-500" />
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="pc-glass p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <FileText className="w-5 h-5 text-rose-500" /> {t(L.title)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t(L.subtitle)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input ref={fileInputRef} type="file" multiple hidden onChange={onPickUpload} accept={acceptList} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading || selectedLangs.size === 0}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {uploading ? t(L.uploading) : t(L.upload)}
            </button>
          </div>
        </div>

        {/* language multi-select */}
        <div className="mb-4 rounded-2xl p-4 border bg-slate-100/60 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5" /> {t(L.languages2)}
              <span className="ml-1 normal-case font-normal text-slate-400">({t(L.selectedCount, { count: selectedLangs.size })})</span>
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">{t(L.languagesHint)}</p>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_LEARNING_LANGUAGES.map((l) => {
              const on = selectedLangs.has(l.code);
              const locked = l.code === lockedLang;
              return (
                <button key={l.code} type="button" onClick={() => toggleLang(l.code)} disabled={locked}
                  title={locked ? t(L.primaryLang) : l.name}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                    on
                      ? 'border-rose-500/60 bg-rose-500/10 text-rose-500'
                      : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-300'
                  } ${locked ? 'cursor-default opacity-90' : ''}`}>
                  <span className="font-mono uppercase">{l.code}</span>
                  <span className="font-normal opacity-80">{l.name}</span>
                  {locked && <Lock className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
          {selectedLangs.size === 0 && <p className="mt-2 text-[11px] font-bold text-amber-500">{t(L.needOneLang)}</p>}
        </div>

        {/* drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border border-dashed p-6 text-center text-xs transition ${
            dragOver ? 'border-rose-500/60 bg-rose-500/5 text-rose-500' : 'border-slate-300 dark:border-white/10 text-slate-500'}`}>
          <UploadCloud className="w-6 h-6 mx-auto mb-1.5 opacity-60" />
          {t(L.dropHere)}
        </div>

        {notice && <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>}
      </section>

      {/* analyzed documents */}
      <section className="pc-glass p-6">
        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 mb-3">
          <Library className="w-4 h-4 text-rose-500" /> {t(L.analyzed)}
        </h3>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t(L.none)}</p>
        ) : (
          <ul className="space-y-3">
            {docs.map(({ path, analysis }) => {
              const busy = ingesting.has(path);
              const showPv = openPreview.has(path);
              const name = analysis.name || path.split(/[\\/]/).pop() || path;
              return (
                <li key={path} className="rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={path}>{name}</span>
                    <button onClick={() => ingest(path)} disabled={busy || selectedLangs.size === 0}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed">
                      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                      {busy ? t(L.ingesting) : t(L.ingest)}
                    </button>
                    <button onClick={() => removeDoc(path)} title={t(L.remove)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {analysis.stats && renderStats(analysis.stats)}

                  {(analysis.preview || analysis.error) && (
                    <div className="mt-2">
                      <button onClick={() => togglePreview(path)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-400">
                        {showPv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showPv ? t(L.hidePreview) : t(L.showPreview)}
                      </button>
                      {showPv && (
                        <pre className="mt-1.5 max-h-48 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-xl p-3 bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300">
                          {analysis.error ? `(${t(L.noText)})` : analysis.preview}
                        </pre>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default PcAddDocumentView;
