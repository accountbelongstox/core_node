import React from 'react';
import { Layers, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ActionButton } from '@/shared/ui/ActionButton';
import { ModalFooter, ModalHeader } from '@/shared/ui/ModalParts';
import { ModalShell } from '@/shared/ui/ModalShell';
import { StateMessage } from '@/shared/ui/StateMessage';
import type { PreviewAddLibraryResult } from '../api/types/api';

/**
 * WfNewConfirmAddLibraryModal — confirmation dialog shown BEFORE a vocabulary
 * library's words are copied into the user's Default Vocabulary Group. It renders a
 * non-mutating preview: how many words the library has, how many are already in the
 * group, how many are new (to add), the projected total, the duplicate count, and
 * the group's current read / memorized / due-for-review breakdown. Built on ModalShell.
 */
interface WfNewConfirmAddLibraryModalProps {
  open: boolean;
  groupTitle: string;
  loading: boolean;
  submitting: boolean;
  preview: PreviewAddLibraryResult | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

interface TileDef {
  label: string;
  value: number;
  accent: string;
}

const Tile: React.FC<TileDef & { compact?: boolean }> = ({ label, value, accent, compact = false }) => (
  <div className={`border border-white/5 bg-white/5 ${compact ? 'rounded-xl p-2 text-center' : 'rounded-2xl p-3'}`}>
    <div className={`font-mono font-black ${accent} ${compact ? 'text-sm' : 'text-lg'}`}>{value}</div>
    <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
  </div>
);

const NOTE_TONE = {
  rose: { box: 'border-rose-500/20 bg-rose-500/10 text-rose-300', Icon: AlertTriangle },
  cyan: { box: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300', Icon: CheckCircle2 },
} as const;

const Note: React.FC<{ tone: keyof typeof NOTE_TONE; children: React.ReactNode }> = ({ tone, children }) => {
  const { box, Icon } = NOTE_TONE[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-2.5 text-[11px] ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-snug">{children}</span>
    </div>
  );
};

export const WfNewConfirmAddLibraryModal: React.FC<WfNewConfirmAddLibraryModalProps> = ({
  open, groupTitle, loading, submitting, preview, error, onCancel, onConfirm, trans,
}) => {
  const canConfirm = !!preview && !loading && !submitting && preview.language_match && preview.to_add > 0;
  const totals: TileDef[] = preview ? [
    { label: trans('library.confirmLibraryTotal'), value: preview.library_total, accent: 'text-slate-200' },
    { label: trans('library.confirmCurrentInGroup'), value: preview.current_in_group, accent: 'text-slate-200' },
    { label: trans('library.confirmToAdd'), value: preview.to_add, accent: 'text-cyan-400' },
    { label: trans('library.confirmProjected'), value: preview.projected_total, accent: 'text-emerald-400' },
  ] : [];
  const statuses: TileDef[] = preview ? [
    { label: trans('library.confirmRead'), value: preview.status_breakdown.read, accent: 'text-sky-400' },
    { label: trans('library.confirmMemorized'), value: preview.status_breakdown.memorized, accent: 'text-emerald-400' },
    { label: trans('library.confirmDue'), value: preview.status_breakdown.due, accent: 'text-amber-400' },
  ] : [];

  return (
    <ModalShell open={open} onClose={onCancel} locked={submitting}>
      <ModalHeader
        bordered
        icon={<Layers className="h-4 w-4 shrink-0 text-cyan-400" />}
        title={trans('library.confirmTitle')}
        subtitle={groupTitle || undefined}
        onClose={onCancel}
        closeDisabled={submitting}
      />
      <div className="space-y-4 overflow-y-auto p-5">
        {loading && (
          <StateMessage kind="loading" className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {trans('library.confirmCalculating')}
          </StateMessage>
        )}
        {!loading && error && <Note tone="rose">{error}</Note>}
        {!loading && !error && preview && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {totals.map((tile) => <Tile key={tile.label} {...tile} />)}
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="uppercase tracking-wider text-zinc-500">{trans('library.confirmDuplicates')}</span>
              <span className="font-bold text-amber-400">{preview.duplicates_count}</span>
            </div>
            <div className="space-y-2">
              <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{trans('library.confirmStatusTitle')}</div>
              <div className="grid grid-cols-3 gap-2">
                {statuses.map((tile) => <Tile key={tile.label} {...tile} compact />)}
              </div>
            </div>
            {preview.already_linked && <Note tone="cyan">{trans('library.confirmAlreadyLinked')}</Note>}
            {!preview.language_match && <Note tone="rose">{trans('library.confirmLangMismatch')}</Note>}
          </>
        )}
      </div>
      <ModalFooter bordered>
        <ActionButton variant="secondary" onClick={onCancel} disabled={submitting} size="sm">{trans('library.confirmCancel')}</ActionButton>
        <ActionButton variant="accent" onClick={onConfirm} disabled={!canConfirm} loading={submitting}>
          {trans('library.confirmAdd', { count: preview?.to_add ?? 0 })}
        </ActionButton>
      </ModalFooter>
    </ModalShell>
  );
};

export default WfNewConfirmAddLibraryModal;
