import React from 'react';
import { QueueDeliveryStatusIcons } from '@/apps/wordnew/components/queue/QueueDeliveryStatusIcons';
import type { QueueDeliveryVisualStage } from '../../../core/contracts/QueueCenterContract';
import { selectQueueWorkersByKind } from '../services/queue/WordNewQueueDeliveryRuntime';
import { useWordNewQueueRuntime, type WordNewQueueResource } from '../services/WordNewQueueRuntime';

export interface WordNewResourceStatusIconProps {
  state: QueueDeliveryVisualStage;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
  queueKey?: string;
  resource?: WordNewQueueResource;
  trans?: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WordNewResourceStatusIcon: React.FC<WordNewResourceStatusIconProps> = ({
  state,
  onClick,
  disabled,
  title,
  size = 'sm',
  className = '',
  queueKey,
  resource = 'audio',
  trans,
}) => {
  const snapshot = useWordNewQueueRuntime();
  const receipt = queueKey ? snapshot.receipts.get(queueKey) || null : null;
  const receiptState = state === 'ready' || state === 'playing'
    ? state
    : receipt?.stage || state;
  const expectedKind = resource === 'translation' ? 'chrome' : 'pycore';
  const workers = selectQueueWorkersByKind(snapshot.workers, expectedKind);
  const translate = trans || ((key: string) => key);
  const receiptTitle = receipt ? [
    translate(`queue.${receiptState}`),
    receipt.headAction
      ? translate(`queue.headAction.${receipt.headAction}`)
      : null,
    receipt.progress !== null
      ? translate('queue.progress', { progress: Math.round(receipt.progress) })
      : null,
    receipt.estimatedWaitSeconds !== null
      ? translate('queue.estimatedWait', { seconds: receipt.estimatedWaitSeconds })
      : null,
  ].filter(Boolean).join(' · ') : undefined;

  return (
    <QueueDeliveryStatusIcons
      stage={receiptState}
      resource={resource}
      laravelOnline={snapshot.laravelOnline}
      workers={workers}
      assignedWorkerId={receipt?.workerId}
      onClick={onClick}
      disabled={disabled}
      title={title || receiptTitle}
      size={size}
      className={className}
      trans={translate}
    />
  );
};

export default WordNewResourceStatusIcon;
