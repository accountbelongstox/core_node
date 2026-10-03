/** Structured data converter: JSON / YAML / TOML / XML in any direction, parsed and written entirely in the browser. */
import React, { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import {
  convertData, DATA_FORMATS, DEFAULT_STRUCTURED_OPTIONS, INDENT_CHOICES, SAMPLE_VALUE, stringifyData, VARIANT_PRESETS, type DataFormat, type IndentChoice,
  type StructuredResult,
} from './structured';
import {
  ConvertPage, DualPane, errorMessage, ICON_BUTTON_CLASS, Notice, prefillOf, SkyChips, StatChip, SwapButton, TextPane, ToggleField, Toolbar, ToolbarGroup,
  useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

interface StructuredInput {
  from: DataFormat;
  to: DataFormat;
  text: string;
  indent: IndentChoice;
  typedXml: boolean;
}

const FORMAT_LABELS: Record<DataFormat, string> = { json: 'JSON', yaml: 'YAML', toml: 'TOML', xml: 'XML' };
const EMPTY_RESULT: StructuredResult = { text: '', nullsOmitted: false };

const StructuredWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const preset = VARIANT_PRESETS[variant];
  const prefill = prefillOf<StructuredInput>(lastRun?.variant === variant ? lastRun : undefined);
  const [from, setFrom] = useState<DataFormat>(preset?.from ?? prefill.from ?? 'json');
  const [to, setTo] = useState<DataFormat>(preset?.to ?? prefill.to ?? 'yaml');
  const [text, setText] = useState(prefill.text ?? '');
  const [indent, setIndent] = useState<IndentChoice>(prefill.indent ?? DEFAULT_STRUCTURED_OPTIONS.indent);
  const [typedXml, setTypedXml] = useState(prefill.typedXml ?? DEFAULT_STRUCTURED_OPTIONS.typedXml);
  const record = useRecorder(tool.id, variant);

  const options = useMemo(() => ({ indent, typedXml }), [indent, typedXml]);
  const outcome = useMemo(() => {
    try {
      return { result: convertData(from, to, text, options), error: null as unknown };
    } catch (error) {
      return { result: EMPTY_RESULT, error };
    }
  }, [from, to, text, options]);
  const { result, error } = outcome;

  const snapshot: StructuredInput = { from, to, text, indent, typedXml };
  useDebouncedRecord(tool.id, variant, snapshot, result.text, Boolean(text.trim() && result.text && !error));

  const swap = (): void => {
    if (result.text && !error) setText(result.text);
    setFrom(to);
    setTo(from);
  };
  const insertSample = (): void => setText(stringifyData(from, SAMPLE_VALUE, { ...options, indent: '2' }).text);
  const formatOptions = DATA_FORMATS.map((id) => ({ value: id, label: FORMAT_LABELS[id] }));

  return (
    <ConvertPage>
      <Toolbar>
        <ToolbarGroup label={tc('structured.from')}>
          <SkyChips value={from} onChange={setFrom} options={formatOptions} />
        </ToolbarGroup>
        <ToolbarGroup label={tc('structured.to')}>
          <SkyChips value={to} onChange={setTo} options={formatOptions} />
        </ToolbarGroup>
        {to !== 'toml' && (
          <ToolbarGroup label={tc('structured.indent')}>
            <SkyChips value={indent} onChange={setIndent} options={INDENT_CHOICES.map((id) => ({ value: id, label: id === 'tab' ? tc('structured.indent_tab') : id, disabled: id === 'tab' && to === 'yaml' }))} />
          </ToolbarGroup>
        )}
        {from === 'xml' && <ToggleField label={tc('structured.typed_xml')} on={typedXml} onChange={setTypedXml} />}
      </Toolbar>
      <DualPane
        left={(
          <TextPane
            label={FORMAT_LABELS[from]}
            value={text}
            onChange={setText}
            placeholder={tc('structured.placeholder', { format: FORMAT_LABELS[from] })}
            rows={14}
            wrap={false}
            invalid={Boolean(error)}
            actions={(
              <button type="button" onClick={insertSample} className={ICON_BUTTON_CLASS} title={tc('structured.sample')}>
                <Wand2 className="h-3.5 w-3.5" />{tc('structured.sample')}
              </button>
            )}
            footer={text ? <StatChip>{tc('structured.lines', { count: text.split('\n').length })}</StatChip> : null}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={(
          <TextPane
            label={FORMAT_LABELS[to]}
            value={result.text}
            rows={14}
            wrap={false}
            onCopied={() => record(snapshot, result.text)}
            footer={result.text ? <StatChip>{tc('structured.lines', { count: result.text.replace(/\n$/, '').split('\n').length })}</StatChip> : null}
          />
        )}
      />
      {error ? <Notice>{errorMessage(tc, error)}</Notice> : null}
      {result.nullsOmitted && <Notice tone="warning">{tc('structured.toml_nulls')}</Notice>}
    </ConvertPage>
  );
};

export default StructuredWorkbench;
