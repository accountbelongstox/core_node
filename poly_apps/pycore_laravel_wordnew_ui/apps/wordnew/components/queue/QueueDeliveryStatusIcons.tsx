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
} from 'lucide-react';
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
    if (stage === 'playing') {
      return primary('text-indigo-300 opacity-100', <Volume2 className={`${iconSize} animate-pulse`} />);
    }
    if (stage === 'ready' || stage === 'completed') {
      return primary(
        'text-emerald-400 opacity-100 hover:text-emerald-300',
        resource === 'translation' ? <Languages className={iconSize} /> : <Volume2 className={iconSize} />,
      );
    }
    if (stage === 'processing') {
      return primary('text-sky-400 opacity-100', <Loader2 className={`${iconSize} animate-spin`} />);
    }
    if (stage === 'queued' || stage === 'laravel_received') {
      return primary('animate-pulse text-amber-400 opacity-100', <ArrowUpCircle className={iconSize} />);
    }
    if (stage === 'worker_received') {
      return primary('animate-pulse text-cyan-300 opacity-100', <Zap className={iconSize} />);
    }
    if (stage === 'waiting') {
      return primary('animate-pulse text-slate-400 opacity-100', <Clock3 className={iconSize} />);
    }
    if (stage === 'failed') {
      return primary('text-rose-400 opacity-100', <CircleAlert className={iconSize} />);
    }
    if (stage === 'missing') {
      const icon = resource === 'translation'
        ? <Languages className={iconSize} />
        : <VolumeX className={iconSize} />;
      return primary('animate-pulse text-fuchsia-400/80 opacity-100 hover:text-fuchsia-300', icon);
    }
    return <span className={`${primaryBase} pointer-events-none opacity-0`}><Play className={iconSize} /></span>;
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
