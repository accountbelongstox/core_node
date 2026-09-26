/**
 * Live Part1 / Part2 / Queue view of ONE orchestration task: its missing words
 * in the word_audio Queue and its missing sentences in the sentence_audio
 * Queue (each lane its own Queue), with every item's fill state
 * (queued -> generating -> filled / failed). Pycore-owned data via the owner
 * lane views; re-fetched when the lane revision moves (state-driven).
 */
import React from 'react';
import { useAudioLaneOwnerViews } from '@/apps/pycore-manager/api';
import { PcAudioLaneQueueView } from '../../components/PcAudioLaneQueueView';

const OrchTaskLaneProgress: React.FC<{
  taskId: string;
  active: boolean;
  compact?: boolean;
  lanes: Array<'word_audio' | 'sentence_audio'>;
}> = ({ taskId, active, compact = true, lanes }) => {
  const owner = useAudioLaneOwnerViews(taskId, active);
  if (!active || lanes.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5" onClick={(event) => event.stopPropagation()}>
      {lanes.map((lane) => (
        <PcAudioLaneQueueView
          key={lane}
          lane={lane}
          view={owner.views[lane]}
          loading={owner.loading}
          error={owner.error}
          compact={compact}
        />
      ))}
    </div>
  );
};

export default OrchTaskLaneProgress;
