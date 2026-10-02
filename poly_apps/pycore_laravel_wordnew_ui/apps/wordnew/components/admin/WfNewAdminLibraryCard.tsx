import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, LibraryBig, Loader2, ScanSearch, Star, Trash2, Wand2 } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import type { WfNewAdminLibraryRow } from '../../api';
import type { LibraryCoverMode } from '@/core/integrations/laravel';
import {
  LIBRARY_COVER_WAITING_STATUSES,
  type LibraryCoverView,
} from '../../../../shared/library-cover/LibraryCoverTaskModel';
import type { AdminTrans } from './adminKit';

const COVER_BADGE_CLS = 'absolute top-2 right-2 max-w-[70%] truncate text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border';
const CARD_STAGGER_SECONDS = 0.02;
const CARD_STAGGER_MAX_SECONDS = 0.3;

interface CoverBadge {
  label: string;
  tone: string;
  title?: string;
}

function coverBadge(cover: LibraryCoverView, trans: AdminTrans): CoverBadge | null {
  if (cover.active) {
    const label = cover.phase === 'processing'
      ? (cover.handler
        ? trans('admin.lib.cover.processingBy', { handler: trans(`admin.lib.cover.handler.${cover.handler}`) })
        : trans('admin.lib.cover.processing'))
      : trans('admin.lib.cover.queued');
    return { label, tone: 'border-sky-500/40 bg-sky-500/20 text-sky-300' };
  }
  if (cover.coverStatus === 'failed' || cover.phase === 'failed') {
    return {
      label: trans('admin.lib.cover.failed'),
      tone: 'border-rose-500/40 bg-rose-500/20 text-rose-300',
      title: cover.taskError || cover.errorMessage || undefined,
    };
  }
  if (cover.coverStatus && LIBRARY_COVER_WAITING_STATUSES.has(cover.coverStatus)) {
    return { label: trans('admin.lib.cover.pending'), tone: 'border-amber-500/40 bg-amber-500/20 text-amber-300' };
  }
  return null;
}

interface WfNewAdminLibraryCardProps {
  lib: WfNewAdminLibraryRow;
  index: number;
  cover: LibraryCoverView;
  coverMode?: LibraryCoverMode;
  coverUrl: string | null;
  deleting: boolean;
  trans: AdminTrans;
  onCoverError: (url: string) => void;
  onOpen: () => void;
  onEnqueueCover: (mode: LibraryCoverMode) => void;
  onDelete: () => void;
}

export const WfNewAdminLibraryCard: React.FC<WfNewAdminLibraryCardProps> = ({
  lib, index, cover, coverMode, coverUrl, deleting, trans, onCoverError, onOpen, onEnqueueCover, onDelete,
}) => {
  const badge = coverBadge(cover, trans);
  const coverAction = (mode: LibraryCoverMode, label: string, Icon: typeof Wand2): React.ReactNode => (
    <ChipButton onClick={() => onEnqueueCover(mode)} disabled={cover.active} title={label} aria-label={label}>
      {cover.active && coverMode === mode ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
    </ChipButton>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * CARD_STAGGER_SECONDS, CARD_STAGGER_MAX_SECONDS) }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:bg-white/[0.05] transition flex flex-col"
    >
      <div className="relative">
        {coverUrl ? (
          <img src={coverUrl} alt={lib.name} loading="lazy" onError={() => onCoverError(coverUrl)} className="h-28 w-full object-cover" />
        ) : (
          <div className="h-28 w-full bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 flex items-center justify-center">
            <LibraryBig className="w-8 h-8 text-white/25" />
          </div>
        )}
        {badge && <span className={`${COVER_BADGE_CLS} ${badge.tone}`} title={badge.title}>{badge.label}</span>}
      </div>

      <div className="px-3.5 py-3 space-y-1 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-extrabold tracking-tight truncate">{lib.name}</h4>
          {lib.is_recommended && (
            <span className="shrink-0 p-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Star className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-zinc-500 truncate capitalize">{lib.language} · {lib.category}</p>
        <p className="text-[10px] font-mono text-zinc-500">{trans('admin.lib.words', { n: lib.word_count })}</p>
      </div>

      <div className="border-t border-white/5 px-3 py-2 flex items-center gap-1.5">
        <ChipButton onClick={onOpen}><BookOpen className="w-3 h-3" /> {trans('admin.lib.view')}</ChipButton>
        {coverAction('generate', trans('admin.lib.regenerateCover'), Wand2)}
        {coverAction('search', trans('admin.lib.researchCover'), ScanSearch)}
        <ChipButton variant="danger" onClick={onDelete} disabled={deleting} className="ml-auto">
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          {trans('admin.lib.delete')}
        </ChipButton>
      </div>
    </motion.div>
  );
};
