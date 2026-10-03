/** List converter: split by any separator, clean/sort/quote the items and join with another, live. */
import React, { useMemo, useState } from 'react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import {
  DEFAULT_LIST_OPTIONS, joinListItems, LIST_BRACKET_IDS, LIST_QUOTE_IDS, LIST_SEPARATOR_IDS, LIST_SORT_IDS, parseListItems, type ListOptions, type ListSeparatorId,
} from './convertOps';
import {
  ConvertPage, DualPane, INPUT_CLASS, LABEL_CLASS, Panel, prefillOf, SkyChips, StatChip, SwapButton, TextPane, ToggleField, Toolbar, ToolbarGroup,
  useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

interface ListInput {
  text: string;
  options: ListOptions;
}

const CHIP_PREVIEW_LIMIT = 60;

const ListConverterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<ListInput>(lastRun);
  const [text, setText] = useState(prefill.text ?? '');
  const [options, setOptions] = useState<ListOptions>({ ...DEFAULT_LIST_OPTIONS, ...prefill.options });
  const record = useRecorder(tool.id, variant);

  const items = useMemo(() => parseListItems(text, options), [text, options]);
  const output = useMemo(() => (items.length ? joinListItems(items, options) : ''), [items, options]);
  const patch = (next: Partial<ListOptions>): void => setOptions((prev) => ({ ...prev, ...next }));

  useDebouncedRecord(tool.id, variant, { text, options }, output, Boolean(text && output));

  const swap = (): void => {
    if (output) setText(output);
    patch({ from: options.to, fromCustom: options.toCustom, to: options.from, toCustom: options.fromCustom, quote: 'none', bracket: 'none' });
  };

  const separatorOptions = LIST_SEPARATOR_IDS.map((id) => ({ value: id, label: tc(`list.sep_${id}`) }));
  const customField = (id: ListSeparatorId, value: string, onChange: (next: string) => void): React.ReactNode => (id === 'custom' ? (
    <input value={value} onChange={(event) => onChange(event.target.value)} aria-label={tc('list.custom_separator')} className={`${INPUT_CLASS} !w-24 !py-1 font-mono`} />
  ) : null);

  return (
    <ConvertPage>
      <Toolbar>
        <ToolbarGroup label={tc('list.split_by')}>
          <SkyChips value={options.from} onChange={(from) => patch({ from })} options={separatorOptions} />
          {customField(options.from, options.fromCustom, (fromCustom) => patch({ fromCustom }))}
        </ToolbarGroup>
        <ToolbarGroup label={tc('list.join_with')}>
          <SkyChips value={options.to} onChange={(to) => patch({ to })} options={separatorOptions} />
          {customField(options.to, options.toCustom, (toCustom) => patch({ toCustom }))}
        </ToolbarGroup>
      </Toolbar>
      <Toolbar>
        <ToggleField label={tc('list.trim')} on={options.trim} onChange={(trim) => patch({ trim })} />
        <ToggleField label={tc('list.drop_empty')} on={options.dropEmpty} onChange={(dropEmpty) => patch({ dropEmpty })} />
        <ToggleField label={tc('list.unique')} on={options.unique} onChange={(unique) => patch({ unique })} />
        <ToolbarGroup label={tc('list.sort')}>
          <SkyChips value={options.sort} onChange={(sort) => patch({ sort })} options={LIST_SORT_IDS.map((id) => ({ value: id, label: tc(`list.sort_${id}`) }))} />
        </ToolbarGroup>
        <ToolbarGroup label={tc('list.quote')}>
          <SkyChips value={options.quote} onChange={(quote) => patch({ quote })} options={LIST_QUOTE_IDS.map((id) => ({ value: id, label: tc(`list.quote_${id}`) }))} />
        </ToolbarGroup>
        <ToolbarGroup label={tc('list.bracket')}>
          <SkyChips value={options.bracket} onChange={(bracket) => patch({ bracket })} options={LIST_BRACKET_IDS.map((id) => ({ value: id, label: tc(`list.bracket_${id}`) }))} />
        </ToolbarGroup>
      </Toolbar>
      <DualPane
        left={<TextPane label={tc('list.input')} value={text} onChange={setText} placeholder={tc('list.placeholder')} />}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={(
          <TextPane
            label={tc('list.output')}
            value={output}
            onCopied={() => record({ text, options }, output)}
            footer={items.length ? <StatChip>{tc('list.items', { count: items.length })}</StatChip> : null}
          />
        )}
      />
      {items.length > 0 && (
        <Panel className="space-y-2 p-3">
          <div className={LABEL_CLASS}>{tc('list.preview')}</div>
          <div className="flex flex-wrap gap-1.5">
            {items.slice(0, CHIP_PREVIEW_LIMIT).map((item, index) => (
              <span key={index} className="max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-700/60 dark:bg-white/5 dark:text-slate-200">{item}</span>
            ))}
            {items.length > CHIP_PREVIEW_LIMIT && <StatChip>{tc('list.more', { count: items.length - CHIP_PREVIEW_LIMIT })}</StatChip>}
          </div>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default ListConverterWorkbench;
