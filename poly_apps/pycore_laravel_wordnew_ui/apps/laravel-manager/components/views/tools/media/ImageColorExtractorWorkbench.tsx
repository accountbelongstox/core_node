/** Color extractor: proportional palette ribbon, click-to-copy swatches, pixel picker and CSS/JSON export. */
import React, { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Pipette } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { useToolRun } from '../toolRunner';
import { copyToClipboard } from '@/apps/laravel-manager/utils/exportResult';
import { ActionButton, Chip, Field, FloatingPill, Panel, Segmented, Slider, Workspace, useFlash, useMediaT } from './MediaKit';
import { ImageStage } from './ImageStage';
import { pickNumber, pickString } from './mediaFormat';
import { extractPalette, isLightColor, pixelColorAt, rgbToHex, rgbToHsl, samplePixels, type PaletteAlgorithm, type PaletteColor, type Rgb } from './palette';
import { useImageSource } from './useImageSource';

const ALGORITHMS: readonly PaletteAlgorithm[] = ['medianCut', 'kMeans'];
const EXPORT_FORMATS = ['hex', 'css', 'json'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];
const COUNT_MIN = 2;
const COUNT_MAX = 12;
const DEFAULT_COUNT = 6;
const PICK_KEY = 'picked';

interface PickedPoint { rgb: Rgb; x: number; y: number }

const exportText = (colors: readonly PaletteColor[], format: ExportFormat): string => {
  if (format === 'hex') return colors.map((c) => rgbToHex(c.rgb)).join('\n');
  if (format === 'css') return `:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${rgbToHex(c.rgb)};`).join('\n')}\n}`;
  return JSON.stringify(colors.map((c) => ({ hex: rgbToHex(c.rgb), rgb: c.rgb, hsl: rgbToHsl(c.rgb), share: Math.round(c.share * 1000) / 10 })), null, 2);
};

const Swatch: React.FC<{ color: PaletteColor; copied: boolean; onCopy: () => void; compact?: boolean }> = ({ color, copied, onCopy, compact = false }) => {
  const hex = rgbToHex(color.rgb);
  const [h, s, l] = rgbToHsl(color.rgb);
  return (
    <button
      type="button"
      onClick={onCopy}
      title={hex}
      className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 text-left transition-transform hover:-translate-y-0.5 dark:border-slate-700"
    >
      <span className={`flex items-center justify-between px-2 ${compact ? 'h-10' : 'h-14'} ${isLightColor(color.rgb) ? 'text-slate-900' : 'text-white'}`} style={{ backgroundColor: hex }}>
        <span className="font-mono text-xs font-black">{hex}</span>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />}
      </span>
      <span className="flex justify-between gap-1 bg-white px-2 py-1 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <span className="truncate">{color.rgb.join(', ')}</span>
        <span className="shrink-0">{h}/{s}/{l}</span>
      </span>
    </button>
  );
};

const ImageColorExtractorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const state = useImageSource();
  const { source } = state;
  const { run } = useToolRun<string>(tool.id, variant);
  const [count, setCount] = useState(() => Math.round(pickNumber(lastRun?.input, 'count', COUNT_MIN, COUNT_MAX, DEFAULT_COUNT)));
  const [algorithm, setAlgorithm] = useState<PaletteAlgorithm>(() => pickString(lastRun?.input, 'algorithm', ALGORITHMS, 'medianCut'));
  const [exportFormat, setExportFormat] = useState<ExportFormat>('hex');
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const [flashed, flash] = useFlash();

  const pixels = useMemo(() => (source ? samplePixels(source.preview) : null), [source]);
  const palette = useMemo(() => (pixels ? extractPalette(pixels, count, algorithm) : []), [pixels, count, algorithm]);
  const text = useMemo(() => exportText(palette, exportFormat), [palette, exportFormat]);

  const copy = useCallback(async (key: string, value: string, record = false) => {
    if (await copyToClipboard(value)) flash(key);
    if (record) await run({ count, algorithm }, async () => value);
  }, [flash, run, count, algorithm]);

  const pickPixel = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!source) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(source.width - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * source.width)));
    const y = Math.min(source.height - 1, Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * source.height)));
    const rgb = pixelColorAt(source.image, x, y);
    setPicked(rgb ? { rgb, x: x / source.width, y: y / source.height } : null);
  };

  return (
    <Workspace
      stage={(
        <ImageStage
          state={state}
          bottomLeft={<FloatingPill><Pipette className="h-3 w-3" />{m('colors.pick_hint')}</FloatingPill>}
          bottomRight={picked && (
            <button type="button" onClick={() => { void copy(PICK_KEY, rgbToHex(picked.rgb)); }} className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900/85 py-1 pl-1 pr-3 text-[11px] font-bold text-white shadow-lg backdrop-blur">
              <span className="h-5 w-5 rounded-full border border-white/40" style={{ backgroundColor: rgbToHex(picked.rgb) }} />
              <span className="font-mono">{rgbToHex(picked.rgb)}</span>
              {flashed === PICK_KEY ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        >
          {source && (
            <div className="flex max-w-full flex-col items-center gap-3">
              <div className="relative inline-block max-w-full">
                <img src={source.url} alt={source.file.name} draggable={false} onClick={pickPixel} className="block max-h-[52vh] max-w-full cursor-crosshair object-contain shadow-2xl" />
                {picked && <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" style={{ left: `${picked.x * 100}%`, top: `${picked.y * 100}%`, backgroundColor: rgbToHex(picked.rgb) }} />}
              </div>
              <div className="flex h-8 w-full max-w-xl overflow-hidden rounded-full shadow-lg ring-1 ring-black/10" aria-hidden>
                {palette.map((color, i) => <span key={i} style={{ backgroundColor: rgbToHex(color.rgb), flexGrow: Math.max(color.share, 0.02) }} />)}
              </div>
            </div>
          )}
        </ImageStage>
      )}
      panel={(
        <>
          <Panel title={m('colors.settings')}>
            <Field label={m('colors.algorithm')}>
              <Segmented value={algorithm} onChange={setAlgorithm} ariaLabel={m('colors.algorithm')} options={ALGORITHMS.map((value) => ({ value, label: m(`colors.algo_${value}`) }))} />
            </Field>
            <Field label={m('colors.count')}>
              <Slider value={count} min={COUNT_MIN} max={COUNT_MAX} onChange={setCount} nudge={1} ariaLabel={m('colors.count')} />
            </Field>
          </Panel>
          <Panel title={m('colors.palette')}>
            {palette.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">{m('colors.empty')}</p> : (
              <div className="grid grid-cols-2 gap-2">
                {palette.map((color, i) => (
                  <Swatch key={`${i}-${rgbToHex(color.rgb)}`} color={color} copied={flashed === `c${i}`} onCopy={() => { void copy(`c${i}`, rgbToHex(color.rgb)); }} />
                ))}
              </div>
            )}
          </Panel>
          <Panel title={m('colors.export')}>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_FORMATS.map((value) => <Chip key={value} active={exportFormat === value} onClick={() => setExportFormat(value)}>{m(`colors.export_${value}`)}</Chip>)}
            </div>
            <textarea readOnly value={text} rows={Math.min(8, Math.max(3, text.split('\n').length))} aria-label={m('colors.export')} className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
            <ActionButton onClick={() => { void copy('all', text, true); }} disabled={palette.length === 0} icon={flashed === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{m(flashed === 'all' ? 'common.copied' : 'colors.copy_all')}</ActionButton>
          </Panel>
        </>
      )}
    />
  );
};

export default ImageColorExtractorWorkbench;
