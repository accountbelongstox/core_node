/** One terminal view: its scrollback text laid out like the terminal, or its picture. */
import React from 'react';
import type { TerminalView } from '@/apps/pycore-manager/components/terminal/terminalFrames';
import PcTerminalTextView, { type PcTerminalTextSize } from '@/apps/pycore-manager/components/terminal/PcTerminalTextView';

interface Props {
  view: TerminalView;
  alt: string;
  size: PcTerminalTextSize;
  imageClassName?: string;
  onImageClick?: (event: React.MouseEvent<HTMLImageElement>) => void;
}

const PcTerminalFrameView: React.FC<Props> = ({ view, alt, size, imageClassName = '', onImageClick }) => {
  if (view.kind === 'text') return <PcTerminalTextView doc={view.doc} size={size} label={alt} />;
  return (
    <img
      src={view.frame.url}
      alt={alt}
      decoding="async"
      onClick={onImageClick}
      className={`h-full w-full object-contain ${imageClassName}`}
    />
  );
};

export default PcTerminalFrameView;
