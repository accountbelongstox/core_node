/**
 * What decides a composition's new words: the word group, and the read counts
 * layered on it - the task's own API-side virtual read batch, a batch picked
 * from history (at most 20 per user, pruned by Laravel), or the real read
 * counts. Used by the orchestration panel and the detail page's quick switch.
 */
import React, { useEffect, useState } from 'react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewApi, type WfNewVirtualReadBatchList } from '../../api';
import { wordNewWordGroups, useWordNewWordGroups } from '../../services/WordNewWordGroupCenter';
import type { OrchComposeReadState } from '../../../../shared/orchestration/orchTypes';
import { orchFormStyles } from './orchFormStyles';
import { OrchTabs } from './OrchTabs';

export interface OrchReadStateValue {
  groupId: string | null;
  readState: OrchComposeReadState;
  virtualBatch: string;
}

interface Props {
  value: OrchReadStateValue;
  /** The task's own batch ('' before the task exists: named when saved). */
  taskBatch: string;
  onChange: (next: OrchReadStateValue) => void;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const READ_STATES: OrchComposeReadState[] = ['virtual', 'history', 'real'];

export const WordNewOrchReadStateField: React.FC<Props> = ({ value, taskBatch, onChange, theme, trans }) => {
  const styles = orchFormStyles(theme);
  const groups = useWordNewWordGroups();
  const [batches, setBatches] = useState<WfNewVirtualReadBatchList | null>(null);

  useEffect(() => {
    if (wfNewApi.isAuthenticated()) void wordNewWordGroups.load().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (value.readState !== 'history' || batches || !wfNewApi.isAuthenticated()) return;
    void wfNewApi.getVirtualReadBatches().then(setBatches).catch(() => setBatches({ items: [], max: 0 }));
  }, [value.readState, batches]);

  const setReadState = (readState: OrchComposeReadState): void => {
    if (readState === 'virtual') onChange({ ...value, readState, virtualBatch: taskBatch || value.virtualBatch });
    else if (readState === 'history') onChange({ ...value, readState, virtualBatch: batches?.items[0]?.name ?? value.virtualBatch });
    else onChange({ ...value, readState });
  };

  return (
    <div className="space-y-3">
      <label className={styles.label}>
        <span>{trans('orchCompose.field.wordGroup')}</span>
        <select value={value.groupId ?? ''} onChange={(event) => onChange({ ...value, groupId: event.target.value || null })} className={styles.select}>
          <option value="">{trans('orchCompose.field.wordGroupDefault')}</option>
          {value.groupId && !groups.some((group) => group.id === value.groupId) && <option value={value.groupId}>{value.groupId}</option>}
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.count})</option>)}
        </select>
      </label>

      <div className="space-y-1">
        <span className={styles.label}>{trans('orchCompose.readState.title')}</span>
        <OrchTabs
          role="radio"
          shape="compact"
          label={trans('orchCompose.readState.title')}
          value={value.readState}
          options={READ_STATES.map((state) => ({ value: state, label: trans(`orchCompose.readState.${state}`) }))}
          onChange={setReadState}
          theme={theme}
        />
        <p className={styles.hint}>{trans(`orchCompose.readState.${value.readState}Hint`, { batch: taskBatch || trans('orchCompose.readState.newBatch') })}</p>
      </div>

      {value.readState === 'history' && (
        <label className={styles.label}>
          <span>{trans('orchCompose.readState.batch', { max: batches?.max ?? 20 })}</span>
          <select value={value.virtualBatch} onChange={(event) => onChange({ ...value, virtualBatch: event.target.value })} className={styles.select}>
            {!batches?.items.some((batch) => batch.name === value.virtualBatch) && <option value={value.virtualBatch}>{value.virtualBatch}</option>}
            {(batches?.items ?? []).map((batch) => (
              <option key={batch.name} value={batch.name}>
                {trans('orchCompose.readState.batchOption', { name: batch.name, words: batch.words, reads: batch.reads })}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
