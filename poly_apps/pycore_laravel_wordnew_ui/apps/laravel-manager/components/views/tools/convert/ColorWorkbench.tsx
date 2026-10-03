/** Color converter: swatch with native picker, HSL/alpha sliders and five linked notation fields. */
import React, { useState } from 'react';
import { Pipette } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import {
  COLOR_FIELD_IDS, contrastRatio, DEFAULT_HSLA, formatColorField, formatHex, hslToRgb, parseColor, shadeStrip, type ColorFieldId, type Hsla,
} from './convertColor';
import { ConvertPage, CopyButton, INPUT_CLASS, LABEL_CLASS, MONO_CLASS, Panel, prefillOf, StatChip, useConvertT, useDebouncedRecord, useRecorder } from './convertKit';

interface ColorInput {
  hex: string;
}

const CHECKERBOARD = 'repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%) 50% / 16px 16px';
const SLIDER_CLASS = 'h-2.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:shadow';
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const AA_RATIO = 4.5;
const AAA_RATIO = 7;

interface SliderRowProps {
  label: string;
  value: number;
  max: number;
  step: number;
  gradient: string;
  display: string;
  onChange: (value: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, max, step, gradient, display, onChange }) => (
  <label className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
    <span className={LABEL_CLASS}>{label}</span>
    <input type="range" min={0} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={SLIDER_CLASS} style={{ background: gradient }} />
    <span className="text-right font-mono text-xs text-slate-600 dark:text-slate-300">{display}</span>
  </label>
);

const contrastBadge = (ratio: number): string => (ratio >= AAA_RATIO ? 'AAA' : ratio >= AA_RATIO ? 'AA' : ratio >= 3 ? 'AA Large' : '\u2715');

const ColorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<ColorInput>(lastRun);
  const [hsla, setHsla] = useState<Hsla>(() => (prefill.hex ? parseColor(prefill.hex) : null) ?? DEFAULT_HSLA);
  const [editing, setEditing] = useState<{ field: ColorFieldId; text: string } | null>(null);
  const record = useRecorder(tool.id, variant);

  const rgba = hslToRgb(hsla);
  const hex = formatHex(rgba);
  const solid = formatHex({ ...rgba, a: 1 });
  const cssColor = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${hsla.a})`;
  const onWhite = contrastRatio({ ...rgba, a: 1 }, WHITE);
  const onBlack = contrastRatio({ ...rgba, a: 1 }, BLACK);
  const textOnSwatch = onWhite >= onBlack ? '#ffffff' : '#000000';

  const patch = (next: Partial<Hsla>): void => {
    setEditing(null);
    setHsla((prev) => ({ ...prev, ...next }));
  };

  const editField = (field: ColorFieldId, text: string): void => {
    setEditing({ field, text });
    const parsed = parseColor(text, hsla);
    if (parsed) setHsla(parsed);
  };

  const summary = COLOR_FIELD_IDS.map((field) => formatColorField(field, hsla)).join(' | ');
  useDebouncedRecord(tool.id, variant, { hex }, summary, true);

  const satCss = `linear-gradient(to right, hsl(${hsla.h}, 0%, ${hsla.l}%), hsl(${hsla.h}, 100%, ${hsla.l}%))`;
  const lightCss = `linear-gradient(to right, #000, hsl(${hsla.h}, ${hsla.s}%, 50%), #fff)`;
  const alphaCss = `linear-gradient(to right, transparent, ${solid})`;

  return (
    <ConvertPage>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <Panel className="overflow-hidden">
            <div className="relative h-40 sm:h-48" style={{ background: CHECKERBOARD }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ backgroundColor: cssColor, color: textOnSwatch }}>
                <span className="font-mono text-2xl font-bold">{hex}</span>
                <span className="text-xs opacity-80">{tc('color.sample_text')}</span>
              </div>
              <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white">
                <Pipette className="h-3.5 w-3.5" />
                {tc('color.pick')}
                <input type="color" value={solid.toLowerCase()} onChange={(event) => { const parsed = parseColor(event.target.value, hsla); if (parsed) { setEditing(null); setHsla({ ...parsed, a: hsla.a }); } }} className="sr-only" />
              </label>
            </div>
            <div className="flex flex-wrap gap-1 border-t border-slate-100 p-2 dark:border-slate-700/50">
              {shadeStrip(hsla).map((shade, index) => (
                <button key={index} type="button" aria-label={formatHex(hslToRgb({ ...shade, a: 1 }))} onClick={() => patch({ l: shade.l })} className="h-7 min-w-[1.6rem] flex-1 rounded-md border border-black/10" style={{ backgroundColor: `hsl(${shade.h}, ${shade.s}%, ${shade.l}%)` }} />
              ))}
            </div>
          </Panel>
          <Panel className="space-y-3 p-3">
            <SliderRow label="H" value={Math.round(hsla.h)} max={360} step={1} gradient="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" display={`${Math.round(hsla.h)}\u00b0`} onChange={(h) => patch({ h })} />
            <SliderRow label="S" value={Math.round(hsla.s)} max={100} step={1} gradient={satCss} display={`${Math.round(hsla.s)}%`} onChange={(s) => patch({ s })} />
            <SliderRow label="L" value={Math.round(hsla.l)} max={100} step={1} gradient={lightCss} display={`${Math.round(hsla.l)}%`} onChange={(l) => patch({ l })} />
            <SliderRow label="A" value={Math.round(hsla.a * 100)} max={100} step={1} gradient={`${alphaCss}, ${CHECKERBOARD}`} display={`${Math.round(hsla.a * 100)}%`} onChange={(a) => patch({ a: a / 100 })} />
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel className="space-y-2 p-3">
            {COLOR_FIELD_IDS.map((field) => {
              const text = editing?.field === field ? editing.text : formatColorField(field, hsla);
              const invalid = editing?.field === field && parseColor(text, hsla) === null;
              return (
                <div key={field} className="grid grid-cols-[3.2rem_minmax(0,1fr)_auto] items-center gap-2">
                  <span className={LABEL_CLASS}>{field.toUpperCase()}</span>
                  <input
                    value={text}
                    spellCheck={false}
                    onChange={(event) => editField(field, event.target.value)}
                    onBlur={() => setEditing(null)}
                    aria-label={field.toUpperCase()}
                    className={`${INPUT_CLASS} ${MONO_CLASS} ${invalid ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                  />
                  <CopyButton text={formatColorField(field, hsla)} onCopied={() => record({ hex }, formatColorField(field, hsla))} />
                </div>
              );
            })}
          </Panel>
          <Panel className="space-y-2 p-3">
            <div className={LABEL_CLASS}>{tc('color.contrast')}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700/60" style={{ color: solid }}>
                <span className="text-sm font-semibold">{tc('color.on_white')}</span>
                <StatChip>{`${onWhite.toFixed(2)} ${contrastBadge(onWhite)}`}</StatChip>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-black px-3 py-2" style={{ color: solid }}>
                <span className="text-sm font-semibold">{tc('color.on_black')}</span>
                <StatChip>{`${onBlack.toFixed(2)} ${contrastBadge(onBlack)}`}</StatChip>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </ConvertPage>
  );
};

export default ColorWorkbench;
