/** One terminal frame: its OCR text when the server could read it, otherwise its picture. */
import React, { useLayoutEffect, useRef } from 'react';
import type { TerminalFrame } from '@/apps/pycore-manager/components/terminal/terminalFrames';

export type PcTerminalFrameSize = 'tiny' | 'card' | 'preview';

const TEXT_SIZE_CLASSES: Record<PcTerminalFrameSize, string> = {
  tiny: 'text-[7px] leading-[9px] p-1',
  card: 'text-[10px] leading-[13px] p-2',
  preview: 'text-xs leading-5 p-4 pt-14',
};

interface Props {
  frame: TerminalFrame;
  alt: string;
  size: PcTerminalFrameSize;
  imageClassName?: string;
  onImageClick?: (event: React.MouseEvent<HTMLImageElement>) => void;
}

const PcTerminalFrameView: React.FC<Props> = ({ frame, alt, size, imageClassName = '', onImageClick }) => {
  const textRef = useRef<HTMLPreElement | null>(null);

  // A terminal reads from the bottom: keep the newest lines in view.
  useLayoutEffect(() => {
    const element = textRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [frame.text]);

  if (frame.kind === 'image') {
    return (
      <img
        src={frame.url}
        alt={alt}
        decoding="async"
        onClick={onImageClick}
        className={`h-full w-full object-contain ${imageClassName}`}
      />
    );
  }
  return (
    <pre
      ref={textRef}
      aria-label={alt}
      className={`absolute inset-0 m-0 whitespace-pre-wrap break-words bg-slate-950 text-left font-mono text-slate-200 ${
        size === 'preview' ? 'select-text overflow-auto' : 'overflow-hidden'
      } ${TEXT_SIZE_CLASSES[size]}`}
    >
      {frame.text}
    </pre>
  );
};

export default PcTerminalFrameView;
