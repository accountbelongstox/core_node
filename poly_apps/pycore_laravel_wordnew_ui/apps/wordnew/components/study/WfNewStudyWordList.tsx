/**
 * WfNewStudyWordList — the word river of the shelf study surface (List + Review
 * modes, and the Recite mode's queue). Ports the legacy client's word boxes:
 * each row shows the word + phonetic (+ tags when not in brief mode), a gloss
 * BLURRED until tapped (reveal), a speaker, Known / Forgot marks, a favorite
 * star, and opens the word-detail modal on row click. When an `activeWordId` is
 * set (Recite mode) that row is highlighted and auto-scrolled into view.
 *
 * Two OPT-IN props (default off → unchanged shelf behavior) let the practice
 * sequential-reading surface reuse this list:
 *   - `alwaysShowTranslation`: render the gloss as plain always-visible text
 *     (no blur, no reveal button).
 *   - `onSelectWord(word, index)`: a row click calls this with the row index
 *     INSTEAD of opening the detail modal (used to move the play cursor).
 * Two more OPT-IN props serve the fullscreen arena playlist:
 *   - `jumbo`: word at 3× (text-[42px]) and gloss at 2× (text-2xl), no max-height
 *     cap (the arena overlay owns the scroll).
 *   - `readCountOf(word)`: backend-mirrored read count per word; when > 0 the
 *     speaker icon carries an emerald badge with the count (played mark).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Star, Check, RotateCcw } from 'lucide-react';
import type { Word, ElementTheme } from '../../WfNewTypes';
import { studyT } from './WfNewStudyLocales';
import { WfNewNoTranslation } from './WfNewNoTranslation';
import { useVisibleWordPriority } from '../../hooks/useVisibleWordPriority';
import { WordNewAudioStatusIcon } from '../WordNewAudioStatusIcon';
import { wordAudioQueueKey, wordTranslationQueueKey } from '../../services/WordNewQueueRuntime';

interface WfNewStudyWordListProps {
  words: Word[];
  lang: string;
  sourceLanguage: string;
  theme: ElementTheme;
  brief: boolean;
  favorites: Word[];
  activeWordId?: string | null;
  autoScroll?: boolean;
  /** Bump to force the active row into view once (exit-focus); bypasses the
   *  user-scroll suppression below. */
  scrollSignal?: number;
  alwaysShowTranslation?: boolean;
  jumbo?: boolean;
  readCountOf?: (w: Word) => number;
  emptyText: string;
  onSpeak: (w: Word) => void;
  onKnown: (w: Word) => void;
  onForgot: (w: Word) => void;
  onToggleFav: (w: Word) => void;
  onOpenDetail: (w: Word) => void;
  onSelectWord?: (w: Word, index: number) => void;
}

