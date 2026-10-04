import React, { useCallback, useSyncExternalStore } from 'react';
import { Hourglass } from 'lucide-react';
import { NoticeBanner } from '@/shared/ui/NoticeBanner';
import { wordNewOrchComposer } from '../../services/orchestration/WordNewOrchComposer';

interface Props {
  taskId: string;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  className?: string;
}

/** Sentences of a `phrases` pattern whose phrases the server is still extracting (they join the plan by themselves). */
export const WordNewOrchPhrasePendingNotice: React.FC<Props> = ({ taskId, trans, className = '' }) => {
  const subscribe = useCallback((listener: () => void) => wordNewOrchComposer.subscribe(taskId, listener), [taskId]);
  const read = useCallback(() => wordNewOrchComposer.phrasePending(taskId), [taskId]);
  const pending = useSyncExternalStore(subscribe, read, read);
  if (pending <= 0) return null;
  return (
    <NoticeBanner icon={Hourglass} className={className}>
      <p>{trans('orchCompose.phrases.pending', { count: pending })}</p>
    </NoticeBanner>
  );
};
