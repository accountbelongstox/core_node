/** Image resizer: pixel/percent targets with aspect lock and a before/after compare of the encoded result. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Link2, Unlink2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Chip, CompareSlider, ErrorBanner, Field, FloatingPill, NumberField, Panel, StatTile, Workspace, useMediaT } from './MediaKit';
import { ImageStage } from './ImageStage';
import { ImageOutputControls, DEFAULT_QUALITY } from './ImageOutputControls';
import { SizeBars } from './SizeBars';
import { useEncodedPreview } from './useEncodedPreview';
import { useImageExport } from './useImageExport';
import { formatBytes, outputFileName, pickString, useObjectUrl } from './mediaFormat';
import { IMAGE_MIMES, MAX_IMAGE_SIDE, clamp, encodeImage, resizeImage, supportsEncoding, type ImageMime } from '@/core/media/ImageOps';
import { useImageSource } from './useImageSource';

const PERCENT_PRESETS = [25, 50, 75, 150, 200];
const WIDTH_PRESETS = [320, 640, 1080, 1280, 1920];

const ImageResizerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const state = useImageSource();
  const { source } = state;
  const { exportFile, error: exportError, running } = useImageExport(tool, variant);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [lock, setLock] = useState(true);
  const [format, setFormat] = useState<ImageMime>(() => pickString(lastRun?.input, 'format', IMAGE_MIMES, 'image/png'));
  const [quality, setQuality] = useState(DEFAULT_QUALITY);

  useEffect(() => {
    if (!source) return;
    setSize({ width: source.width, height: source.height });
    const sourceType = source.file.type as ImageMime;
    if (IMAGE_MIMES.includes(sourceType) && supportsEncoding(sourceType)) setFormat(sourceType);
  }, [source]);

  const aspect = source ? source.width / source.height : 1;
  const setWidth = useCallback((value: number) => {
    if (Number.isNaN(value)) return;
    const width = clamp(Math.round(value), 1, MAX_IMAGE_SIDE);
    setSize((prev) => ({ width, height: lock ? clamp(Math.round(width / aspect), 1, MAX_IMAGE_SIDE) : prev.height }));
  }, [lock, aspect]);
  const setHeight = useCallback((value: number) => {
    if (Number.isNaN(value)) return;
    const height = clamp(Math.round(value), 1, MAX_IMAGE_SIDE);
    setSize((prev) => ({ height, width: lock ? clamp(Math.round(height * aspect), 1, MAX_IMAGE_SIDE) : prev.width }));
  }, [lock, aspect]);

  const compute = useMemo(() => (source && size.width > 0 && size.height > 0
    ? async () => {
      const canvas = resizeImage(source.image, size.width, size.height);
      return { blob: await encodeImage(canvas, format, quality), width: canvas.width, height: canvas.height };
    }
    : null), [source, size.width, size.height, format, quality]);
  const { result, busy, error } = useEncodedPreview(compute, [source, size.width, size.height, format, quality]);
  const resultUrl = useObjectUrl(result?.blob ?? null);
  const percent = source ? Math.round((size.width / source.width) * 1000) / 10 : 100;

  const download = useCallback(async () => {
    if (!source || !result) return;
    await exportFile({ ...size, format }, async () => ({
      blob: result.blob, fileName: outputFileName(source.file.name, `${result.width}x${result.height}`, format), width: result.width, height: result.height,
    }));
  }, [source, result, exportFile, size, format]);

  return (
    <Workspace
      stage={(
        <ImageStage
          state={state}
          bottomLeft={result && <FloatingPill><span className="font-mono">{source?.width}x{source?.height} {'->'} {result.width}x{result.height}</span></FloatingPill>}
          bottomRight={result && <FloatingPill><span className="font-mono">{formatBytes(result.blob.size)}</span></FloatingPill>}
        >
          {source && resultUrl && result && (
            <CompareSlider beforeSrc={source.url} afterSrc={resultUrl} width={result.width} height={result.height} beforeLabel={m('common.original')} afterLabel={m('common.result')} ariaLabel={m('common.compare')} />
          )}
          {source && !resultUrl && <img src={source.url} alt="" className="max-h-[62vh] max-w-full object-contain opacity-60" />}
        </ImageStage>
      )}
      panel={(
        <>
          <Panel title={m('resizer.dimensions')}>
            <div className="flex items-end gap-2">
              <Field label={m('resizer.width')}><NumberField value={size.width} min={1} max={MAX_IMAGE_SIDE} suffix="px" ariaLabel={m('resizer.width')} onChange={setWidth} /></Field>
              <button type="button" aria-pressed={lock} title={m('resizer.lock')} onClick={() => setLock((v) => !v)} className={`mb-0.5 shrink-0 rounded-lg p-2 ${lock ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                {lock ? <Link2 className="h-4 w-4" /> : <Unlink2 className="h-4 w-4" />}
              </button>
              <Field label={m('resizer.height')}><NumberField value={size.height} min={1} max={MAX_IMAGE_SIDE} suffix="px" ariaLabel={m('resizer.height')} onChange={setHeight} /></Field>
            </div>
            <Field label={m('resizer.percent')} trailing={<span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{percent}%</span>}>
              <div className="flex flex-wrap gap-1.5">
                {PERCENT_PRESETS.map((p) => <Chip key={p} active={Math.abs(percent - p) < 0.5} disabled={!source} onClick={() => source && setWidth((source.width * p) / 100)}>{p}%</Chip>)}
              </div>
            </Field>
            <Field label={m('resizer.width_presets')}>
              <div className="flex flex-wrap gap-1.5">
                {WIDTH_PRESETS.map((w) => <Chip key={w} active={size.width === w} disabled={!source} onClick={() => setWidth(w)}>{w}</Chip>)}
              </div>
            </Field>
          </Panel>
          <Panel title={m('output.title')}>
            <ImageOutputControls format={format} quality={quality} onFormat={setFormat} onQuality={setQuality} />
            {source && <SizeBars before={source.file.size} after={result?.blob.size ?? null} busy={busy} />}
            {result && <div className="grid grid-cols-2 gap-2"><StatTile label={m('common.original')} value={`${source?.width}x${source?.height}`} /><StatTile label={m('common.result')} value={`${result.width}x${result.height}`} /></div>}
            <ActionButton onClick={() => { void download(); }} disabled={!result || busy} busy={running} icon={<Download className="h-4 w-4" />}>{m('common.download')}</ActionButton>
            <ErrorBanner message={error ? m(`errors.${error}`) : exportError} />
          </Panel>
        </>
      )}
    />
  );
};

export default ImageResizerWorkbench;
