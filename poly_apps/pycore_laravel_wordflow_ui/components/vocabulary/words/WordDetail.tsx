import React, { useEffect } from 'react';
import { Play, RefreshCw, Volume2, Languages, CheckCircle } from 'lucide-react';

/**
 * Presentational per-word detail cluster extracted from VocabularyLearning.
 * Renders the full detail panel shown under an expanded dictionary-word row:
 * one-click actions, translations / audio / phonetics / details JSON / images,
 * the metadata column and the lazy-loaded example sentences.
 *
 * ALL state and side-effecting handlers live in the container and arrive via
 * props; this component performs no fetching of its own beyond invoking the
 * passed `loadWordSentences` from a mount effect.
 */
export interface WordDetailProps {
  /** The word row to render. */
  row: any;
  /** Cached example sentences keyed by word content. */
  sentenceCache: Record<string, { loading: boolean; error: string | null; sentences: any[] }>;
  /** Per-sentence audio-resolve state keyed by `${language}|${text}`. */
  sentenceAudioState: Record<string, { resolving: boolean; queued: boolean; url: string | null }>;
  /** Per-row one-click action pending flags: `${action}:${content}`. */
  wordActionPending: Set<string>;
  /** Lazy-load example sentences for a word (cached by content). */
  loadWordSentences: (content: string, language?: string) => void;
  /** Resolve and play a sentence's audio. */
  playSentenceAudio: (sentence: any, language: string) => void;
  /** Play a word's pronunciation audio from a URL. */
  playWordAudio: (url: string, label?: string) => void;
  /** Build the per-sentence audio-state key. */
  sentenceAudioKey: (text: string, language: string) => string;
  /** True while the given one-click action is in flight for the given word. */
  isWordActionPending: (action: 'translate' | 'audio' | 'revalidate', content: string) => boolean;
  /** One-click "Re-translate" handler. */
  handleReTranslateWord: (content: string, language?: string) => void;
  /** One-click "Add / refresh audio" handler. */
  handleAddAudioWord: (row: any, language?: string) => void;
  /** One-click "Revalidate" handler. */
  handleRevalidateWord: (row: any, language?: string) => void;
  /** Resolve the active drill language. */
  drillLanguage: () => string;
  /** Format a (possibly nullish) number for display. */
  nf: (n: number | undefined | null) => string;
}

