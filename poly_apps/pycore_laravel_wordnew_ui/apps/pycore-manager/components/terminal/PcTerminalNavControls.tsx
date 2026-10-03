import React from 'react';
import { ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PcTerminalNavControlsProps {
  canBack: boolean;
  canForward: boolean;
  /** Finished terminals not opened yet (each appears once). */
  finishedCount: number;
  onBack: () => void;
  onForward: () => void;
  onNextFinished: () => void;
  className?: string;
}

const BUTTON_CLASS = 'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35';

/** Back / forward through the terminals operated before, and the next finished one in the queue. */
export const PcTerminalNavControls: React.FC<PcTerminalNavControlsProps> = ({
  canBack, canForward, finishedCount, onBack, onForward, onNextFinished, className = '',
}) => {
  const { t } = useTranslation('pc');
  return (
    <div className={`flex shrink-0 items-center gap-1.5 ${className}`}>
      <button type="button" onClick={onBack} disabled={!canBack} title={t('terminal.nav.back')} aria-label={t('terminal.nav.back')} className={BUTTON_CLASS}>
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={onForward} disabled={!canForward} title={t('terminal.nav.forward')} aria-label={t('terminal.nav.forward')} className={BUTTON_CLASS}>
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNextFinished}
        disabled={finishedCount === 0}
        title={t('terminal.nav.nextFinished', { count: finishedCount })}
        aria-label={t('terminal.nav.nextFinished', { count: finishedCount })}
        className={BUTTON_CLASS}
      >
        <CheckCheck className="h-4 w-4 text-emerald-400" />
        {finishedCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-emerald-500 px-1 text-center font-mono text-[9px] font-bold leading-4 text-white">
            {finishedCount}
          </span>
        )}
      </button>
    </div>
  );
};
