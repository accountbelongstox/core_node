/** Text <-> Unicode code points: five notations, live dual-pane and a per-code-point inspector table. */
import React, { useMemo, useState } from 'react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { decodeUnicodeText, describeCodePoints, encodeUnicodeText, type UnicodeFormat } from './convertCodecs';
import {
  attempt, ConvertPage, DualPane, errorMessage, LABEL_CLASS, Notice, Panel, prefillOf, SkyChips, StatChip, SwapButton, TextPane, Toolbar, ToolbarGroup,
  useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

type Mode = 'encode' | 'decode';

interface UnicodeInput {
  mode: Mode;
  format: UnicodeFormat;
  text: string;
}

const FORMATS: Array<{ id: UnicodeFormat; label: string }> = [
  { id: 'uplus', label: 'U+0041' },
  { id: 'js', label: '\\u0041' },
  { id: 'htmlHex', label: '&#x41;' },
  { id: 'htmlDec', label: '&#65;' },
  { id: 'css', label: '\\0041' },
];
const ROW_LIMIT = 200;

const TextToUnicodeWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<UnicodeInput>(lastRun);
  const [mode, setMode] = useState<Mode>(prefill.mode ?? 'encode');
  const [format, setFormat] = useState<UnicodeFormat>(prefill.format ?? 'uplus');
  const [text, setText] = useState(prefill.text ?? '');
  const record = useRecorder(tool.id, variant);

  const { value: output, error } = useMemo(() => attempt(() => {
    if (!text) return '';
    return mode === 'encode' ? encodeUnicodeText(text, format) : decodeUnicodeText(text, format);
  }), [mode, format, text]);
  const plain = mode === 'encode' ? text : output;
  const points = useMemo(() => describeCodePoints(plain.slice(0, ROW_LIMIT * 2)).slice(0, ROW_LIMIT), [plain]);
  const total = useMemo(() => Array.from(plain).length, [plain]);

  const snapshot: UnicodeInput = { mode, format, text };
  useDebouncedRecord(tool.id, variant, snapshot, output, Boolean(text && output && !error));

  const swap = (): void => {
    if (output && !error) setText(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };

  return (
    <ConvertPage>
      <Toolbar>
        <SkyChips value={mode} onChange={setMode} label={tc('common.mode')} options={[{ value: 'encode', label: tc('unicode.text_to_codes') }, { value: 'decode', label: tc('unicode.codes_to_text') }]} />
        <ToolbarGroup label={tc('unicode.format')}>
          <SkyChips value={format} onChange={setFormat} options={FORMATS.map(({ id, label }) => ({ value: id, label }))} />
        </ToolbarGroup>
      </Toolbar>
      <DualPane
        left={(
          <TextPane
            label={mode === 'encode' ? tc('unicode.text') : tc('unicode.codes')}
            value={text}
            onChange={setText}
            placeholder={mode === 'encode' ? tc('unicode.placeholder_text') : tc('unicode.placeholder_codes')}
            footer={plain ? <StatChip>{tc('unicode.code_points', { count: total })}</StatChip> : null}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={<TextPane label={mode === 'encode' ? tc('unicode.codes') : tc('unicode.text')} value={output} invalid={Boolean(error)} onCopied={() => record(snapshot, output)} />}
      />
      {error ? <Notice>{errorMessage(tc, error)}</Notice> : null}
      {points.length > 0 && (
        <Panel className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>{tc('unicode.inspector')}</span>
            {total > ROW_LIMIT && <StatChip>{tc('unicode.more', { count: total - ROW_LIMIT })}</StatChip>}
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700/60">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">{tc('unicode.col_char')}</th>
                  <th className="px-3 py-1.5 font-semibold">{tc('unicode.col_code')}</th>
                  <th className="px-3 py-1.5 font-semibold">{tc('unicode.col_decimal')}</th>
                  <th className="px-3 py-1.5 font-semibold">UTF-8</th>
                  <th className="px-3 py-1.5 font-semibold">UTF-16</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-700/50">
                {points.map((point, index) => (
                  <tr key={index} className="text-slate-800 dark:text-slate-100">
                    <td className="px-3 py-1.5 text-base">{point.code < 32 || point.code === 127 ? '\u00b7' : point.char}</td>
                    <td className="px-3 py-1.5 text-sky-700 dark:text-sky-300">{`U+${point.hex.padStart(4, '0')}`}</td>
                    <td className="px-3 py-1.5">{point.code}</td>
                    <td className="px-3 py-1.5">{point.utf8}</td>
                    <td className="px-3 py-1.5">{point.utf16}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default TextToUnicodeWorkbench;
