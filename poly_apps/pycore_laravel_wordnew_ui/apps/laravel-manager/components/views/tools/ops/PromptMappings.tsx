/** Prompt Manager, server side: per-category prefix / suffix / replace rules of the task dispatcher, with a live preview. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RotateCcw, Save, Search, Trash2, Wand2 } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { callToolApi } from '../toolRunner';
import { Btn, controlClass, EmptyBlock, Field, Notice, OpsStatusBar, Panel } from './opsKit';
import { describeError, useRemote } from './opsHooks';
import { applyPromptMapping, normalizeMapping, replaceEntries, replaceMapFromEntries, sameMapping } from './opsLogic';
import type { PromptMapping, ReplaceEntry } from './opsLogic';
import type { PromptMappingsData, TaskCategory } from './opsTypes';

interface PromptMappingsProps {
  apiMethod: string;
}

const EMPTY_MAPPING: PromptMapping = { prefix: '', suffix: '', replace_map: {} };

const PromptMappings: React.FC<PromptMappingsProps> = ({ apiMethod }) => {
  const { t } = useTranslation();
  const mappings = useRemote(() => callToolApi<PromptMappingsData>(apiMethod), [apiMethod]);
  const categories = useRemote(async () => (await callToolApi<{ categories: TaskCategory[] }>('mcpV1.getTaskCategories'))?.categories ?? [], []);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [entries, setEntries] = useState<ReplaceEntry[]>([]);
  const [sample, setSample] = useState('');
  const [busy, setBusy] = useState<'save' | 'reset' | 'delete' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const stored = useMemo(() => {
    const raw = mappings.data?.mappings ?? {};
    return Object.fromEntries(Object.entries(raw).map(([id, mapping]) => [id, normalizeMapping(mapping)]));
  }, [mappings.data]);
  const ids = useMemo(() => {
    const all = new Set<string>([...Object.keys(stored), ...(categories.data ?? []).map((category) => category.id)]);
    const query = search.trim().toLowerCase();
    return Array.from(all).filter((id) => !query || id.toLowerCase().includes(query)).sort();
  }, [stored, categories.data, search]);
  const categoryName = (id: string): string => categories.data?.find((category) => category.id === id)?.name ?? '';
  const baseline = selectedId ? stored[selectedId] ?? EMPTY_MAPPING : EMPTY_MAPPING;
  const draft: PromptMapping = { prefix, suffix, replace_map: replaceMapFromEntries(entries) };
  const dirty = selectedId !== null && !sameMapping(draft, baseline);

  useEffect(() => {
    if (!selectedId) return;
    const mapping = stored[selectedId] ?? EMPTY_MAPPING;
    setPrefix(mapping.prefix);
    setSuffix(mapping.suffix);
    setEntries(replaceEntries(mapping.replace_map));
  }, [selectedId, stored]);

  const act = async (kind: 'save' | 'reset' | 'delete'): Promise<void> => {
    if (!selectedId) return;
    if (kind === 'delete' && !window.confirm(t('toolsOps.prompt.confirm_delete_mapping', { id: selectedId }))) return;
    setBusy(kind);
    setNotice(null);
    try {
      if (kind === 'save') await callToolApi('mcpV1.updatePromptMappingRules', { category_id: selectedId, ...draft });
      if (kind === 'reset') await callToolApi('mcpV1.resetCategoryMapping', selectedId);
      if (kind === 'delete') await callToolApi('mcpV1.deleteCategoryMapping', selectedId);
      setNotice({ tone: 'ok', text: t(`toolsOps.prompt.done_${kind}`) });
      await mappings.reload(true);
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(t, err) });
    } finally {
      setBusy(null);
    }
  };

  const updateEntry = (index: number, patch: Partial<ReplaceEntry>): void => setEntries(entries.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));

  return (
    <div className="space-y-4">
      <OpsStatusBar accent="fuchsia" mode="server" updatedAt={mappings.updatedAt} loading={mappings.loading} onRefresh={() => { void mappings.reload(); void categories.reload(); }}>
        {t('toolsOps.prompt.mapping_status', { configured: Object.keys(stored).length, total: ids.length })}
      </OpsStatusBar>
      {mappings.error && <Notice tone="error">{mappings.error}</Notice>}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title={t('toolsOps.prompt.categories')} icon={Wand2} accent="fuchsia" className="lg:col-span-2" bodyClassName="space-y-3 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('toolsOps.common.search')} className={`${controlClass('fuchsia')} pl-9`} />
          </div>
          {ids.length === 0 ? (
            <EmptyBlock icon={Wand2}>{mappings.loading ? t('toolsOps.common.loading') : t('toolsOps.prompt.no_categories')}</EmptyBlock>
          ) : (
            <ul className="max-h-[26rem] space-y-1 overflow-y-auto">
              {ids.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => { setSelectedId(id); setNotice(null); }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${id === selectedId ? 'border-fuchsia-300 bg-fuchsia-50 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/10' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm text-slate-800 dark:text-slate-100">{id}</span>
                      {categoryName(id) && <span className="block truncate text-[11px] text-slate-400">{categoryName(id)}</span>}
                    </span>
                    <Pill tone={stored[id] ? 'emerald' : 'neutral'} tint>{stored[id] ? t('toolsOps.prompt.configured') : t('toolsOps.prompt.unconfigured')}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4 lg:col-span-3">
          {selectedId ? (
            <>
              <Panel
                title={selectedId}
                icon={Wand2}
                accent="fuchsia"
                actions={(
                  <>
                    <Btn size="sm" icon={RotateCcw} loading={busy === 'reset'} onClick={() => void act('reset')} disabled={busy !== null}>{t('toolsOps.prompt.reset')}</Btn>
                    <Btn size="sm" variant="dangerSoft" icon={Trash2} loading={busy === 'delete'} onClick={() => void act('delete')} disabled={busy !== null || !stored[selectedId]}>{t('uiTools.common.delete')}</Btn>
                  </>
                )}
              >
                <div className="space-y-3">
                  <Field label={t('toolsOps.prompt.prefix')}>
                    <textarea value={prefix} onChange={(event) => setPrefix(event.target.value)} rows={2} className={`${controlClass('fuchsia')} resize-y font-mono`} />
                  </Field>
                  <Field label={t('toolsOps.prompt.suffix')}>
                    <textarea value={suffix} onChange={(event) => setSuffix(event.target.value)} rows={2} className={`${controlClass('fuchsia')} resize-y font-mono`} />
                  </Field>
                  <Field label={t('toolsOps.prompt.replace_rules')} hint={t('toolsOps.prompt.replace_hint')}>
                    <div className="space-y-2">
                      {entries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input value={entry.from} onChange={(event) => updateEntry(index, { from: event.target.value })} placeholder={t('toolsOps.prompt.from')} className={`${controlClass('fuchsia')} font-mono`} />
                          <span className="text-slate-400">→</span>
                          <input value={entry.to} onChange={(event) => updateEntry(index, { to: event.target.value })} placeholder={t('toolsOps.prompt.to')} className={`${controlClass('fuchsia')} font-mono`} />
                          <Btn size="sm" variant="dangerSoft" icon={Trash2} aria-label={t('uiTools.common.delete')} onClick={() => setEntries(entries.filter((_, position) => position !== index))} />
                        </div>
                      ))}
                      <Btn size="sm" variant="soft" accent="fuchsia" icon={Plus} onClick={() => setEntries([...entries, { from: '', to: '' }])}>{t('toolsOps.prompt.add_rule')}</Btn>
                    </div>
                  </Field>
                  {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
                  <div className="flex justify-end">
                    <Btn variant="primary" accent="fuchsia" icon={Save} loading={busy === 'save'} onClick={() => void act('save')} disabled={!dirty || busy !== null}>{t('uiTools.common.save')}</Btn>
                  </div>
                </div>
              </Panel>

              <Panel title={t('toolsOps.prompt.preview')} icon={Wand2} accent="fuchsia">
                <div className="space-y-3">
                  <textarea value={sample} onChange={(event) => setSample(event.target.value)} rows={3} placeholder={t('toolsOps.prompt.sample_placeholder')} className={`${controlClass('fuchsia')} resize-y`} />
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 dark:bg-slate-900/50 dark:text-slate-100">{applyPromptMapping(draft, sample || t('toolsOps.prompt.sample_default'))}</pre>
                </div>
              </Panel>
            </>
          ) : (
            <Panel bodyClassName="p-0"><EmptyBlock icon={Wand2}>{t('toolsOps.prompt.pick_category')}</EmptyBlock></Panel>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptMappings;
