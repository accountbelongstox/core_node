/**
 * Text and image are redundant transports of one terminal. Text is preferred while it matches the screen;
 * the picture covers a window whose text is missing or outdated, and either can be forced per window.
 */
import type { TerminalImageFrame } from '@/apps/pycore-manager/components/terminal/transport/TerminalImageTransport';
import type { TerminalTextDoc } from '@/apps/pycore-manager/components/terminal/transport/TerminalTextTransport';

export type TerminalViewMode = 'auto' | 'text' | 'image';

export type TerminalView =
  | { kind: 'text'; doc: TerminalTextDoc }
  | { kind: 'image'; frame: TerminalImageFrame };

export function selectTerminalView(
  text: TerminalTextDoc | null,
  image: TerminalImageFrame | null,
  mode: TerminalViewMode,
): TerminalView | null {
  const textView = text ? { kind: 'text' as const, doc: text } : null;
  const imageView = image ? { kind: 'image' as const, frame: image } : null;
  if (mode === 'image') return imageView ?? textView;
  if (mode === 'text') return textView ?? imageView;
  if (text && !text.stale) return textView;
  return imageView ?? textView;
}

/** Whether the window's picture must be transferred: forced, or its text cannot stand in for it. */
export function terminalNeedsImage(text: TerminalTextDoc | null, mode: TerminalViewMode): boolean {
  if (mode === 'image') return true;
  if (mode === 'text') return text === null;
  return text === null || text.stale;
}
