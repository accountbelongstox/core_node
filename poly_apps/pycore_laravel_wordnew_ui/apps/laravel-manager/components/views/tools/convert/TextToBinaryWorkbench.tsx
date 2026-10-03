/** Text <-> bytes in binary/octal/decimal/hex with a per-byte bit tile view. */
import React, { useMemo, useState } from 'react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { bytesToUtf8, formatByte, parseRadixBytes, utf8ToBytes, type BinaryRadix } from './convertCodecs';
import {
  attempt, ConvertPage, DualPane, errorMessage, LABEL_CLASS, Notice, Panel, prefillOf, SkyChips, StatChip, SwapButton, TextPane, Toolbar, ToolbarGroup,
  useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

type Mode = 'encode' | 'decode';

interface BinaryInput {
  mode: Mode;
  radix: BinaryRadix;
  separator: string;
  text: string;
}

const RADIXES: BinaryRadix[] = [2, 8, 10, 16];
const SEPARATORS = [' ', ',', ''];
const TILE_LIMIT = 96;

const bytesFor = (mode: Mode, text: string, radix: BinaryRadix): Uint8Array => (mode === 'encode' ? utf8ToBytes(text) : parseRadixBytes(text, radix));

const TextToBinaryWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<BinaryInput>(lastRun);
  const [mode, setMode] = useState<Mode>(prefill.mode ?? 'encode');
  const [radix, setRadix] = useState<BinaryRadix>(prefill.radix ?? 2);
  const [separator, setSeparator] = useState(prefill.separator ?? ' ');
  const [text, setText] = useState(prefill.text ?? '');
  const record = useRecorder(tool.id, variant);

  const parsed = useMemo(() => {
    if (!text) return { bytes: new Uint8Array(0), error: null as unknown };
    try {
      return { bytes: bytesFor(mode, text, radix), error: null as unknown };
    } catch (error) {
      return { bytes: new Uint8Array(0), error };
    }
  }, [mode, text, radix]);
  const { bytes, error } = parsed;
  const output = useMemo(() => attempt(() => {
    if (!bytes.length) return '';
    return mode === 'encode' ? Array.from(bytes, (b) => formatByte(b, radix)).join(separator) : bytesToUtf8(bytes, false);
  }).value, [bytes, mode, radix, separator]);

  const snapshot: BinaryInput = { mode, radix, separator, text };
  useDebouncedRecord(tool.id, variant, snapshot, output, Boolean(text && output && !error));

  const swap = (): void => {
    if (output && !error) setText(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };
  const radixLabel = tc(`binary.radix_${radix}`);

  return (
    <ConvertPage>
      <Toolbar>
        <SkyChips value={mode} onChange={setMode} label={tc('common.mode')} options={[{ value: 'encode', label: tc('binary.text_to_bytes') }, { value: 'decode', label: tc('binary.bytes_to_text') }]} />
        <ToolbarGroup label={tc('binary.radix')}>
          <SkyChips value={radix} onChange={setRadix} options={RADIXES.map((value) => ({ value, label: tc(`binary.radix_${value}`) }))} />
        </ToolbarGroup>
        {mode === 'encode' && (
          <ToolbarGroup label={tc('binary.separator')}>
            <SkyChips value={separator} onChange={setSeparator} options={SEPARATORS.map((value) => ({ value, label: tc(`binary.sep_${value === ' ' ? 'space' : value === ',' ? 'comma' : 'none'}`) }))} />
          </ToolbarGroup>
        )}
      </Toolbar>
      <DualPane
        left={(
          <TextPane
            label={mode === 'encode' ? tc('binary.text') : radixLabel}
            value={text}
            onChange={setText}
            placeholder={mode === 'encode' ? tc('binary.placeholder_text') : tc('binary.placeholder_bytes')}
            footer={text ? <StatChip>{tc('binary.bytes', { count: bytes.length })}</StatChip> : null}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={<TextPane label={mode === 'encode' ? radixLabel : tc('binary.text')} value={output} invalid={Boolean(error)} onCopied={() => record(snapshot, output)} />}
      />
      {error ? <Notice>{errorMessage(tc, error)}</Notice> : null}
      {bytes.length > 0 && (
        <Panel className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>{tc('binary.byte_view')}</span>
            {bytes.length > TILE_LIMIT && <StatChip>{tc('binary.more', { count: bytes.length - TILE_LIMIT })}</StatChip>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(bytes.subarray(0, TILE_LIMIT), (byte, index) => (
              <div key={index} className="flex w-[3.4rem] flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1.5 dark:border-slate-700/60 dark:bg-white/5" title={`${byte}`}>
                <span className="h-4 font-mono text-xs text-slate-700 dark:text-slate-200">{byte > 32 && byte < 127 ? String.fromCharCode(byte) : '·'}</span>
                <div className="grid grid-cols-4 gap-px">
                  {Array.from({ length: 8 }, (_v, bit) => (
                    <span key={bit} className={`h-2 w-2 rounded-[2px] ${(byte >> (7 - bit)) & 1 ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{byte.toString(16).toUpperCase().padStart(2, '0')}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default TextToBinaryWorkbench;
