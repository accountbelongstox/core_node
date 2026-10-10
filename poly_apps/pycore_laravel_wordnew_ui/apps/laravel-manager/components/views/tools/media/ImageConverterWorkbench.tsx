/** Image converter: pick PNG/JPEG/WebP, tune quality and background, compare the converted file with the original. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, CompareSlider, ErrorBanner, Field, FloatingPill, Notice, Panel, Segmented, Slider, StatTile, Workspace, useMediaT } from './MediaKit';
import { ImageStage } from './ImageStage';
import { FORMAT_LABELS, DEFAULT_QUALITY } from './ImageOutputControls';
import { SizeBars } from './SizeBars';
import { useEncodedPreview } from './useEncodedPreview';
import { useImageExport } from './useImageExport';
import { outputFileName, pickString, useObjectUrl } from './mediaFormat';
import { IMAGE_MIMES, encodeImage, supportsEncoding, type ImageMime } from '@/core/media/ImageOps';
import { useImageSource } from './useImageSource';

const QUALITY_MIN = 1;
const QUALITY_MAX = 100;
const TRANSPARENT_TYPES = ['image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];

const typeLabel = (mime: string): string => (FORMAT_LABELS[mime as ImageMime] ?? mime.replace('image/', '').toUpperCase());

const ImageConverterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const state = useImageSource();
  const { source } = state;
  const { exportFile, error: exportError, running } = useImageExport(tool, variant);
  const [format, setFormat] = useState<ImageMime>(() => pickString(lastRun?.input, 'format', IMAGE_MIMES, 'image/webp'));
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [background, setBackground] = useState('#ffffff');

  useEffect(() => {
    if (source && source.file.type === format) setFormat((prev) => (prev === 'image/png' ? 'image/webp' : 'image/png'));
  }, [source]);

  const compute = useMemo(() => (source
    ? async () => {
      const blob = await encodeImage(source.image, format, quality, background);
      return { blob, width: source.width, height: source.height };
    }
    : null), [source, format, quality, background]);
  const { result, busy, error } = useEncodedPreview(compute, [source, format, quality, background]);
  const resultUrl = useObjectUrl(result?.blob ?? null);
  const flattening = Boolean(source) && format === 'image/jpeg' && TRANSPARENT_TYPES.includes(source?.file.type ?? '');

  const download = useCallback(async () => {
    if (!source || !result) return;
    await exportFile({ format, quality }, async () => ({
      blob: result.blob, fileName: outputFileName(source.file.name, 'converted', format), width: result.width, height: result.height,
    }));
  }, [source, result, exportFile, format, quality]);

  return (
    <Workspace
      stage={(
        <ImageStage
          state={state}
          bottomLeft={source && (
            <FloatingPill><span className="font-semibold">{typeLabel(source.file.type)}</span><ArrowRight className="h-3 w-3" /><span className="font-semibold">{FORMAT_LABELS[format]}</span></FloatingPill>
          )}
        >
          {source && resultUrl && result && (
            <CompareSlider beforeSrc={source.url} afterSrc={resultUrl} width={result.width} height={result.height} beforeLabel={typeLabel(source.file.type)} afterLabel={FORMAT_LABELS[format]} ariaLabel={m('common.compare')} />
          )}
          {source && !resultUrl && <img src={source.url} alt="" className="max-h-[62vh] max-w-full object-contain opacity-60" />}
        </ImageStage>
      )}
      panel={(
        <>
          <Panel title={m('converter.target')}>
            <Field label={m('output.format')}>
              <Segmented<ImageMime>
                value={format}
                onChange={setFormat}
                ariaLabel={m('output.format')}
                options={IMAGE_MIMES.map((value) => ({ value, label: FORMAT_LABELS[value], disabled: !supportsEncoding(value) }))}
              />
            </Field>
            {format !== 'image/png' && (
              <Field label={m('output.quality')}>
                <Slider value={Math.round(quality * 100)} min={QUALITY_MIN} max={QUALITY_MAX} onChange={(v) => setQuality(v / 100)} format={(v) => `${v}%`} ariaLabel={m('output.quality')} />
              </Field>
            )}
            {format === 'image/jpeg' && (
              <Field label={m('converter.background')} hint={flattening ? undefined : m('converter.background_hint')}>
                <input type="color" aria-label={m('converter.background')} value={background} onChange={(e) => setBackground(e.target.value)} className="h-8 w-full cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-600" />
              </Field>
            )}
            {flattening && <Notice tone="warn">{m('converter.flatten_notice')}</Notice>}
          </Panel>
          <Panel title={m('output.title')}>
            {source && <SizeBars before={source.file.size} after={result?.blob.size ?? null} busy={busy} />}
            {source && result && <div className="grid grid-cols-2 gap-2"><StatTile label={m('common.original')} value={typeLabel(source.file.type)} /><StatTile label={m('common.result')} value={FORMAT_LABELS[format]} /></div>}
            <ActionButton onClick={() => { void download(); }} disabled={!result || busy} busy={running} icon={<Download className="h-4 w-4" />}>{m('common.download')}</ActionButton>
            <ErrorBanner message={error ? m(`errors.${error}`) : exportError} />
          </Panel>
        </>
      )}
    />
  );
};

export default ImageConverterWorkbench;
