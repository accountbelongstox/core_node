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
 *
 * All strings are English (zh kept as inline comments, matching the pycore-manager
 * page convention).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText, UploadCloud, RefreshCw, Languages, Lock, Library,
  Type, Hash, AlignLeft, Eye, EyeOff, Trash2, BookOpen,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { BookTextStats, BookFileAnalysis } from '../../../core/api-libs/pycore';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../../core/i18n/supportedLearningLanguages';

const L = {
  title: 'Add Document',                              // 添加文档
  subtitle: 'Upload a document or plain-text file, analyze it, then ingest it into the shared sentence library as a document source.',
  upload: 'Upload document',                          // 上传文档
  uploading: 'Uploading…',                            // 上传中…
  dropHere: 'Drop a document here, or use the Upload button.',
  languages2: 'Languages',                            // 语言
  languagesHint: 'Pick the languages to build a correspondence for. The detected primary language is checked and locked.',
  needOneLang: 'Select at least one language',        // 至少选择一种语言
  primaryLang: 'Primary (locked)',                    // 主语言(锁定)
  selectedCount: 'selected',                          // 已选
  analyzed: 'Analyzed documents',                     // 已分析文档
  none: 'No documents analyzed yet.',                 // 暂无文档
  ingest: 'Ingest to library',                        // 入库
  ingesting: 'Ingesting…',                            // 入库中…
  ingestDone: 'Ingested to library',                  // 已入库
  ingestFailed: 'Ingest failed',                      // 入库失败
  analyzeFailed: 'Analyze failed',                    // 分析失败
  words: 'Words',                                     // 词数
  uniqueWords: 'Unique words',                        // 不重复词数
  sentences: 'Sentences',                             // 句子数
  characters: 'Characters',                           // 字符数
  langs: 'Languages',                                 // 多语言
  showPreview: 'Preview',                             // 预览
  hidePreview: 'Hide',                                // 收起
  remove: 'Remove',                                   // 移除
  noText: 'no extractable text',                      // 无可提取文本
};

const nf = (n: number | undefined | null) => (typeof n === 'number' ? n.toLocaleString() : '0');

interface DocEntry { path: string; analysis: BookFileAnalysis; }

const PcAddDocumentView: React.FC = () => {
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
    if (!langs.length) { setNotice(L.needOneLang); return; }
    setUploading(true);
    setNotice(null);
    try {
      const r = await pycoreApi.booksAnalyzeUpload(files, {
        languages: langs, preview_chars: 1200, persist: true, source_type: 'document',
      });
      if (!r || !r.success) { setNotice(`${L.analyzeFailed}${r?.error ? ': ' + r.error : ''}`); return; }
      let added = 0;
      const errs: string[] = [];
      r.files.forEach((f) => {
        if (!f.path) { errs.push(`${f.name}: ${f.error || 'skipped'}`); return; }
        setDocs((prev) => (prev.some((d) => d.path === f.path) ? prev : [{ path: f.path, analysis: f }, ...prev]));
        added += 1;
      });
      setNotice(`${added} uploaded${errs.length ? ` · ${errs.length} skipped (${errs.join('; ')})` : ''}`);
    } catch (e: any) {
      setNotice(`${L.analyzeFailed}: ${e?.message || 'upload failed'}`);
    } finally {
      setUploading(false);
    }
  }, [selectedLangList]);

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
    if (!langs.length) { setNotice(L.needOneLang); return; }
    if (ingesting.has(path)) return;
    setIngesting((prev) => new Set(prev).add(path));
    setNotice(null);
    try {
      const r = await pycoreApi.booksSubmit([path], undefined, langs, 'document');
      if (!r || !r.success) {
        const errs = (r?.items || []).flatMap((it) => it.errors || []);
        setNotice(`${L.ingestFailed}${errs.length ? ': ' + errs.slice(0, 3).join('; ') : (r?.error ? ': ' + r.error : '')}`);
      } else {
        setNotice(`${L.ingestDone} — ${r.total_sentences} sentences · ${r.total_words} words`);
      }
    } catch (e: any) {
      setNotice(`${L.ingestFailed}: ${e?.message || 'submit failed'}`);
    } finally {
      setIngesting((prev) => { const n = new Set(prev); n.delete(path); return n; });
    }
  }, [ingesting, selectedLangList]);

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

  const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: string }> =
    ({ icon, label, value, accent }) => (
      <div className="rounded-xl p-3 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">{icon}{label}</div>
        <div className={`text-base font-bold ${accent || 'text-slate-700 dark:text-slate-200'}`}>{value}</div>
      </div>
    );

  const renderStats = (s: BookTextStats) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
      <StatTile icon={<Type className="w-3 h-3" />} label={L.words} value={nf(s.word_count)} />
      <StatTile icon={<Hash className="w-3 h-3" />} label={L.uniqueWords} value={nf(s.unique_word_count)} accent="text-indigo-500" />
      <StatTile icon={<AlignLeft className="w-3 h-3" />} label={L.sentences} value={nf(s.sentence_count)} />
      <StatTile icon={<Languages className="w-3 h-3" />} label={L.langs} value={(s.primary_language || 'und').toUpperCase()} accent="text-emerald-500" />
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="pc-glass p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <FileText className="w-5 h-5 text-rose-500" /> {L.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{L.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input ref={fileInputRef} type="file" multiple hidden onChange={onPickUpload} accept={acceptList} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading || selectedLangs.size === 0}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {uploading ? L.uploading : L.upload}
            </button>
          </div>
        </div>

        {/* language multi-select */}
        <div className="mb-4 rounded-2xl p-4 border bg-slate-100/60 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5" /> {L.languages2}
              <span className="ml-1 normal-case font-normal text-slate-400">({selectedLangs.size} {L.selectedCount})</span>
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">{L.languagesHint}</p>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_LEARNING_LANGUAGES.map((l) => {
              const on = selectedLangs.has(l.code);
              const locked = l.code === lockedLang;
              return (
                <button key={l.code} type="button" onClick={() => toggleLang(l.code)} disabled={locked}
                  title={locked ? L.primaryLang : l.name}
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
          {selectedLangs.size === 0 && <p className="mt-2 text-[11px] font-bold text-amber-500">{L.needOneLang}</p>}
        </div>

        {/* drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border border-dashed p-6 text-center text-xs transition ${
            dragOver ? 'border-rose-500/60 bg-rose-500/5 text-rose-500' : 'border-slate-300 dark:border-white/10 text-slate-500'}`}>
          <UploadCloud className="w-6 h-6 mx-auto mb-1.5 opacity-60" />
          {L.dropHere}
        </div>

        {notice && <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>}
      </section>

      {/* analyzed documents */}
      <section className="pc-glass p-6">
        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 mb-3">
          <Library className="w-4 h-4 text-rose-500" /> {L.analyzed}
        </h3>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{L.none}</p>
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
                      {busy ? L.ingesting : L.ingest}
                    </button>
                    <button onClick={() => removeDoc(path)} title={L.remove}
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
                        {showPv ? L.hidePreview : L.showPreview}
                      </button>
                      {showPv && (
                        <pre className="mt-1.5 max-h-48 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-xl p-3 bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300">
                          {analysis.error ? `(${L.noText})` : analysis.preview}
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
