/** Image rotator: angle dial with live canvas preview, optional canvas expansion and background fill. */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Download, RotateCcw, RotateCw } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, CanvasView, Chip, ErrorBanner, Field, FloatingPill, NumberField, Panel, Segmented, StatTile, Toggle, Workspace, useMediaT } from './MediaKit';
import { ImageStage } from './ImageStage';
import { ImageOutputControls, DEFAULT_QUALITY } from './ImageOutputControls';
import { useImageExport } from './useImageExport';
import { outputFileName, pickNumber, pickString } from './mediaFormat';
import { encodeImage, rotateImage, rotatedBounds, type ImageMime } from '@/core/media/ImageOps';
import { useImageSource } from './useImageSource';

const ANGLE_MIN = -180;
const ANGLE_MAX = 180;
const DIAL_SIZE = 132;
const DIAL_RADIUS = 52;
const ANGLE_CHIPS = [-90, -45, 45, 90, 180];
const FORMATS: readonly ImageMime[] = ['image/png', 'image/jpeg', 'image/webp'];
const BACKGROUND_MODES = ['transparent', 'color'] as const;
type BackgroundMode = (typeof BACKGROUND_MODES)[number];

const normalizeAngle = (value: number): number => {
  const wrapped = ((((Math.round(value) + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
};

const AngleDial: React.FC<{ angle: number; onChange: (angle: number) => void; label: string }> = ({ angle, onChange, label }) => {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const update = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    onChange(normalizeAngle((Math.atan2(dx, -dy) * 180) / Math.PI));
  };
  const rad = (angle * Math.PI) / 180;
  const center = DIAL_SIZE / 2;
  return (
    <svg
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={ANGLE_MIN}
      aria-valuemax={ANGLE_MAX}
      aria-valuenow={angle}
      tabIndex={0}
      viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
      className="mx-auto h-32 w-32 shrink-0 cursor-grab touch-none select-none text-amber-500 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:cursor-grabbing"
      onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); update(event.clientX, event.clientY); }}
      onPointerMove={(event) => { if (dragging.current) update(event.clientX, event.clientY); }}
      onPointerUp={() => { dragging.current = false; }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') onChange(normalizeAngle(angle + 1));
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') onChange(normalizeAngle(angle - 1));
      }}
    >
      <circle cx={center} cy={center} r={DIAL_RADIUS} className="fill-slate-50 stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600" strokeWidth={2} />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * 15 * Math.PI) / 180;
        const major = i % 6 === 0;
        const r1 = DIAL_RADIUS - (major ? 9 : 5);
        return <line key={i} x1={center + Math.sin(a) * r1} y1={center - Math.cos(a) * r1} x2={center + Math.sin(a) * (DIAL_RADIUS - 1)} y2={center - Math.cos(a) * (DIAL_RADIUS - 1)} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={major ? 2 : 1} />;
      })}
      <line x1={center} y1={center} x2={center + Math.sin(rad) * (DIAL_RADIUS - 6)} y2={center - Math.cos(rad) * (DIAL_RADIUS - 6)} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <circle cx={center + Math.sin(rad) * (DIAL_RADIUS - 6)} cy={center - Math.cos(rad) * (DIAL_RADIUS - 6)} r={7} fill="currentColor" />
      <circle cx={center} cy={center} r={4} className="fill-slate-700 dark:fill-slate-200" />
    </svg>
  );
};

const ImageRotatorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const state = useImageSource();
  const { source } = state;
  const { exportFile, error, running } = useImageExport(tool, variant);
  const [angle, setAngle] = useState(() => normalizeAngle(pickNumber(lastRun?.input, 'angle', ANGLE_MIN, ANGLE_MAX, 0)));
  const [expand, setExpand] = useState(true);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('transparent');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [format, setFormat] = useState<ImageMime>(() => pickString(lastRun?.input, 'format', FORMATS, 'image/png'));
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const fill = backgroundMode === 'color' ? backgroundColor : null;

  const preview = useMemo(() => {
    if (!source) return null;
    try {
      return rotateImage(source.preview, angle, expand, fill);
    } catch {
      return null;
    }
  }, [source, angle, expand, fill]);

  const bounds = source ? (expand ? rotatedBounds(source.width, source.height, angle) : { width: source.width, height: source.height }) : null;

  const download = useCallback(async () => {
    if (!source) return;
    await exportFile({ angle, expand, format }, async () => {
      const canvas = rotateImage(source.image, angle, expand, fill);
      const blob = await encodeImage(canvas, format, quality, fill ?? undefined);
      return { blob, fileName: outputFileName(source.file.name, `rotated${angle}`, format), width: canvas.width, height: canvas.height };
    });
  }, [source, exportFile, angle, expand, format, quality, fill]);

  return (
    <Workspace
      stage={(
        <ImageStage state={state} bottomLeft={<FloatingPill><RotateCw className="h-3 w-3" /><span className="font-mono">{angle}°</span></FloatingPill>}>
          <CanvasView canvas={preview} />
        </ImageStage>
      )}
      panel={(
        <>
          <Panel title={m('rotator.angle')}>
            <AngleDial angle={angle} onChange={setAngle} label={m('rotator.angle')} />
            <div className="flex items-center gap-2">
              <button type="button" aria-label={m('rotator.minus_one')} onClick={() => setAngle((a) => normalizeAngle(a - 1))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><RotateCcw className="h-4 w-4" /></button>
              <NumberField value={angle} min={ANGLE_MIN} max={ANGLE_MAX} suffix="°" ariaLabel={m('rotator.angle')} className="flex-1" onChange={(v) => setAngle(Number.isNaN(v) ? 0 : normalizeAngle(v))} />
              <button type="button" aria-label={m('rotator.plus_one')} onClick={() => setAngle((a) => normalizeAngle(a + 1))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><RotateCw className="h-4 w-4" /></button>
            </div>
            <input type="range" aria-label={m('rotator.angle')} min={ANGLE_MIN} max={ANGLE_MAX} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-amber-500" />
            <div className="flex flex-wrap gap-1.5">
              {ANGLE_CHIPS.map((value) => <Chip key={value} active={angle === value} onClick={() => setAngle(value)}>{value > 0 ? `+${value}°` : `${value}°`}</Chip>)}
              <Chip onClick={() => setAngle(0)} disabled={angle === 0}>{m('rotator.reset')}</Chip>
            </div>
          </Panel>
          <Panel title={m('rotator.canvas')}>
            <Toggle checked={expand} onChange={setExpand} label={m('rotator.expand')} />
            <Field label={m('rotator.background')}>
              <div className="flex items-center gap-2">
                <Segmented<BackgroundMode> value={backgroundMode} onChange={setBackgroundMode} ariaLabel={m('rotator.background')} options={BACKGROUND_MODES.map((value) => ({ value, label: m(`rotator.bg_${value}`) }))} />
                {backgroundMode === 'color' && <input type="color" aria-label={m('rotator.background')} value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-600" />}
              </div>
            </Field>
            {bounds && (
              <div className="grid grid-cols-2 gap-2">
                <StatTile label={m('common.original')} value={`${source?.width} x ${source?.height}`} />
                <StatTile label={m('common.result')} value={`${bounds.width} x ${bounds.height}`} />
              </div>
            )}
          </Panel>
          <Panel title={m('output.title')}>
            <ImageOutputControls format={format} quality={quality} onFormat={setFormat} onQuality={setQuality} formats={FORMATS} />
            <ActionButton onClick={() => { void download(); }} disabled={!source} busy={running} icon={<Download className="h-4 w-4" />}>{m('common.download')}</ActionButton>
            <ErrorBanner message={error} />
          </Panel>
        </>
      )}
    />
  );
};

export default ImageRotatorWorkbench;
