/** Image cropper: draggable/resizable selection over the image, aspect presets, numeric fields and a live result thumbnail. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crop, Download } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Chip, ErrorBanner, Field, FloatingPill, NumberField, Panel, Workspace, useMediaT } from './MediaKit';
import { ImageStage } from './ImageStage';
import { ImageOutputControls, DEFAULT_QUALITY } from './ImageOutputControls';
import { useImageExport } from './useImageExport';
import { outputFileName, pickString } from './mediaFormat';
import {
  ASPECT_PRESETS, IMAGE_MIMES, clampRect, cropImage, dragCropRect, encodeImage, fitAspect, supportsEncoding,
  type CropHandle, type ImageMime, type PixelRect,
} from '@/core/media/ImageOps';
import { useImageSource } from './useImageSource';

const THUMB_MAX_SIDE = 200;
const INITIAL_FRACTION = 0.8;
const HANDLE_POSITIONS: ReadonlyArray<{ handle: CropHandle; className: string; cursor: string }> = [
  { handle: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { handle: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { handle: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { handle: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { handle: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { handle: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { handle: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
  { handle: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
];

interface DragState { handle: CropHandle; startX: number; startY: number; start: PixelRect }

const initialRect = (width: number, height: number): PixelRect =>
  clampRect({ x: (width * (1 - INITIAL_FRACTION)) / 2, y: (height * (1 - INITIAL_FRACTION)) / 2, width: width * INITIAL_FRACTION, height: height * INITIAL_FRACTION }, { width, height });

const ImageCropperWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const state = useImageSource();
  const { source } = state;
  const { exportFile, error, running } = useImageExport(tool, variant);
  const [rect, setRect] = useState<PixelRect | null>(null);
  const [aspectId, setAspectId] = useState('free');
  const [format, setFormat] = useState<ImageMime>(() => pickString(lastRun?.input, 'format', IMAGE_MIMES, 'image/png'));
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const frameRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<DragState | null>(null);
  const bounds = useMemo(() => (source ? { width: source.width, height: source.height } : null), [source]);

  const ratio = useMemo(() => {
    const preset = ASPECT_PRESETS.find((p) => p.id === aspectId);
    if (!preset || preset.ratio === null || !bounds) return null;
    return preset.ratio === 0 ? bounds.width / bounds.height : preset.ratio;
  }, [aspectId, bounds]);

  useEffect(() => {
    if (!source) {
      setRect(null);
      return;
    }
    setRect(initialRect(source.width, source.height));
    setAspectId('free');
    const sourceType = source.file.type as ImageMime;
    if (IMAGE_MIMES.includes(sourceType) && supportsEncoding(sourceType)) setFormat(sourceType);
  }, [source]);

  useEffect(() => {
    const canvas = thumbRef.current;
    if (!canvas || !source || !rect) return;
    const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(rect.width, rect.height));
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    ctx?.drawImage(source.image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
  }, [source, rect]);

  const pickAspect = useCallback((id: string) => {
    setAspectId(id);
    if (!bounds || !rect) return;
    const preset = ASPECT_PRESETS.find((p) => p.id === id);
    if (!preset || preset.ratio === null) return;
    const target = preset.ratio === 0 ? bounds.width / bounds.height : preset.ratio;
    const fitted = fitAspect({ width: rect.width, height: rect.height }, target);
    setRect(clampRect({ x: rect.x + fitted.x, y: rect.y + fitted.y, width: fitted.width, height: fitted.height }, bounds));
  }, [bounds, rect]);

  const beginDrag = (handle: CropHandle, event: React.PointerEvent, start: PixelRect) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { handle, startX: event.clientX, startY: event.clientY, start };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    const frame = frameRef.current;
    if (!current || !frame || !bounds) return;
    const scale = frame.clientWidth / bounds.width;
    setRect(dragCropRect(current.start, current.handle, (event.clientX - current.startX) / scale, (event.clientY - current.startY) / scale, bounds, ratio));
  };

  const onFramePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame || !bounds) return;
    const box = frame.getBoundingClientRect();
    const scale = frame.clientWidth / bounds.width;
    const x = Math.min(bounds.width - 1, Math.max(0, (event.clientX - box.left) / scale));
    const y = Math.min(bounds.height - 1, Math.max(0, (event.clientY - box.top) / scale));
    const start: PixelRect = { x, y, width: 1, height: 1 };
    setRect(start);
    beginDrag('se', event, start);
  };

  const setField = (key: keyof PixelRect, value: number) => {
    if (!bounds || !rect || Number.isNaN(value)) return;
    const next = { ...rect, [key]: value };
    if (ratio && key === 'width') next.height = value / ratio;
    if (ratio && key === 'height') next.width = value * ratio;
    setRect(clampRect(next, bounds));
  };

  const download = useCallback(async () => {
    if (!source || !rect) return;
    await exportFile({ ...rect, format }, async () => {
      const canvas = cropImage(source.image, rect);
      const blob = await encodeImage(canvas, format, quality);
      return { blob, fileName: outputFileName(source.file.name, `crop-${rect.width}x${rect.height}`, format), width: canvas.width, height: canvas.height };
    });
  }, [source, rect, exportFile, format, quality]);

  const percent = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <Workspace
      stage={(
        <ImageStage state={state} bottomLeft={rect && <FloatingPill><Crop className="h-3 w-3" /><span className="font-mono">{rect.width} x {rect.height}</span></FloatingPill>}>
          {source && rect && bounds && (
            <div
              ref={frameRef}
              onPointerDown={onFramePointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => { drag.current = null; }}
              className="relative max-w-full cursor-crosshair touch-none select-none"
              style={{ aspectRatio: `${bounds.width} / ${bounds.height}`, width: `min(100%, calc(60vh * ${bounds.width / bounds.height}))` }}
            >
              <img src={source.url} alt={source.file.name} draggable={false} className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="absolute cursor-move border border-white shadow-[0_0_0_9999px_rgba(2,6,23,0.6)]"
                  style={{ left: percent(rect.x, bounds.width), top: percent(rect.y, bounds.height), width: percent(rect.width, bounds.width), height: percent(rect.height, bounds.height) }}
                  onPointerDown={(event) => beginDrag('move', event, rect)}
                >
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }, (_, i) => <div key={i} className="border border-white/25" />)}
                  </div>
                </div>
              </div>
              <div className="absolute" style={{ left: percent(rect.x, bounds.width), top: percent(rect.y, bounds.height), width: percent(rect.width, bounds.width), height: percent(rect.height, bounds.height), pointerEvents: 'none' }}>
                {HANDLE_POSITIONS.map(({ handle, className, cursor }) => (
                  <div
                    key={handle}
                    onPointerDown={(event) => beginDrag(handle, event, rect)}
                    className={`pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-amber-500 bg-white ${className}`}
                    style={{ cursor }}
                  />
                ))}
              </div>
            </div>
          )}
        </ImageStage>
      )}
      panel={(
        <>
          <Panel title={m('cropper.aspect')}>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_PRESETS.map((preset) => (
                <Chip key={preset.id} active={aspectId === preset.id} onClick={() => pickAspect(preset.id)} disabled={!source}>
                  {preset.id === 'free' || preset.id === 'original' ? m(`cropper.${preset.id}`) : preset.id}
                </Chip>
              ))}
            </div>
          </Panel>
          <Panel title={m('cropper.selection')}>
            <div className="grid grid-cols-2 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map((key) => (
                <Field key={key} label={m(`cropper.${key}`)}>
                  <NumberField value={rect ? rect[key] : 0} min={key === 'x' || key === 'y' ? 0 : 1} suffix="px" ariaLabel={m(`cropper.${key}`)} onChange={(v) => setField(key, v)} />
                </Field>
              ))}
            </div>
            <Chip onClick={() => bounds && setRect({ x: 0, y: 0, width: bounds.width, height: bounds.height })} disabled={!source}>{m('cropper.select_all')}</Chip>
          </Panel>
          <Panel title={m('output.title')}>
            <div className="flex items-center gap-3">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900">
                <canvas ref={thumbRef} className="max-h-full max-w-full" />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{m('cropper.thumb_hint')}</span>
            </div>
            <ImageOutputControls format={format} quality={quality} onFormat={setFormat} onQuality={setQuality} />
            <ActionButton onClick={() => { void download(); }} disabled={!source || !rect} busy={running} icon={<Download className="h-4 w-4" />}>{m('common.download')}</ActionButton>
            <ErrorBanner message={error} />
          </Panel>
        </>
      )}
    />
  );
};

export default ImageCropperWorkbench;
