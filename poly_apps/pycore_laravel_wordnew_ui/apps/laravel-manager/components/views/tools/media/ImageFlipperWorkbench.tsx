/** Image flipper: two mirror toggles with an animated CSS preview; the exported file is flipped on a canvas. */
import React, { useCallback, useState } from 'react';
import { Download, FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, ErrorBanner, FloatingPill, Panel, TONE, Workspace, useMediaT } from './MediaKit';
import { ImageStage } from './ImageStage';
import { ImageOutputControls, DEFAULT_QUALITY } from './ImageOutputControls';
import { useImageExport } from './useImageExport';
import { outputFileName, isRecord, pickString } from './mediaFormat';
import { encodeImage, flipImage, type ImageMime } from '@/core/media/ImageOps';
import { useImageSource } from './useImageSource';

const FORMATS: readonly ImageMime[] = ['image/png', 'image/jpeg', 'image/webp'];

const FlipTile: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string }> = ({ active, onClick, icon, label, hint }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-4 text-center transition-colors ${active ? `${TONE.amber.soft} ${TONE.amber.ring}` : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'}`}
  >
    {icon}
    <span className="text-xs font-bold">{label}</span>
    <span className="text-[10px] opacity-70">{hint}</span>
  </button>
);

const ImageFlipperWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const state = useImageSource();
  const { source } = state;
  const { exportFile, error, running } = useImageExport(tool, variant);
  const last = lastRun?.input;
  const [horizontal, setHorizontal] = useState(() => (isRecord(last) ? last.horizontal !== false : true));
  const [vertical, setVertical] = useState(() => (isRecord(last) ? last.vertical === true : false));
  const [format, setFormat] = useState<ImageMime>(() => pickString(last, 'format', FORMATS, 'image/png'));
  const [quality, setQuality] = useState(DEFAULT_QUALITY);

  const download = useCallback(async () => {
    if (!source) return;
    await exportFile({ horizontal, vertical, format }, async () => {
      const canvas = flipImage(source.image, horizontal, vertical);
      const blob = await encodeImage(canvas, format, quality);
      return { blob, fileName: outputFileName(source.file.name, `flipped${horizontal ? '-h' : ''}${vertical ? '-v' : ''}`, format), width: canvas.width, height: canvas.height };
    });
  }, [source, exportFile, horizontal, vertical, format, quality]);

  return (
    <Workspace
      stage={(
        <ImageStage
          state={state}
          bottomLeft={(
            <>
              <FloatingPill><FlipHorizontal2 className="h-3 w-3" />{m(horizontal ? 'common.on' : 'common.off')}</FloatingPill>
              <FloatingPill><FlipVertical2 className="h-3 w-3" />{m(vertical ? 'common.on' : 'common.off')}</FloatingPill>
            </>
          )}
        >
          {source && (
            <img
              src={source.url}
              alt={source.file.name}
              draggable={false}
              className="block max-h-[62vh] max-w-full object-contain shadow-2xl transition-transform duration-300 ease-out"
              style={{ transform: `scale(${horizontal ? -1 : 1}, ${vertical ? -1 : 1})` }}
            />
          )}
        </ImageStage>
      )}
      panel={(
        <>
          <Panel title={m('flipper.axes')}>
            <div className="flex gap-2">
              <FlipTile active={horizontal} onClick={() => setHorizontal((v) => !v)} icon={<FlipHorizontal2 className="h-6 w-6" />} label={m('flipper.horizontal')} hint={m('flipper.horizontal_hint')} />
              <FlipTile active={vertical} onClick={() => setVertical((v) => !v)} icon={<FlipVertical2 className="h-6 w-6" />} label={m('flipper.vertical')} hint={m('flipper.vertical_hint')} />
            </div>
            {horizontal && vertical && <p className="text-[11px] text-slate-500 dark:text-slate-400">{m('flipper.both_note')}</p>}
          </Panel>
          <Panel title={m('output.title')}>
            <ImageOutputControls format={format} quality={quality} onFormat={setFormat} onQuality={setQuality} formats={FORMATS} />
            <ActionButton onClick={() => { void download(); }} disabled={!source || (!horizontal && !vertical)} busy={running} icon={<Download className="h-4 w-4" />}>{m('common.download')}</ActionButton>
            <ErrorBanner message={error} />
          </Panel>
        </>
      )}
    />
  );
};

export default ImageFlipperWorkbench;
