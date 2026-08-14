/**
 * WordDetailModal — view + EDIT (and create) a single dictionary word.
 *
 * Opened from the Words tab when a row is clicked / its Edit action is used, and
 * also in "create" mode for the Add-word button. Shows the full record (images,
 * audio, TTS/validity provenance, example sentences) and lets the user edit the
 * editable fields (translations, phonetics, validity + note, word_details JSON),
 * persisting via api.books.updateDictionaryWord / createDictionaryWord.
 *
 * Portal-based overlay (OVERLAY_Z.modal), matching the dashboard convention.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Save, Volume2, Image as ImageIcon, CheckCircle2, XCircle, Plus,
  Loader2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import type { DictionaryWordRow } from '@/apps/laravel-manager/api';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_BACKDROP, OVERLAY_Z } from '@/shared/styles/overlay';
import { useToast } from '../admin';
import { logError, logInfo, logSuccess } from '@/core/logstore/logStore';

interface Props {
  open: boolean;
  onClose: () => void;
  language: string;
  /** The word to view/edit; null = create mode. */
  word: DictionaryWordRow | null;
  /** Called after a successful save/create with the fresh row. */
  onSaved: (word: DictionaryWordRow) => void;
}

interface SentenceRow {
  id?: number | string;
  text: string;
  explanation?: string | null;
  audio?: string | null;
  occurrence_count?: number | null;
}

/** Resolve an image_files entry (string or {url|src|path}) to a usable src. */
const imageSrc = (item: any): string | null => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.url || item.src || item.path || null;
};

const playAudio = (url?: string | null) => {
  if (!url) return;
  try { void new Audio(url).play(); } catch { /* ignore */ }
};

