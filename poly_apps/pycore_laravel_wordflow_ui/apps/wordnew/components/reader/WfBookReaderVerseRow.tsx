import React, { useEffect } from 'react';
import type { WfNewBookVerse } from '../../api';
import type { WfNewReaderDisplayMode } from '../../api/types/bookProgress';
import type { ElementTheme } from '../../WfNewTypes';
import { langCodeToBcp47 } from '../../utils/WfBookReaderA11y';
import { WfAudioStatusIcon } from '../WfAudioStatusIcon';
import { WfAudioVariantPicker } from '../WfAudioVariantPicker';
import type { WfAudioCellState } from '../../utils/WfAudioCellState';
import { cellKeyOf, ttsStatusToCellState } from '../../utils/WfAudioCellState';
import { readySentenceVariants } from '../../utils/WfSentenceAudioPick';

export interface WfBookReaderVerseRowProps {
  activeTheme: ElementTheme;
  dark?: boolean;
  verse: WfNewBookVerse;
  index: number;
  orderedDisplayLangs: string[];
  displayMode: WfNewReaderDisplayMode;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  langName: (code: string) => string;
  playingKey: string | null;
  activeVerseKey: string | null;
  cellStatuses?: Record<string, WfAudioCellState>;
  variantByLang?: Record<string, string>;
  onVariantSelect?: (lang: string, variantKey: string) => void;
  onPlay: (verse: WfNewBookVerse, lang: string) => void;
  onSectionPlay: (verse: WfNewBookVerse) => void;
  onNeedMedia: (verse: WfNewBookVerse, lang: string, text: string | null, hasAudio: boolean) => void;
  onRetryAudio: (verse: WfNewBookVerse, lang: string, text: string) => void;
}

const verseKey = (v: WfNewBookVerse) => `${v.grain}-${v.seq}`;

const resolveCellState = (
  v: WfNewBookVerse,
  lang: string,
  playingKey: string | null,
  cellStatuses: Record<string, WfAudioCellState> | undefined,
): WfAudioCellState => {
  const k = cellKeyOf(v.grain, v.seq, lang);
  if (playingKey === k) return 'playing';
  const cell = v.languages?.[lang];
  const hasAudio = !!cell?.hasAudio || !!(cell?.audioFiles?.some((f) => f.hasFile && f.url));
  if (hasAudio) return 'ready';
  const override = cellStatuses?.[k];
  if (override && override !== 'missing') return override;
  return ttsStatusToCellState(hasAudio, cell?.ttsStatus, false, false);
};

export const WfBookReaderVerseRow: React.FC<WfBookReaderVerseRowProps> = ({
  activeTheme, dark, verse: v, index, orderedDisplayLangs, displayMode, trans, langName, playingKey, activeVerseKey,
  cellStatuses, variantByLang, onVariantSelect, onPlay, onSectionPlay, onNeedMedia, onRetryAudio,
}) => {
  useEffect(() => {
    for (const lang of orderedDisplayLangs) {
      const cell = v.languages?.[lang];
      const text = cell?.text ?? null;
      const hasAudio = !!cell?.hasAudio;
      const needsTranslation = !text || !text.trim();
      const needsAudio = !!(text && text.trim()) && !hasAudio;
      if (needsTranslation || needsAudio) onNeedMedia(v, lang, text, hasAudio);
    }
  }, [v, orderedDisplayLangs, onNeedMedia]);

  const isActive = activeVerseKey === verseKey(v);
  const labelId = `verse-label-${verseKey(v)}`;

  const renderCell = (lang: string, li: number, compact?: boolean) => {
    const cell = v.languages?.[lang];
    const text = cell?.text ?? null;
    const state = resolveCellState(v, lang, playingKey, cellStatuses);
    const variantHint = cell?.audioFiles?.length
      ? cell.audioFiles.map((f) => `${f.accent || '—'}/${f.gender || '—'} (${f.provider || '?'})`).join(', ')
      : '';
    const pickerVariants = readySentenceVariants(cell ?? undefined);
    const selectedVariant = variantByLang?.[lang] ?? '';
    const bcp = langCodeToBcp47(lang);
    return (
      <div key={`${lang}-${li}`} className={`flex items-start gap-2 group ${compact ? 'py-0.5' : ''}`}>
        <span className="shrink-0 mt-1 text-[9px] font-mono uppercase text-zinc-600 w-6" title={langName(lang)} aria-hidden="true">{lang}</span>
        <p
          lang={bcp}
          data-wf-read-aloud="true"
          data-wf-read-lang={lang}
          className={`flex-1 leading-relaxed ${li === 0 && !compact ? 'text-zinc-100 text-[15px]' : 'text-zinc-400 text-sm'}`}
        >
          {text || <span className="text-zinc-700/70 italic select-none" aria-hidden="true">{' '}</span>}
        </p>
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {pickerVariants.length > 1 && onVariantSelect ? (
            <WfAudioVariantPicker
              variants={pickerVariants}
              selectedKey={selectedVariant}
              onSelect={(key) => onVariantSelect(lang, key)}
              trans={trans}
            />
          ) : null}
          <WfAudioStatusIcon
          state={text ? state : 'none'}
          disabled={!text}
          title={!text ? '' : state === 'ready' || state === 'playing'
            ? `${trans('reader.playAudio')}${variantHint ? ` · ${variantHint}` : ''}`
            : state === 'processing' ? trans('reader.audioProcessing')
              : state === 'queued' ? trans('reader.audioQueued')
                : trans('reader.retryAudio')}
          onClick={() => {
            if (state === 'ready' || state === 'playing') onPlay(v, lang);
            else if (text?.trim()) onRetryAudio(v, lang, text);
          }}
          className={state === 'ready' || state === 'playing' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}
        />
        </div>
      </div>
    );
  };

  return (
    <article
      id={`verse-${verseKey(v)}`}
      className="px-0.5 scroll-mt-24"
      aria-labelledby={labelId}
      aria-current={isActive ? 'true' : undefined}
      data-wf-verse-seq={v.seq}
      data-wf-verse-grain={v.grain}
    >
      <p id={labelId} className="sr-only">
        {trans('reader.verseLabel', { ref: v.ref || String(index + 1) })}
      </p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSectionPlay(v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSectionPlay(v); } }}
        className={`rounded-3xl border transition-all duration-300 p-3 sm:p-4 flex gap-3 cursor-pointer ${
          isActive
            ? `${activeTheme.glowClass} border-indigo-500/40 bg-indigo-500/[0.08]`
            : dark
              ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
              : 'border-zinc-200/80 bg-white/60 hover:bg-white/80'
        }`}
      >
        <div className="shrink-0 flex flex-col items-center gap-1" aria-hidden="true">
          <span className={`min-w-7 h-7 px-1.5 rounded-full text-[11px] font-mono flex items-center justify-center border ${
            isActive ? activeTheme.accentBg : 'bg-white/5 border-white/10 text-zinc-400'
          }`}>
            {v.ref || index + 1}
          </span>
          {v.book && <span className="text-[8px] font-mono uppercase text-zinc-600 max-w-12 truncate">{v.book}</span>}
        </div>
        <div className="min-w-0 flex-1" role="group" aria-label={trans('reader.verseContent')} onClick={(e) => e.stopPropagation()}>
          {displayMode === 'interleaved' ? (
            <div className="space-y-0">
              {orderedDisplayLangs.map((lang, li) => renderCell(lang, li, true))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {orderedDisplayLangs.map((lang, li) => renderCell(lang, li))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
