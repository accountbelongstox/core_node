import React from 'react';
import { Play, Pause, Pencil, Trash2, ChevronDown, ChevronUp, Volume2, Languages } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import type { WfNewAdminWordRow as WordRow, WfNewAdminSentence } from '../../api';
import { formatBytes } from '../../../../core/utils/formatBytes';
import { AdminCheckbox, AdminLabel, AdminTableRow, type AdminTrans } from './adminKit';

export const WORD_HEAD_GRID = 'grid-cols-[2rem_2rem_1fr_2fr_7rem_7rem]';
const WORD_ROW_GRID = 'grid-cols-[2rem_2rem_1fr_auto] sm:grid-cols-[2rem_2rem_1fr_2fr_7rem_7rem]';
const TRANSLATION_SEPARATOR = '；';

export interface SentenceSlot {
  loading: boolean;
  error: string | null;
  sentences: WfNewAdminSentence[];
}

interface WfNewAdminWordRowProps {
  row: WordRow;
  position: number;
  selected: boolean;
  open: boolean;
  playing: boolean;
  sentences?: SentenceSlot;
  trans: AdminTrans;
  onToggleSelect: () => void;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleExpand: () => void;
}

const Detail: React.FC<{ row: WordRow; sentences?: SentenceSlot; trans: AdminTrans }> = ({ row, sentences, trans }) => (
  <div className="mt-2.5 ml-8 border-l border-white/10 pl-3 space-y-2.5">
    {row.translations.length > 0 && (
      <div className="flex items-start gap-2">
        <Languages className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-[12px] text-zinc-200">{row.translations.join(TRANSLATION_SEPARATOR)}</p>
      </div>
    )}
    {(row.us_phonetic || row.uk_phonetic) && (
      <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
        {row.us_phonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />US /{row.us_phonetic}/</span>}
        {row.uk_phonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />UK /{row.uk_phonetic}/</span>}
      </div>
    )}
    {row.audio_path && (
      <p className="text-[10px] font-mono text-zinc-500 truncate">
        {row.audio_path}{row.audio_size ? ` · ${formatBytes(row.audio_size)}` : ''}
      </p>
    )}
    <p className="text-[10px] font-mono text-zinc-500">{trans('admin.w.queries', { n: row.query_count })}</p>
    {(row.validity_note || row.validity_source) && (
      <p className="text-[10px] font-mono text-amber-400/90">
        {row.validity_note}{row.validity_source ? ` · ${row.validity_source}` : ''}
      </p>
    )}
    <div className="space-y-1.5">
      <AdminLabel>{trans('admin.w.sentences')}</AdminLabel>
      {!sentences || sentences.loading ? (
        <p className="text-[11px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
      ) : sentences.error ? (
        <p className="text-[11px] font-mono text-rose-400">{sentences.error}</p>
      ) : sentences.sentences.length === 0 ? (
        <p className="text-[11px] font-mono text-zinc-500">{trans('admin.w.noSentences')}</p>
      ) : (
        sentences.sentences.map((s) => (
          <div key={s.id} className="flex items-start gap-2">
            <p className="text-[12px] text-zinc-300 flex-1 min-w-0">{s.text}</p>
            <span className="text-[10px] font-mono text-zinc-500 shrink-0">×{s.occurrence_count}</span>
          </div>
        ))
      )}
    </div>
  </div>
);

export const WfNewAdminWordRow: React.FC<WfNewAdminWordRowProps> = ({
  row, position, selected, open, playing, sentences, trans, onToggleSelect, onPlay, onEdit, onDelete, onToggleExpand,
}) => {
  const phonetic = row.us_phonetic || row.uk_phonetic || row.phonetic;
  return (
    <AdminTableRow grid={WORD_ROW_GRID} detail={open ? <Detail row={row} sentences={sentences} trans={trans} /> : null}>
      <span><AdminCheckbox checked={selected} onChange={onToggleSelect} /></span>
      <span className="text-[11px] font-mono text-zinc-600">{position}</span>
      <div className="min-w-0">
        <span className="text-sm font-bold text-slate-100 truncate block">{row.content}</span>
        {phonetic && <span className="text-[10px] font-mono text-zinc-500">/{phonetic}/</span>}
      </div>
      <div className="hidden sm:block min-w-0">
        <p className={`text-[12px] text-zinc-300 ${open ? '' : 'truncate'}`}>
          {row.translations.length > 0 ? row.translations.join(TRANSLATION_SEPARATOR) : '—'}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-1">
        {row.is_valid ? (
          <span className="text-[9px] font-mono text-emerald-400/90 border border-emerald-500/30 rounded px-1">{trans('admin.w.valid')}</span>
        ) : (
          <span className="text-[9px] font-mono text-amber-500/80 border border-amber-500/30 rounded px-1">{trans('admin.w.invalid')}</span>
        )}
        {row.has_audio && (
          <span className="p-1 rounded border border-sky-500/20 bg-sky-500/10 text-sky-300" title={trans('admin.w.f.withAudio')}>
            <Volume2 className="w-3 h-3" />
          </span>
        )}
        {row.has_translation && (
          <span className="p-1 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-300" title={trans('admin.w.f.withTrans')}>
            <Languages className="w-3 h-3" />
          </span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        {row.audio_url && (
          <ChipButton variant={playing ? 'info' : 'default'} onClick={onPlay} className="px-1.5" title={trans('library.play')}>
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </ChipButton>
        )}
        <ChipButton onClick={onEdit} className="px-1.5" title={trans('admin.w.edit')}><Pencil className="w-3.5 h-3.5" /></ChipButton>
        <ChipButton variant="danger" onClick={onDelete} className="px-1.5" title={trans('admin.w.delete')}><Trash2 className="w-3.5 h-3.5" /></ChipButton>
        <ChipButton onClick={onToggleExpand} className="px-1.5">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </ChipButton>
      </div>
    </AdminTableRow>
  );
};