const WordDetailModal: React.FC<Props> = ({ open, onClose, language, word, onSaved }) => {
  const toast = useToast();
  const isCreate = !word;

  // --- editable form state ------------------------------------------------- #
  const [content, setContent] = useState('');
  const [translations, setTranslations] = useState('');     // one per line
  const [usPhonetic, setUsPhonetic] = useState('');
  const [ukPhonetic, setUkPhonetic] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [validityNote, setValidityNote] = useState('');
  const [wordDetails, setWordDetails] = useState('');        // raw JSON text
  const [saving, setSaving] = useState(false);

  // --- example sentences (lazy) ------------------------------------------- #
  const [sentences, setSentences] = useState<SentenceRow[] | null>(null);
  const [loadingSentences, setLoadingSentences] = useState(false);

  // Seed the form whenever the target word changes / the modal opens.
  useEffect(() => {
    if (!open) return;
    setContent(word?.content ?? '');
    const tr = Array.isArray(word?.translations) ? (word!.translations as string[]) : [];
    setTranslations(tr.join('\n'));
    setUsPhonetic(word?.us_phonetic ?? '');
    setUkPhonetic(word?.uk_phonetic ?? '');
    setIsValid(word?.is_valid ?? true);
    setValidityNote(word?.validity_note ?? '');
    setWordDetails(word?.word_details ? JSON.stringify(word.word_details, null, 2) : '');
    setSentences(null);
  }, [open, word]);

  const images = useMemo(
    () => (Array.isArray(word?.image_files) ? (word!.image_files as any[]).map(imageSrc).filter(Boolean) as string[] : []),
    [word],
  );

  const loadSentences = useCallback(async () => {
    if (!word?.content) return;
    setLoadingSentences(true);
    try {
      const r = await api.books.getWordSentences({ word: word.content, language, limit: 20 });
      const list = (r.success && (r.data as any)?.sentences) ? (r.data as any).sentences : [];
      setSentences(Array.isArray(list) ? list : []);
    } catch (e: any) {
      logError('vocab', `Load sentences failed: ${e?.message || e}`);
      setSentences([]);
    } finally {
      setLoadingSentences(false);
    }
  }, [word, language]);

  const parsedTranslations = (): string[] =>
    translations.split('\n').map((s) => s.trim()).filter((s) => s !== '');

  // Validate the optional word_details JSON before saving.
  const parseWordDetails = (): { ok: boolean; value: any } => {
    const t = wordDetails.trim();
    if (t === '') return { ok: true, value: null };
    try { return { ok: true, value: JSON.parse(t) }; }
    catch { return { ok: false, value: null }; }
  };

  const save = useCallback(async () => {
    if (saving) return;
    const wd = parseWordDetails();
    if (!wd.ok) { toast.error('Word details must be valid JSON (or empty).'); return; }
    if (isCreate && content.trim() === '') { toast.error('Enter the word text first.'); return; }

    const payload = {
      language,
      translations: parsedTranslations(),
      us_phonetic: usPhonetic.trim() || null,
      uk_phonetic: ukPhonetic.trim() || null,
      is_valid: isValid,
      validity_note: validityNote.trim() || null,
      word_details: wd.value,
    };

    setSaving(true);
    const label = isCreate ? `Create word "${content.trim()}"` : `Update word "${word?.content}"`;
    logInfo('vocab', `${label}…`);
    try {
      const res = isCreate
        ? await api.books.createDictionaryWord({ ...payload, content: content.trim() })
        : await api.books.updateDictionaryWord(word!.md5, payload);
      if (res.success) {
        const saved = ((res.data as any)?.word ?? (res as any).word) as DictionaryWordRow;
        toast.success(isCreate ? 'Word created.' : 'Word updated.');
        logSuccess('vocab', `${label}: ok`);
        onSaved(saved);
        onClose();
      } else {
        toast.error(res.error || `${label} failed`);
        logError('vocab', `${label} failed: ${res.error || 'unknown'}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `${label} failed`);
      logError('vocab', `${label} failed: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }, [saving, isCreate, content, language, translations, usPhonetic, ukPhonetic, isValid, validityNote, wordDetails, word, onSaved, onClose, toast]);

  if (!open) return null;

  const inputCls = 'w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={() => { if (!saving) onClose(); }} />
        <div className="relative w-full max-w-2xl max-h-[88vh] overflow-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl">
          {/* header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                {isCreate ? 'Add word' : (word?.content || 'Word')}
                <span className="ml-2 text-xs font-normal text-slate-400 capitalize">· {language}</span>
              </h3>
              {!isCreate && (
                <p className="text-[11px] text-slate-400 font-mono truncate">md5 {word?.md5}</p>
              )}
            </div>
            <button onClick={() => { if (!saving) onClose(); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* word + status row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Word</label>
                <input className={`${inputCls} ${!isCreate ? 'opacity-70' : ''}`} value={content}
                  onChange={(e) => setContent(e.target.value)} readOnly={!isCreate}
                  placeholder="e.g. serendipity" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={() => setIsValid((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    isValid
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                  {isValid ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {isValid ? 'Valid' : 'Invalid'}
                </button>
                {word?.audio_url && (
                  <button onClick={() => playAudio(word.audio_url)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10">
                    <Volume2 className="w-4 h-4" /> Play
                  </button>
                )}
              </div>
            </div>

            {/* translations */}
            <div>
              <label className={labelCls}>Translations (one per line)</label>
              <textarea className={`${inputCls} font-mono`} rows={3} value={translations}
                onChange={(e) => setTranslations(e.target.value)} placeholder="苹果&#10;果实" />
            </div>

            {/* phonetics */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>US phonetic</label>
                <input className={inputCls} value={usPhonetic} onChange={(e) => setUsPhonetic(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>UK phonetic</label>
                <input className={inputCls} value={ukPhonetic} onChange={(e) => setUkPhonetic(e.target.value)} />
              </div>
            </div>

            {/* validity note */}
            <div>
              <label className={labelCls}>Validity note</label>
              <input className={inputCls} value={validityNote} onChange={(e) => setValidityNote(e.target.value)}
                placeholder="why this word is (in)valid" />
            </div>

            {/* word details JSON */}
            <div>
              <label className={labelCls}>Word details (JSON — definitions / POS / examples)</label>
              <textarea className={`${inputCls} font-mono text-xs`} rows={4} value={wordDetails}
                onChange={(e) => setWordDetails(e.target.value)} placeholder='{ "pos": "noun", "definitions": [...] }' />
            </div>

            {/* images */}
            {images.length > 0 && (
              <div>
                <label className={labelCls}><ImageIcon className="w-3 h-3 inline mr-1 -mt-0.5" /> Images</label>
                <div className="flex flex-wrap gap-2">
                  {images.map((src, i) => (
                    <img key={i} src={src} alt="" loading="lazy"
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ))}
                </div>
              </div>
            )}

            {/* provenance (read-only) */}
            {!isCreate && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {[
                  ['Queries', String(word?.query_count ?? 0)],
                  ['TTS', word?.tts_status || (word?.has_audio ? 'ready' : '—')],
                  ['TTS attempts', String(word?.tts_attempts ?? 0)],
                  ['Validity src', word?.validity_source || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-100 dark:bg-slate-900/50 px-2.5 py-1.5">
                    <div className="text-slate-400 uppercase tracking-wide">{k}</div>
                    <div className="font-medium text-slate-700 dark:text-slate-200 truncate" title={v}>{v}</div>
                  </div>
                ))}
                {word?.tts_error && (
                  <div className="col-span-2 sm:col-span-4 text-rose-500 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {word.tts_error}
                  </div>
                )}
              </div>
            )}

            {/* example sentences (lazy) */}
            {!isCreate && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Example sentences</label>
                  <button onClick={loadSentences} disabled={loadingSentences}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                    {loadingSentences ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {sentences === null ? 'Load' : 'Reload'}
                  </button>
                </div>
                {sentences !== null && (
                  sentences.length === 0
                    ? <p className="text-xs text-slate-400">No example sentences found.</p>
                    : (
                      <ul className="space-y-1.5 max-h-44 overflow-auto">
                        {sentences.map((s, i) => (
                          <li key={s.id ?? i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                            {s.audio && <button onClick={() => playAudio(s.audio)} className="text-indigo-500 shrink-0 mt-0.5"><Volume2 className="w-3.5 h-3.5" /></button>}
                            <span className="break-words">{s.text}{s.explanation ? <span className="text-slate-400"> — {s.explanation}</span> : null}</span>
                          </li>
                        ))}
                      </ul>
                    )
                )}
              </div>
            )}
          </div>

          {/* footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur">
            <button onClick={() => { if (!saving) onClose(); }} className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isCreate ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isCreate ? 'Create word' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default WordDetailModal;
