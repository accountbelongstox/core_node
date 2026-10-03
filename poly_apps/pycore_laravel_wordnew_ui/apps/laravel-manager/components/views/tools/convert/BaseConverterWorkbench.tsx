/** Number base converter: linked BigInt fields (2/8/10/16/36/custom) plus a clickable bit grid. */
import React, { useState } from 'react';
import { NumberInput } from '@/shared/ui/NumberInput';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { BASE_MAX, BASE_MIN, formatBaseValue, groupDigits, parseBaseValue } from './convertOps';
import { ConvertPage, CopyButton, INPUT_CLASS, LABEL_CLASS, MONO_CLASS, Panel, prefillOf, SkyChips, StatChip, useConvertT, useDebouncedRecord } from './convertKit';

interface BaseInput {
  decimal: string;
  custom: number;
}

type FieldId = '2' | '8' | '10' | '16' | '36' | 'custom';

const FIXED_BASES: Array<{ id: FieldId; base: number }> = [
  { id: '2', base: 2 }, { id: '8', base: 8 }, { id: '10', base: 10 }, { id: '16', base: 16 }, { id: '36', base: 36 },
];
const WIDTHS = [8, 16, 32, 64];
const DEFAULT_CUSTOM_BASE = 3;
const ZERO = BigInt(0);
const ONE = BigInt(1);

const BaseConverterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<BaseInput>(lastRun);
  const [custom, setCustom] = useState(prefill.custom && prefill.custom >= BASE_MIN && prefill.custom <= BASE_MAX ? prefill.custom : DEFAULT_CUSTOM_BASE);
  const [value, setValue] = useState<bigint | null>(() => parseBaseValue(prefill.decimal ?? '255', 10));
  const [editing, setEditing] = useState<{ id: FieldId; text: string } | null>(null);
  const [width, setWidth] = useState(8);

  const fields = [...FIXED_BASES, { id: 'custom' as FieldId, base: custom }];
  const baseOf = (id: FieldId): number => (id === 'custom' ? custom : Number(id));

  const edit = (id: FieldId, text: string): void => {
    setEditing({ id, text });
    if (text.trim() === '') {
      setValue(null);
      return;
    }
    const parsed = parseBaseValue(text, baseOf(id));
    if (parsed !== null) setValue(parsed);
  };

  const bitLength = value !== null && value >= ZERO ? value.toString(2).length : 0;
  const gridAvailable = value !== null && value >= ZERO && bitLength <= 64;
  const activeWidth = Math.max(width, WIDTHS.find((candidate) => candidate >= bitLength) ?? 64);
  const decimalText = value === null ? '' : formatBaseValue(value, 10);

  useDebouncedRecord(tool.id, variant, { decimal: decimalText, custom }, value === null ? '' : FIXED_BASES.map(({ base }) => formatBaseValue(value, base)).join(' | '), value !== null);

  const toggleBit = (index: number): void => {
    if (value === null) return;
    setEditing(null);
    setValue(value ^ (ONE << BigInt(index)));
  };

  return (
    <ConvertPage>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ id, base }) => {
          const text = editing?.id === id ? editing.text : value === null ? '' : formatBaseValue(value, base);
          const invalid = editing?.id === id && text.trim() !== '' && parseBaseValue(text, base) === null;
          return (
            <Panel key={id} className={`space-y-1.5 p-3 ${invalid ? 'ring-1 ring-rose-400/60' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={LABEL_CLASS}>{id === 'custom' ? tc('base.custom') : tc(`base.name_${id}`)}</span>
                <div className="flex items-center gap-1">
                  {id === 'custom' && <NumberInput value={custom} min={BASE_MIN} max={BASE_MAX} step={1} label={tc('base.custom_base')} onChange={(next) => { setEditing(null); setCustom(next); }} className="w-14 text-center" />}
                  {id !== 'custom' && <StatChip>{`\u00d7${base}`}</StatChip>}
                  <CopyButton text={value === null ? '' : formatBaseValue(value, base)} />
                </div>
              </div>
              <input
                value={text}
                spellCheck={false}
                autoCapitalize="characters"
                onChange={(event) => edit(id, event.target.value)}
                onBlur={() => setEditing(null)}
                aria-label={id === 'custom' ? tc('base.custom') : tc(`base.name_${id}`)}
                className={`${INPUT_CLASS} ${MONO_CLASS} ${invalid ? 'border-rose-400 focus:ring-rose-400' : ''}`}
              />
              {id === '2' && value !== null && value >= ZERO && <div className="break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">{groupDigits(formatBaseValue(value, 2), 4)}</div>}
              {id === '10' && value !== null && <div className="break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">{groupDigits(formatBaseValue(value, 10), 3)}</div>}
            </Panel>
          );
        })}
      </div>
      {gridAvailable && value !== null && (
        <Panel className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={LABEL_CLASS}>{tc('base.bits')}</span>
            <div className="flex items-center gap-2">
              <StatChip>{tc('base.bit_length', { count: Math.max(bitLength, 1) })}</StatChip>
              <SkyChips value={activeWidth} onChange={setWidth} options={WIDTHS.map((candidate) => ({ value: candidate, label: String(candidate), disabled: candidate < bitLength }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {Array.from({ length: activeWidth / 8 }, (_v, byteIndex) => {
              const byte = activeWidth / 8 - 1 - byteIndex;
              return (
                <div key={byte} className="flex gap-0.5">
                  {Array.from({ length: 8 }, (_b, bitIndex) => {
                    const position = byte * 8 + 7 - bitIndex;
                    const on = ((value >> BigInt(position)) & ONE) === ONE;
                    return (
                      <button
                        key={position}
                        type="button"
                        onClick={() => toggleBit(position)}
                        title={`2^${position}`}
                        aria-pressed={on}
                        className={`h-7 w-6 rounded font-mono text-xs transition ${on ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10'}`}
                      >
                        {on ? 1 : 0}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default BaseConverterWorkbench;
