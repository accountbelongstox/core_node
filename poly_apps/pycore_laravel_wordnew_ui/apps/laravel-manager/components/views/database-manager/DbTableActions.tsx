import React from 'react';
import { libraryCoverTaskModel, libraryCoverView, useLibraryCoverEntry } from '@/apps/laravel-manager/models';
import type { VocabLibrary } from '@/core/integrations/laravel';
import {
  LibraryCoverTaskBadge,
  LibraryCoverTaskButtons,
  useLibraryCoverEnqueue,
} from '../../vocabulary/LibraryCoverTaskControls';

export interface DbTableRowActionsProps {
  row: Record<string, unknown>;
}

/** Table-specific row actions for the generic table browser. */
export interface DbTableActionDefinition {
  /** Matches `<suffix>`, `<prefix>_<suffix>` and `<schema>.<suffix>` table names. */
  suffix: string;
  RowActions: React.ComponentType<DbTableRowActionsProps>;
}

const VocabularyLibraryRowActions: React.FC<DbTableRowActionsProps> = ({ row }) => {
  const id = Number(row.id);
  const entry = useLibraryCoverEntry(libraryCoverTaskModel, id);
  const enqueueCoverTasks = useLibraryCoverEnqueue();
  const cover = libraryCoverView(row as unknown as VocabLibrary, entry);

  if (!Number.isInteger(id) || id <= 0) return null;
  return (
    <div className="flex items-center gap-1">
      <LibraryCoverTaskButtons active={cover.active} onEnqueue={(mode) => void enqueueCoverTasks([id], mode)} />
      <LibraryCoverTaskBadge phase={cover.phase} handler={cover.handler} error={cover.taskError} />
    </div>
  );
};

const DB_TABLE_ACTIONS: DbTableActionDefinition[] = [
  { suffix: 'vocabulary_libraries', RowActions: VocabularyLibraryRowActions },
];

export function findDbTableActions(tableName: string | null): DbTableActionDefinition | null {
  if (!tableName) return null;
  const name = tableName.toLowerCase();
  return DB_TABLE_ACTIONS.find(({ suffix }) =>
    name === suffix || name.endsWith(`_${suffix}`) || name.endsWith(`.${suffix}`)) ?? null;
}
