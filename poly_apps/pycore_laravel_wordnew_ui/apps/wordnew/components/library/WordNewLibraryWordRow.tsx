/**
 * WordNewLibraryWordRow - one row of the library word table. Mirrors
 * WordNewBookReaderVerseRow: three-state audio icon, multi-audio variant picker,
 * click-to-play (routed through WordNewLibraryPlayback), expandable detail.
 */
import React from 'react';
import {
  ChevronDown, ChevronUp, Image as ImageIcon, BookOpen, Volume2, Languages,
} from 'lucide-react';
import type { WfNewLibraryWord, WfNewWordMedia, WordNewAudioFileVariant } from '../../api';
import type { ElementTheme } from '../../WfNewTypes';
import { WordNewAudioStatusIcon } from '../WordNewAudioStatusIcon';
import { WordNewAudioVariantPicker } from '../WordNewAudioVariantPicker';
import { WfNewLoadingDots } from '../WfNewLoadingDots';
import { ttsStatusToCellState, type WordNewAudioCellState } from '../../utils/WordNewAudioCellState';
import { pickSentenceAudioUrl, readySentenceVariants } from '../../utils/WordNewSentenceAudioPick';
import { buildWordCell } from '../../utils/WordNewLibraryWordCell';

export interface WordNewLibraryWordRowProps {
  word: WfNewLibraryWord;
  resolved: WfNewWordMedia | undefined;
  lang: string;
  open: boolean;
  /** Current playing key (`${md5||index}:${lang}`) or null. */
  playingKey: string | null;
  /** Current playback node key or null (active row highlight). */
  activeKey: string | null;
  /** Live cell-status overrides from the word-audio queue gateway. */
  cellStatuses: Record<string, WordNewAudioCellState>;
  /** Per-word selected variant key. */
  variantByKey: Record<string, string>;
  onVariantSelect: (wordKey: string, variantKey: string) => void;
  /** Click row / ready icon -> route through playback (playFrom). */
  onPlay: (word: WfNewLibraryWord) => void;
  /** Missing/queued icon click -> urgent re-bump. */
  onRetry: (word: WfNewLibraryWord) => void;
  onToggleExpand: (word: WfNewLibraryWord) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  requested: boolean;
  imagePending: boolean;
  effImages: string[];
  theme: ElementTheme;
  rowRef?: (element: HTMLElement | null) => void;
}

export const wordRowKey = (w: WfNewLibraryWord, lang: string) => `${w.md5 || w.index}:${lang}`;

const resolveRowState = (
  key: string,
  playingKey: string | null,
  cellStatuses: Record<string, WordNewAudioCellState>,
  hasAudio: boolean,
  ttsStatus: string | null | undefined,
): WordNewAudioCellState => {
  if (playingKey === key) return 'playing';
  if (hasAudio) return 'ready';
  const override = cellStatuses[key];
  if (override && override !== 'missing') return override;
  return ttsStatusToCellState(hasAudio, ttsStatus, false, false);
};

export const WordNewLibraryWordRow: React.FC<WordNewLibraryWordRowProps> = ({
  word: w, resolved, lang, open, playingKey, activeKey, cellStatuses,
  variantByKey, onVariantSelect, onPlay, onRetry, onToggleExpand, trans,
  requested, imagePending, effImages, theme, rowRef,
}) => {
  const cell = buildWordCell(w, resolved);
  const key = wordRowKey(w, lang);
  const state = resolveRowState(key, playingKey, cellStatuses, !!cell.hasAudio, cell.ttsStatus);
  const isActive = activeKey === key;
  const pickerVariants: WordNewAudioFileVariant[] = readySentenceVariants(cell);
  const selectedVariant = variantByKey[key] ?? pickSentenceAudioUrl(cell).variantKey;
  const effAudioUrl = cell.audio;

  return (
    <div
      ref={rowRef}
      id={`libword-${w.md5 || w.index}`}
      className={`px-4 py-2.5 transition cursor-pointer scroll-mt-32 ${
        isActive ? `bg-indigo-500/[0.08] ${theme.glowClass}` : 'hover:bg-white/[0.03]'
      }`}
      onClick={() => {
        if (effAudioUrl || state === 'ready' || state === 'playing') onPlay(w);
        else if (w.word?.trim()) onRetry(w);
      }}
    >
      <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[3rem_1fr_2fr_5rem] gap-3 items-center">
        <span className="text-[11px] font-mono text-zinc-600">{w.index}</span>
        {/* word + phonetic */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100 truncate">{w.word}</span>
            {!w.isValid && (
              <span className="text-[9px] font-mono text-amber-500/80 border border-amber-500/30 rounded px-1">
                {trans('library.invalid')}
              </span>
            )}
          </div>
          {(w.phonetic || w.usPhonetic) && (
            <span className="text-[10px] font-mono text-zinc-500">/{w.phonetic || w.usPhonetic}/</span>
          )}
        </div>
        {/* meaning (truncated until expanded) */}
        <div className="hidden sm:block min-w-0">
          <p className={`text-[12px] text-zinc-300 ${open ? '' : 'truncate'}`}>
            {w.translations.length > 0 ? w.translations.join('；') : (w.explanation || '-')}
          </p>
        </div>
        {/* actions */}
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {pickerVariants.length > 1 ? (
            <WordNewAudioVariantPicker
              variants={pickerVariants}
              selectedKey={selectedVariant}
              onSelect={(vk) => onVariantSelect(key, vk)}
              trans={trans}
            />
          ) : null}
          {(effAudioUrl || state !== 'none' || w.ttsStatus || requested) ? (
            <WordNewAudioStatusIcon
              state={state}
              onClick={() => {
                if (state === 'ready' || state === 'playing') onPlay(w);
                else if (w.word?.trim()) onRetry(w);
              }}
              title={trans('library.play')}
            />
          ) : null}
          {effImages.length > 0 ? (
            <span className="p-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300" title={trans('library.hasImage')}>
              <ImageIcon className="w-3.5 h-3.5" />
            </span>
          ) : imagePending ? (
            <span
              className="p-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300/80"
              title={trans('library.mediaPending')}
            >
              <WfNewLoadingDots className="text-violet-300/80" />
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onToggleExpand(w)}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 transition"
            title={trans('library.detail')}
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* expanded detail: full meaning + explanation + images */}
      {open && (
        <div className="mt-2.5 ml-8 sm:ml-12 space-y-2.5 border-l border-white/10 pl-3">
          {w.translations.length > 0 && (
            <div className="flex items-start gap-2">
              <Languages className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-[12px] text-zinc-200">{w.translations.join('；')}</p>
            </div>
          )}
          {w.explanation && (
            <div className="flex items-start gap-2">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-[12px] text-zinc-300 whitespace-pre-line">{w.explanation}</p>
            </div>
          )}
          {(w.usPhonetic || w.ukPhonetic) && (
            <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
              {w.usPhonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />US /{w.usPhonetic}/</span>}
              {w.ukPhonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />UK /{w.ukPhonetic}/</span>}
            </div>
          )}
          {effImages.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {effImages.map((src, i) => (
                <img
                  key={`${w.index}-img-${i}`}
                  src={src}
                  alt={w.word}
                  loading="lazy"
                  className="w-20 h-20 object-cover rounded-lg border border-white/10 bg-black/30"
                />
              ))}
            </div>
          ) : imagePending ? (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="w-20 h-20 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center">
                <WfNewLoadingDots size="md" className="text-violet-300/80" />
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                {trans('library.mediaPending')}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default WordNewLibraryWordRow;
