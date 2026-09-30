/**
 * The word group a composition reads new words against, and the API-side
 * virtual read batch overlaid on its read counts (used by the orchestration
 * panel and the detail page's quick switch).
 */
import React, { useEffect, useState } from 'react';
import { wfNewApi, type WordGroup } from '../../api';

interface Props {
  groupId: string | null;
  virtualBatch: string;
  onChange: (next: { groupId: string | null; virtualBatch: string }) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  compact?: boolean;
}

const FIELD = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-400/50';
const LABEL = 'block space-y-1 text-[11px] font-bold text-zinc-400';
const BATCH_MAX = 64;

let groupsFlight: Promise<WordGroup[]> | null = null;

/** The user's word groups (one request shared by every field on the page). */
function loadGroups(): Promise<WordGroup[]> {
  if (!wfNewApi.isAuthenticated()) return Promise.resolve([]);
  groupsFlight ??= wfNewApi.getWordGroups().catch(() => {
    groupsFlight = null;
    return [];
  });
  return groupsFlight;
}

export const WordNewOrchWordGroupField: React.FC<Props> = ({ groupId, virtualBatch, onChange, trans, compact }) => {
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [batch, setBatch] = useState(virtualBatch);

  useEffect(() => { void loadGroups().then(setGroups); }, []);
  useEffect(() => { setBatch(virtualBatch); }, [virtualBatch]);

  const commitBatch = (): void => {
    const next = batch.trim().slice(0, BATCH_MAX);
    if (next && next !== virtualBatch) onChange({ groupId, virtualBatch: next });
    else setBatch(virtualBatch);
  };

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
      <label className={LABEL}>
        <span>{trans('orchCompose.field.wordGroup')}</span>
        <select
          value={groupId ?? ''}
          onChange={(event) => onChange({ groupId: event.target.value || null, virtualBatch })}
          className={FIELD}
        >
          <option value="">{trans('orchCompose.field.wordGroupDefault')}</option>
          {groupId && !groups.some((group) => group.id === groupId) && <option value={groupId}>{groupId}</option>}
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name} ({group.count})</option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        <span>{trans('orchCompose.field.virtualBatch')}</span>
        <input
          value={batch}
          maxLength={BATCH_MAX}
          onChange={(event) => setBatch(event.target.value)}
          onBlur={commitBatch}
          onKeyDown={(event) => { if (event.key === 'Enter') commitBatch(); }}
          className={FIELD}
        />
      </label>
    </div>
  );
};
