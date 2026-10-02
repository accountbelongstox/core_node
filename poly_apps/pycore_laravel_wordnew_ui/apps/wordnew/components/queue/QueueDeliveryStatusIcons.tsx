import React from 'react';
import {
  ArrowUpCircle,
  Bot,
  Chrome,
  CircleAlert,
  Clock3,
  Languages,
  Loader2,
  Play,
  Server,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { TONE_TEXT, type StatusTone } from '@/shared/ui/statusTone';
import type {
  QueueCenterWorkerPresence,
  QueueDeliveryResourceKind,
  QueueDeliveryVisualStage,
} from '../../../../core/contracts/QueueCenterContract';

export type {
  QueueDeliveryResourceKind,
  QueueDeliveryVisualStage,
} from '../../../../core/contracts/QueueCenterContract';
export type QueueWorkerIconKind = 'laravel' | 'pycore' | 'chrome';

export interface QueueWorkerPresenceIconProps {
  kind: QueueWorkerIconKind;
  online: boolean;
  worker?: QueueCenterWorkerPresence;
  assigned?: boolean;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  className?: string;
}

export interface QueueDeliveryStatusIconsProps {
  stage: QueueDeliveryVisualStage;
  resource: QueueDeliveryResourceKind;
  laravelOnline: boolean;
  workers: QueueCenterWorkerPresence[];
  assignedWorkerId?: string | null;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const ICON_SIZE = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4' };
const ACKNOWLEDGED_STAGES = new Set<QueueDeliveryVisualStage>([
  'laravel_received',
  'worker_received',
  'processing',
]);

interface StageView {
  icon: (resource: QueueDeliveryResourceKind) => LucideIcon;
  tone?: StatusTone;
  /** Colour of stages without a shared tone. */
  color?: string;
  hover?: string;
  pulse?: 'button' | 'icon';
  spin?: boolean;
}

const audioOrTranslation = (audio: LucideIcon) => (resource: QueueDeliveryResourceKind): LucideIcon => (resource === 'translation' ? Languages : audio);
const fixedIcon = (icon: LucideIcon) => (): LucideIcon => icon;

const STAGE_VIEW: Partial<Record<QueueDeliveryVisualStage, StageView>> = {
  playing: { icon: fixedIcon(Volume2), tone: 'indigo', pulse: 'icon' },
  ready: { icon: audioOrTranslation(Volume2), tone: 'emerald' },
  completed: { icon: audioOrTranslation(Volume2), tone: 'emerald' },
  processing: { icon: fixedIcon(Loader2), tone: 'sky', spin: true },
  queued: { icon: fixedIcon(ArrowUpCircle), tone: 'amber', pulse: 'button' },
  laravel_received: { icon: fixedIcon(ArrowUpCircle), tone: 'amber', pulse: 'button' },
  worker_received: { icon: fixedIcon(Zap), color: 'text-cyan-300', pulse: 'button' },
  waiting: { icon: fixedIcon(Clock3), tone: 'neutral', pulse: 'button' },
  failed: { icon: fixedIcon(CircleAlert), tone: 'rose' },
  missing: { icon: audioOrTranslation(VolumeX), color: 'text-fuchsia-400/80', hover: 'hover:text-fuchsia-300', pulse: 'button' },
};

const workerLabelKey = (kind: QueueWorkerIconKind): string => {
  if (kind === 'chrome') return 'queue.mcpChrome';
  if (kind === 'pycore') return 'queue.pycore';
  return 'queue.laravel';
};

const WorkerGlyph: React.FC<{ kind: QueueWorkerIconKind }> = ({ kind }) => {
  if (kind === 'chrome') return <Chrome className="h-3.5 w-3.5" />;
  if (kind === 'pycore') return <Bot className="h-3.5 w-3.5" />;
  return <Server className="h-3.5 w-3.5" />;
};

export const QueueWorkerPresenceIcon: React.FC<QueueWorkerPresenceIconProps> = ({
  kind,
  online,
  worker,
  assigned = false,
  trans,
  className = '',
}) => {
  const name = worker?.name || trans(workerLabelKey(kind));
  const presence = trans(online ? 'queue.online' : 'queue.offline');
  const title = `${name} · ${presence}`;
  const tone = assigned
    ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-200'
    : online
      ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
      : 'border-slate-500/25 bg-slate-500/10 text-slate-500';

  return (
    <span
      title={title}
      aria-label={title}
      className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${tone} ${className}`}
    >
      <WorkerGlyph kind={kind} />
      <span
        className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-slate-950 ${
          online ? 'bg-emerald-400' : 'bg-slate-500'
        }`}
      />
      {assigned ? (
        <Zap className="absolute -bottom-1 -right-1 h-3 w-3 fill-cyan-300 text-cyan-300" />
      ) : null}
    </span>
  );
};

export const QueueDeliveryStatusIcons: React.FC<QueueDeliveryStatusIconsProps> = ({
  stage,
  resource,
  laravelOnline,
  workers,
  assignedWorkerId,
  onClick,
  disabled,
  title,
  size = 'sm',
  className = '',
  trans,
}) => {
  const iconSize = ICON_SIZE[size];
  const stateTitle = title || trans(`queue.${stage}`);
  const primaryBase = `shrink-0 rounded p-1 transition-all ${
    onClick ? 'cursor-pointer' : 'cursor-default'
  } ${className}`;
  const workerKind: QueueWorkerIconKind = resource === 'translation' ? 'chrome' : 'pycore';
  const showDeliveryChain = !['none', 'ready', 'playing', 'completed'].includes(stage);
  const laravelAcknowledged = ACKNOWLEDGED_STAGES.has(stage);
  const workerOnline = workers.some((worker) => worker.online);
  const workerAssigned = ['worker_received', 'processing'].includes(stage)
    && workers.some((worker) => worker.id === assignedWorkerId);

  const primary = (classes: string, icon: React.ReactNode) => {
    const mergedClasses = `${primaryBase} ${classes} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`;
    if (!onClick) {
      return <span title={stateTitle} aria-label={stateTitle} className={mergedClasses}>{icon}</span>;
    }
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={stateTitle}
        aria-label={stateTitle}
        className={mergedClasses}
      >
        {icon}
      </button>
    );
  };

  const renderPrimary = (): React.ReactNode => {
    const view = STAGE_VIEW[stage];
    if (!view) return <span className={`${primaryBase} pointer-events-none opacity-0`}><Play className={iconSize} /></span>;
    const Icon = view.icon(resource);
    return primary(
      `${view.tone ? TONE_TEXT[view.tone] : view.color} opacity-100 ${view.pulse === 'button' ? 'animate-pulse' : ''} ${view.hover ?? ''}`,
      <Icon className={`${iconSize} ${view.pulse === 'icon' ? 'animate-pulse' : ''} ${view.spin ? 'animate-spin' : ''}`} />,
    );
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-1" role="group" aria-label={stateTitle}>
      {renderPrimary()}
      {showDeliveryChain ? (
        <>
          <QueueWorkerPresenceIcon
            kind="laravel"
            online={laravelOnline}
            assigned={laravelAcknowledged}
            trans={trans}
          />
          <QueueWorkerPresenceIcon
            kind={workerKind}
            online={workerOnline}
            assigned={workerAssigned}
            trans={trans}
          />
        </>
      ) : null}
    </span>
  );
};

export default QueueDeliveryStatusIcons;
