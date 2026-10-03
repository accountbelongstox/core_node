/** Lightbox stage shared by the image workbenches: empty drop target, or the image stage with floating bars. */
import React, { useRef } from 'react';
import { Replace, Trash2 } from 'lucide-react';
import { DropZone, ErrorBanner, FileMeta, FloatingBar, FloatingButton, RunBadge, Stage, useMediaT } from './MediaKit';
import type { ImageSourceState } from './useImageSource';

interface ImageStageProps {
  state: ImageSourceState;
  /** Content centered on the checkerboard (canvas, compare slider, crop overlay...). */
  children: React.ReactNode;
  /** Right side of the bottom floating bar. */
  bottomRight?: React.ReactNode;
  bottomLeft?: React.ReactNode;
  /** Extra items on the top bar (right side). */
  topRight?: React.ReactNode;
  className?: string;
}

const IMAGE_ACCEPT = 'image/*';

export const ImageStage: React.FC<ImageStageProps> = ({ state, children, bottomLeft, bottomRight, topRight, className }) => {
  const m = useMediaT();
  const pickerRef = useRef<HTMLInputElement>(null);
  const { source, loading, error, load, clear, pasteFromClipboard } = state;
  const onFiles = (files: File[]) => { if (files[0]) void load(files[0]); };
  const errorBanner = error ? <ErrorBanner message={m(`errors.${error}`)} /> : null;

  if (!source) {
    return (
      <div className="flex flex-col gap-2">
        <DropZone
          accept={IMAGE_ACCEPT}
          title={m(loading ? 'stage.loading' : 'stage.drop_title')}
          hint={m('stage.drop_hint')}
          pickLabel={m('stage.pick')}
          pasteLabel={m('stage.paste')}
          onFiles={onFiles}
          onPaste={() => { void pasteFromClipboard(); }}
        />
        {errorBanner}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <DropZone accept={IMAGE_ACCEPT} title="" hint="" pickLabel="" onFiles={onFiles}>
        <Stage className={className}>
          <FloatingBar position="top">
            <FileMeta name={source.file.name} width={source.width} height={source.height} bytes={source.file.size} />
            <div className="flex items-center gap-1.5">
              {topRight}
              <RunBadge />
              <input ref={pickerRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
              <FloatingButton onClick={() => pickerRef.current?.click()} title={m('stage.replace')}><Replace className="h-3 w-3" />{m('stage.replace')}</FloatingButton>
              <FloatingButton onClick={clear} title={m('stage.clear')}><Trash2 className="h-3 w-3" />{m('stage.clear')}</FloatingButton>
            </div>
          </FloatingBar>
          {children}
          {(bottomLeft || bottomRight) && (
            <FloatingBar position="bottom"><div className="flex flex-wrap items-center gap-1.5">{bottomLeft}</div><div className="flex flex-wrap items-center gap-1.5">{bottomRight}</div></FloatingBar>
          )}
        </Stage>
      </DropZone>
      {errorBanner}
    </div>
  );
};
