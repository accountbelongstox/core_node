/** Slug generator: live per-line slugs with separator, length and Unicode controls and a URL preview. */
import React, { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { DEFAULT_SLUG_OPTIONS, slugifyText, type SlugOptions } from './convertOps';
import { ConvertPage, DualPane, LABEL_CLASS, Panel, prefillOf, SkyChips, StatChip, TextPane, ToggleField, Toolbar, ToolbarGroup, useConvertT, useDebouncedRecord, useRecorder } from './convertKit';
import { RangeField } from '@/shared/ui/RangeField';

interface SlugInput {
  text: string;
  options: SlugOptions;
}

const SEPARATORS = ['-', '_', '.'];
const MAX_LENGTH_LIMIT = 120;
const MAX_LENGTH_STEP = 5;
const PREVIEW_BASE = 'https://example.com/blog/';

const SlugWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<SlugInput>(lastRun);
  const [text, setText] = useState(prefill.text ?? '');
  const [options, setOptions] = useState<SlugOptions>({ ...DEFAULT_SLUG_OPTIONS, ...prefill.options });
  const record = useRecorder(tool.id, variant);

  const output = useMemo(() => slugifyText(text, options), [text, options]);
  const firstSlug = output.split('\n').find(Boolean) ?? '';
  const patch = (next: Partial<SlugOptions>): void => setOptions((prev) => ({ ...prev, ...next }));

  useDebouncedRecord(tool.id, variant, { text, options }, output, Boolean(text && output));

  return (
    <ConvertPage>
      <Toolbar>
        <ToolbarGroup label={tc('slug.separator')}>
          <SkyChips value={options.separator} onChange={(separator) => patch({ separator })} options={SEPARATORS.map((value) => ({ value, label: value }))} />
        </ToolbarGroup>
        <ToggleField label={tc('slug.lowercase')} on={options.lowercase} onChange={(lowercase) => patch({ lowercase })} />
        <ToggleField label={tc('slug.keep_unicode')} on={options.keepUnicode} onChange={(keepUnicode) => patch({ keepUnicode })} />
        <div className="flex min-w-[12rem] flex-1 items-center gap-2">
          <span className={LABEL_CLASS}>{tc('slug.max_length')}</span>
          <RangeField
            className="flex-1"
            value={options.maxLength}
            min={0}
            max={MAX_LENGTH_LIMIT}
            step={MAX_LENGTH_STEP}
            onChange={(maxLength) => patch({ maxLength })}
            trailing={<span className="w-10 text-right font-mono text-xs text-slate-600 dark:text-slate-300">{options.maxLength === 0 ? tc('common.off') : options.maxLength}</span>}
          />
        </div>
      </Toolbar>
      <DualPane
        left={<TextPane label={tc('slug.input')} value={text} onChange={setText} placeholder={tc('slug.placeholder')} rows={7} />}
        center={<span className="rotate-90 text-slate-400 lg:rotate-0">&rarr;</span>}
        right={(
          <TextPane
            label={tc('slug.output')}
            value={output}
            rows={7}
            onCopied={() => record({ text, options }, output)}
            footer={output ? <StatChip>{tc('slug.length', { count: firstSlug.length })}</StatChip> : null}
          />
        )}
      />
      {firstSlug && (
        <Panel className="flex items-center gap-2 overflow-hidden px-3 py-2.5">
          <Link2 className="h-4 w-4 shrink-0 text-sky-500" />
          <span className="min-w-0 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
            {PREVIEW_BASE}<span className="font-semibold text-sky-700 dark:text-sky-300">{firstSlug}</span>
          </span>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default SlugWorkbench;
