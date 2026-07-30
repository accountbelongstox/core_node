import React from 'react';
import type { WfNewContentGroup } from '../api';
import { ElementTheme } from '../WfNewTypes';
import { WfNewContentGroupCard } from './WfNewContentGroupCard';

/** Column classes — keep IN SYNC with api/WfNewGrid computeCols (2/3/4/5). */
export const WFNEW_GRID_COLS_CLASS = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

interface WfNewContentGridProps {
  groups: WfNewContentGroup[];
  theme: ElementTheme;
  trans: (key: string, r?: Record<string, string | number>) => string;
  onOpen: (g: WfNewContentGroup) => void;
  onAddToStudy?: (g: WfNewContentGroup) => void;
}

export const WfNewContentGrid: React.FC<WfNewContentGridProps> = ({ groups, theme, trans, onOpen, onAddToStudy }) => (
  <div className={`grid ${WFNEW_GRID_COLS_CLASS} gap-3 sm:gap-4`}>
    {groups.map((g) => (
      <WfNewContentGroupCard
        key={`${g.kind}-${g.id}`}
        group={g}
        theme={theme}
        trans={trans}
        fullWidth
        onClick={() => onOpen(g)}
        onAddToStudy={onAddToStudy ? () => onAddToStudy(g) : undefined}
      />
    ))}
  </div>
);
