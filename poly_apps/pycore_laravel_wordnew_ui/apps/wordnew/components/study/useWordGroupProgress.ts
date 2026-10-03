import { useEffect, useMemo, useState } from 'react';
import type { WordGroup } from '../../api/WfNewApiTypes';
import { isDefaultVocabularyGroup } from '../../api';
import { percentOf } from '../../../../core/utils/mathUtils';
import { wfNewStudyProgress } from './WfNewStudyProgress';

export interface WordGroupProgress {
  total: number;
  read: number;
  left: number;
  due: number;
  percent: number;
}

/** Group progress from the shared study-progress store; groups without local records keep the API percentage. */
export function useWordGroupProgress(group: WordGroup): WordGroupProgress {
  const [version, setVersion] = useState(0);
  useEffect(() => wfNewStudyProgress.subscribe(() => setVersion((v) => v + 1)), []);
  return useMemo(() => {
    const lib = wfNewStudyProgress.computeLibraryStats(String(group.id), group.count || 0);
    const fromStore = isDefaultVocabularyGroup(group) || lib.readWords > 0;
    const percent = fromStore ? percentOf(lib.readWords, lib.total) : Math.round(group.progress || 0);
    const read = fromStore ? lib.readWords : Math.round((lib.total * percent) / 100);
    return { total: lib.total, read, left: Math.max(0, lib.total - read), due: lib.dueWords, percent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, group.count, group.progress, group.name, version]);
}