/** Pretty render of word_details JSON (definitions / examples / POS) when present. */
const renderWordDetailsJson = (wd: any): React.ReactNode => {
  if (wd == null) return null;
  let parsed: any = wd;
  if (typeof wd === 'string') {
    try {
      parsed = JSON.parse(wd);
    } catch {
      // Not JSON — show as plain text.
      return <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{wd}</p>;
    }
  }
  if (parsed == null || (typeof parsed !== 'object')) {
    return <p className="text-xs text-slate-600 dark:text-slate-300">{String(parsed)}</p>;
  }
  // Try common shapes: { definitions: [...], examples: [...], pos / part_of_speech }.
  const defs: any[] = Array.isArray(parsed.definitions) ? parsed.definitions : [];
  const examples: any[] = Array.isArray(parsed.examples) ? parsed.examples : [];
  const pos = parsed.pos || parsed.part_of_speech || parsed.partOfSpeech;
  const hasKnownShape = defs.length > 0 || examples.length > 0 || pos;
  if (hasKnownShape) {
    return (
      <div className="space-y-1.5">
        {pos && (
          <div className="text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">POS: </span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{String(pos)}</span>
          </div>
        )}
        {defs.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Definitions</div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-700 dark:text-slate-200">
              {defs.map((d, i) => (
                <li key={i}>{typeof d === 'string' ? d : (d?.text || d?.definition || JSON.stringify(d))}</li>
              ))}
            </ul>
          </div>
        )}
        {examples.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Examples</div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-600 dark:text-slate-300 italic">
              {examples.map((ex, i) => (
                <li key={i}>{typeof ex === 'string' ? ex : (ex?.text || JSON.stringify(ex))}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  // Unknown object shape — pretty-print the JSON gracefully.
  return (
    <pre className="text-[11px] leading-snug text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/60 rounded p-2 overflow-auto max-h-48">
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
};

/** Full per-word detail panel shown under an expanded dictionary-word row. */
const WordDetail: React.FC<WordDetailProps> = ({
  row: r,
  sentenceCache,
  sentenceAudioState,
  wordActionPending,
  loadWordSentences,
  playSentenceAudio,
  playWordAudio,
  sentenceAudioKey,
  isWordActionPending,
  handleReTranslateWord,
  handleAddAudioWord,
  handleRevalidateWord,
  drillLanguage,
  nf,
}) => {
  // `wordActionPending` is threaded through so this component re-renders when a
  // pending flag flips (the boolean values are read via isWordActionPending).
  void wordActionPending;

  /** Example-sentences block for a word's detail panel (presentational only). */
  const renderWordSentences = (content: string, language?: string): React.ReactNode => {
    const state = sentenceCache[content];
    return (
      <div>
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Example sentences</div>
        {!state || state.loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading sentences...
          </div>
        ) : state.error ? (
          <p className="text-xs text-rose-500 dark:text-rose-400">{state.error}</p>
        ) : state.sentences.length === 0 ? (
          <p className="text-xs text-slate-400">No sentences found.</p>
        ) : (
          <ul className="space-y-2">
            {state.sentences.map((s: any, i: number) => (
              <li key={s.id ?? i} className="rounded-lg bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 px-2.5 py-2">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-xs text-slate-700 dark:text-slate-200">{s.text}</p>
                  {(() => {
                    const lng = language || drillLanguage();
                    const audioState = sentenceAudioState[sentenceAudioKey(s.text, lng)];
                    const resolving = !!audioState?.resolving;
                    const queued = !!audioState?.queued;
                    return (
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {queued && (
                          <span className="text-[10px] text-amber-500 dark:text-amber-400" title="Audio is being generated by the worker">
                            generating…
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => playSentenceAudio(s, lng)}
                          disabled={resolving}
                          className="inline-flex items-center justify-center rounded-full p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                          title={s.audio ? 'Play sentence audio' : 'Resolve and play sentence audio'}
                        >
                          {resolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })()}
                </div>
                {s.explanation && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{s.explanation}</p>
                )}
                {s.grammar && (
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">Grammar: </span>{s.grammar}
                  </p>
                )}
                {s.special_usage && (
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">Usage: </span>{s.special_usage}
                  </p>
                )}
                {s.ai_commentary && (
                  <p className="mt-0.5 text-[11px] italic text-slate-400">{s.ai_commentary}</p>
                )}
                {typeof s.occurrence_count === 'number' && s.occurrence_count > 0 && (
                  <p className="mt-0.5 text-[10px] text-slate-400">Seen {s.occurrence_count}×</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  /**
   * Example-sentences block for a word's detail panel. Mounting (i.e. the row's
   * detail expanding) triggers a one-time lazy fetch via useEffect; the result
   * is cached so collapse/re-expand is instant and no fetch fires during render.
   */
  const WordSentences: React.FC<{ content: string; language?: string }> = ({ content, language }) => {
    useEffect(() => {
      loadWordSentences(content, language);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, language]);
    return <>{renderWordSentences(content, language)}</>;
  };

  /** One-click action row (Re-translate / Add audio) for a word's detail panel. */
  const renderWordActions = (r: any): React.ReactNode => {
    const content: string = r.content;
    const lng = r.language || drillLanguage();
    const translating = isWordActionPending('translate', content);
    const audioPending = isWordActionPending('audio', content);
    const revalidating = isWordActionPending('revalidate', content);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleReTranslateWord(content, lng)}
          disabled={translating}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {translating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
          Re-translate
        </button>
        <button
          type="button"
          onClick={() => handleAddAudioWord(r, lng)}
          disabled={audioPending}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {audioPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
          Add / refresh audio
        </button>
        {r.is_valid === false && (
          <button
            type="button"
            onClick={() => handleRevalidateWord(r, lng)}
            disabled={revalidating}
            title={r.validity_source ? `Invalid (${r.validity_source}) — re-enable for translation` : 'Re-enable for translation'}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {revalidating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Revalidate
          </button>
        )}
      </div>
    );
  };

  const translations: string[] = Array.isArray(r.translations) ? r.translations : [];
  const images: any[] = Array.isArray(r.image_files) ? r.image_files : [];
  const imageUrl = (img: any): string | null => {
    if (typeof img === 'string') return img;
    if (img && typeof img === 'object') return img.url || img.path || img.src || null;
    return null;
  };
  const Field = ({ label, value }: { label: string; value: React.ReactNode }) =>
    value == null || value === '' ? null : (
      <div className="flex gap-2 text-[11px]">
        <span className="text-slate-500 dark:text-slate-400 min-w-[5.5rem] flex-shrink-0">{label}</span>
        <span className="text-slate-700 dark:text-slate-200 break-words">{value}</span>
      </div>
    );
  return (
    <div className="space-y-4">
    {/* One-click actions (Re-translate / Add audio) */}
    {renderWordActions(r)}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: meaning + audio + phonetics */}
      <div className="space-y-3">
        <div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Translations</div>
          {translations.length ? (
            <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-700 dark:text-slate-200">
              {translations.map((tr, i) => (
                <li key={i}>{tr}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No translation.</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          {r.us_phonetic && (
            <span className="font-mono text-slate-600 dark:text-slate-300">US {r.us_phonetic}</span>
          )}
          {r.uk_phonetic && (
            <span className="font-mono text-slate-600 dark:text-slate-300">UK {r.uk_phonetic}</span>
          )}
          {r.phonetic && !r.us_phonetic && !r.uk_phonetic && (
            <span className="font-mono text-slate-600 dark:text-slate-300">{r.phonetic}</span>
          )}
        </div>
        {r.audio_url && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => playWordAudio(r.audio_url as string, r.content)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" /> Play audio
            </button>
            <audio controls src={r.audio_url} className="h-8 max-w-[14rem]" />
          </div>
        )}
        {r.word_details != null && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Details</div>
            {renderWordDetailsJson(r.word_details)}
          </div>
        )}
        {images.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Images</div>
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => {
                const u = imageUrl(img);
                return u ? (
                  <img key={i} src={u} alt={`${r.content} ${i + 1}`} className="w-16 h-16 object-cover rounded border border-slate-200 dark:border-slate-700" />
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
      {/* Right: metadata */}
      <div className="space-y-1.5">
        <Field label="Valid" value={r.is_valid ? 'Yes' : 'No'} />
        <Field label="Validity note" value={r.validity_note} />
        <Field label="Validity src" value={r.validity_source} />
        <Field label="Checked at" value={r.validity_checked_at} />
        <Field label="Translation" value={r.translation_provider} />
        <Field label="TTS provider" value={r.tts_provider} />
        <Field label="Image" value={r.image_provider} />
        <Field label="TTS status" value={r.tts_status} />
        <Field label="TTS attempts" value={typeof r.tts_attempts === 'number' ? String(r.tts_attempts) : null} />
        <Field
          label="TTS error"
          value={r.tts_error ? <span className="text-rose-600 dark:text-rose-400">{r.tts_error}</span> : null}
        />
        <Field label="Queries" value={typeof r.query_count === 'number' ? nf(r.query_count) : null} />
        <Field label="Last modified" value={r.last_modified} />
        <Field label="Last query" value={r.last_query_time} />
        <Field label="MD5" value={r.md5 ? <span className="font-mono">{r.md5}</span> : null} />
      </div>
    </div>
    {/* Example sentences (lazy-loaded on expand) */}
    <WordSentences content={r.content} language={r.language} />
    </div>
  );
};

export default WordDetail;