export const WfNewStudyWordList: React.FC<WfNewStudyWordListProps> = ({
  words,
  lang,
  sourceLanguage,
  theme,
  brief,
  favorites,
  activeWordId,
  autoScroll,
  scrollSignal = 0,
  alwaysShowTranslation = false,
  jumbo = false,
  readCountOf,
  emptyText,
  onSpeak,
  onKnown,
  onForgot,
  onToggleFav,
  onOpenDetail,
  onSelectWord,
}) => {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const bindVisiblePriority = useVisibleWordPriority(sourceLanguage, lang);
  // Last MANUAL scroll timestamp (wheel / touch). While the user is scrolling,
  // the auto-scroll must not yank the active row back to center — that fights
  // the gesture. Programmatic scrollIntoView does not trip these events.
  const lastUserScrollRef = useRef(0);

  useEffect(() => {
    if (!autoScroll) return;
    const mark = () => {
      lastUserScrollRef.current = Date.now();
    };
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('touchmove', mark, { passive: true });
    return () => {
      window.removeEventListener('wheel', mark);
      window.removeEventListener('touchmove', mark);
    };
  }, [autoScroll]);

  // Auto-scroll the active (recite) row into view — suppressed for a few
  // seconds after any manual scroll so the user's browsing is undisturbed.
  useEffect(() => {
    if (!autoScroll || !activeWordId) return;
    if (Date.now() - lastUserScrollRef.current < 3000) return;
    const el = rowRefs.current.get(activeWordId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeWordId, autoScroll]);

  // Explicit focus request (e.g. exiting the arena): always scroll, even right
  // after a manual scroll.
  useEffect(() => {
    if (!scrollSignal || !activeWordId) return;
    const el = rowRefs.current.get(activeWordId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollSignal]);

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (words.length === 0) {
    return (
      <div className="py-16 text-center text-xs font-mono text-zinc-500">{emptyText}</div>
    );
  }

  return (
    <div className={`grid grid-cols-1 ${jumbo ? 'gap-3 pr-1' : 'gap-2 max-h-[550px] overflow-y-auto pr-1 no-scrollbar'}`}>
      {words.map((word, index) => {
        const isActive = activeWordId === word.id;
        const isRevealed = revealed.has(word.id);
        const isFav = favorites.some((f) => f.id === word.id);
        const readCount = readCountOf ? readCountOf(word) : 0;
        const priorityRef = bindVisiblePriority({
          word: word.text,
          hasTranslation: word.hasTranslation ?? !!word.translation,
          hasAudio: !!word.audioUrl || (word.audioFiles?.length ?? 0) > 0,
          hasImage: false,
        });
        return (
          <div
            key={word.id}
            ref={(el) => {
              if (el) rowRefs.current.set(word.id, el);
              else rowRefs.current.delete(word.id);
              priorityRef(el);
            }}
            onClick={() => (onSelectWord ? onSelectWord(word, index) : onOpenDetail(word))}
            className={`${jumbo ? 'p-5' : 'p-4'} rounded-2xl border flex justify-between items-center group cursor-pointer transition-all ${
              isActive
                ? 'border-indigo-500/60 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                : 'border-white/5 bg-slate-900/35 hover:bg-white/5 hover:border-indigo-500/10'
            }`}
          >
            <div className="min-w-0 pr-3 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className={`font-black text-slate-200 group-hover:text-indigo-400 transition-colors ${jumbo ? 'text-[42px] leading-tight' : 'text-sm'}`}>
                  {word.text}
                </p>
                <span className={`font-mono text-zinc-500 ${jumbo ? 'text-sm' : 'text-[10px]'}`}>{word.phonetic}</span>
                {!brief &&
                  word.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-medium"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
              {/* Gloss — always-visible plain text (practice), else blurred until
                  tapped; an empty translation shows the muted no-translation marker
                  (nothing to reveal, so no blur/reveal button). */}
              {!word.translation ? (
                <span className="mt-1 flex items-center gap-1.5">
                  <WfNewNoTranslation lang={lang} />
                  <WordNewAudioStatusIcon
                    state="waiting"
                    resource="translation"
                    queueKey={wordTranslationQueueKey(word.text, sourceLanguage, lang)}
                    trans={(key) => studyT(lang, key)}
                  />
                </span>
              ) : alwaysShowTranslation ? (
                <span className={`${jumbo ? 'text-2xl' : 'text-xs'} truncate block mt-1 text-zinc-400`}>
                  {word.translation}
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleReveal(word.id);
                  }}
                  className="text-left mt-1 w-full"
                  title={studyT(lang, 'study.reveal')}
                >
                  <span
                    className={`${jumbo ? 'text-2xl' : 'text-xs'} truncate block transition-all ${
                      isRevealed ? 'text-zinc-400' : 'text-zinc-400 blur-[5px] select-none'
                    }`}
                  >
                    {word.translation}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* No animated wave icon during playback (per design request) —
                  the active-row highlight alone marks the playing word. */}
              <span className="relative">
                <WordNewAudioStatusIcon
                  state={word.audioUrl || (word.audioFiles?.length ?? 0) > 0 ? 'ready' : 'waiting'}
                  queueKey={wordAudioQueueKey(word.text, sourceLanguage)}
                  trans={(key) => studyT(lang, key)}
                  onClick={() => onSpeak(word)}
                  size="md"
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300"
                  title={studyT(lang, 'study.recite.play')}
                />
                {/* Played mark — the backend-mirrored read count; shown once the
                    word has been read/played at least once. */}
                {readCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-bold font-mono flex items-center justify-center pointer-events-none">
                    {readCount}
                  </span>
                )}
              </span>
              <button
                onClick={() => onForgot(word)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-amber-500/15 flex items-center justify-center text-amber-400"
                title={studyT(lang, 'study.markForgot')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onKnown(word)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-emerald-500/15 flex items-center justify-center text-emerald-400"
                title={studyT(lang, 'study.markKnown')}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onToggleFav(word)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
                title="★"
              >
                <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'}`} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
