/** Image compressor: quality slider and optional size cap with live encoded size, savings bars and a before/after compare. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Target } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Chip, CompareSlider, ErrorBanner, Field, FloatingPill, Notice, NumberField, Panel, Workspace, useMediaT } from './MediaKit';
import { ImageStage } from './ImageStage';
import { ImageOutputControls, FORMAT_LABELS } from './ImageOutputControls';
import { SizeBars } from './SizeBars';
import { useEncodedPreview } from './useEncodedPreview';
import { useImageExport } from './useImageExport';
import { formatBytes, outputFileName, pickNumber, pickString, useObjectUrl } from './mediaFormat';
import { encodeImage, fitQualityToSize, resizeImage, supportsEncoding, type ImageMime } from '@/core/media/ImageOps';
import { useImageSource } from './useImageSource';

const FORMATS: readonly ImageMime[] = ['image/jpeg', 'image/webp', 'image/png'];
const DEFAULT_COMPRESS_QUALITY = 0.75;
const MAX_SIDE_PRESETS = [0, 4096, 2560, 1920, 1280, 1024];
const BYTES_PER_KB = 1024;

const ImageCompressorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const state = useImageSource();
  const { source } = state;
  const { exportFile, error: exportError, running } = useImageExport(tool, variant);
  const [format, setFormat] = useState<ImageMime>(() => pickString(lastRun?.input, 'format', FORMATS, 'image/webp'));
  const [quality, setQuality] = useState(() => pickNumber(lastRun?.input, 'quality', 0.01, 1, DEFAULT_COMPRESS_QUALITY));
  const [maxSide, setMaxSide] = useState(() => pickNumber(lastRun?.input, 'maxSide', 0, 16384, 0));
  const [targetKb, setTargetKb] = useState(200);
  const [fitting, setFitting] = useState(false);
  const [fitMissed, setFitMissed] = useState(false);

  useEffect(() => {
    if (!source) return;
    const sourceType = source.file.type as ImageMime;
    if (FORMATS.includes(sourceType) && sourceType !== 'image/png' && supportsEncoding(sourceType)) setFormat(sourceType);
    setFitMissed(false);
  }, [source]);

  const working = useMemo(() => {
    if (!source) return null;
    const longest = Math.max(source.width, source.height);
    if (maxSide === 0 || longest <= maxSide) return { image: source.image, width: source.width, height: source.height };
    const scale = maxSide / longest;
    const width = Math.round(source.width * scale);
    const height = Math.round(source.height * scale);
    return { image: resizeImage(source.image, width, height), width, height };
  }, [source, maxSide]);

  const compute = useMemo(() => (working
    ? async () => ({ blob: await encodeImage(working.image, format, quality), width: working.width, height: working.height })
    : null), [working, format, quality]);
  const { result, busy, error } = useEncodedPreview(compute, [working, format, quality], 160);
  const resultUrl = useObjectUrl(result?.blob ?? null);

  const fitToTarget = useCallback(async () => {
    if (!working || format === 'image/png') return;
    setFitting(true);
    setFitMissed(false);
    try {
      const fit = await fitQualityToSize(working.image, format, targetKb * BYTES_PER_KB);
      if (fit) setQuality(Math.floor(fit.quality * 100) / 100);
      else setFitMissed(true);
    } finally {
      setFitting(false);
    }
  }, [working, format, targetKb]);

  const download = useCallback(async () => {
    if (!source || !result) return;
    await exportFile({ format, quality, maxSide }, async () => ({
      blob: result.blob, fileName: outputFileName(source.file.name, 'compressed', format), width: result.width, height: result.height,
    }));
  }, [source, result, exportFile, format, quality, maxSide]);

  const grew = Boolean(source && result && result.blob.size >= source.file.size);

  return (
    <Workspace
      stage={(
        <ImageStage
          state={state}
          bottomLeft={result && <FloatingPill><span className="font-mono">{result.width}x{result.height}</span></FloatingPill>}
          bottomRight={source && result && <FloatingPill><span className="font-mono">{formatBytes(source.file.size)} {'->'} {formatBytes(result.blob.size)}</span></FloatingPill>}
        >
          {source && resultUrl && result && (
            <CompareSlider beforeSrc={source.url} afterSrc={resultUrl} width={result.width} height={result.height} beforeLabel={m('common.original')} afterLabel={m('common.result')} ariaLabel={m('common.compare')} />
          )}
          {source && !resultUrl && <img src={source.url} alt="" className="max-h-[62vh] max-w-full object-contain opacity-60" />}
        </ImageStage>
      )}
      panel={(
        <>
          <Panel title={m('compressor.settings')}>
            <ImageOutputControls format={format} quality={quality} onFormat={setFormat} onQuality={setQuality} formats={FORMATS} />
            {format === 'image/png' && <Notice>{m('compressor.png_note', { format: FORMAT_LABELS['image/webp'] })}</Notice>}
            <Field label={m('compressor.max_side')}>
              <div className="flex flex-wrap gap-1.5">
                {MAX_SIDE_PRESETS.map((value) => <Chip key={value} active={maxSide === value} disabled={!source} onClick={() => setMaxSide(value)}>{value === 0 ? m('compressor.keep_size') : `${value}px`}</Chip>)}
              </div>
            </Field>
            <Field label={m('compressor.target')} hint={fitMissed ? m('compressor.target_missed') : m('compressor.target_hint')}>
              <div className="flex items-center gap-2">
                <NumberField value={targetKb} min={1} suffix="KB" ariaLabel={m('compressor.target')} className="flex-1" onChange={(v) => setTargetKb(Number.isNaN(v) ? 1 : Math.max(1, v))} />
                <ActionButton onClick={() => { void fitToTarget(); }} variant="ghost" disabled={!source || format === 'image/png'} busy={fitting} icon={<Target className="h-4 w-4" />}>{m('compressor.fit')}</ActionButton>
              </div>
            </Field>
          </Panel>
          <Panel title={m('output.title')}>
            {source && <SizeBars before={source.file.size} after={result?.blob.size ?? null} busy={busy} />}
            {grew && <Notice tone="warn">{m('compressor.already_small')}</Notice>}
            <ActionButton onClick={() => { void download(); }} disabled={!result || busy} busy={running} icon={<Download className="h-4 w-4" />}>{m('common.download')}</ActionButton>
            <ErrorBanner message={error ? m(`errors.${error}`) : exportError} />
          </Panel>
        </>
      )}
    />
  );
};

export default ImageCompressorWorkbench;
