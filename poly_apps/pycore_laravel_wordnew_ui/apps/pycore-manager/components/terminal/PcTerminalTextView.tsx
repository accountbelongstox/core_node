/**
 * Terminal scrollback laid out like the terminal: a monospace block exactly `columns` cells wide that wraps
 * long lines at the terminal width, scaled so those columns fill the panel, scrollable through all lines.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TerminalTextDoc } from '@/apps/pycore-manager/components/terminal/terminalFrames';

export type PcTerminalTextSize = 'tiny' | 'card' | 'preview';

const MEASURE_FONT_PX = 100;
const MEASURE_SAMPLE = '0'.repeat(50);
const LINE_HEIGHT = 1.25;
const BOTTOM_SLACK_PX = 24;
/** Cards show the end of the scrollback only; the preview renders every line. */
const CARD_TAIL_LINES = 160;

const SIZES: Record<PcTerminalTextSize, { minPx: number; maxPx: number; padding: string; scroll: boolean }> = {
  tiny: { minPx: 3, maxPx: 9, padding: 'p-1', scroll: false },
  card: { minPx: 4, maxPx: 12, padding: 'p-2', scroll: false },
  preview: { minPx: 10, maxPx: 16, padding: 'px-4 pb-4 pt-14', scroll: true },
};

/** Width of one monospace cell per pixel of font size, measured once in the page's mono font. */
let cellRatio: number | null = null;
function monospaceCellRatio(host: HTMLElement): number {
  if (cellRatio !== null) return cellRatio;
  const probe = document.createElement('span');
  probe.textContent = MEASURE_SAMPLE;
  probe.className = 'font-mono';
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:${MEASURE_FONT_PX}px`;
  host.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  host.removeChild(probe);
  cellRatio = width > 0 ? width / MEASURE_SAMPLE.length / MEASURE_FONT_PX : 0.6;
  return cellRatio;
}

interface Props {
  doc: TerminalTextDoc;
  size: PcTerminalTextSize;
  label: string;
}

const PcTerminalTextView: React.FC<Props> = ({ doc, size, label }) => {
  const { t } = useTranslation('pc');
  const layout = SIZES[size];
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const [fontPx, setFontPx] = useState(layout.minPx);

  const text = useMemo(
    () => (layout.scroll ? doc.lines : doc.lines.slice(-CARD_TAIL_LINES)).join('\n'),
    [doc.lines, layout.scroll],
  );

  // Fit the terminal width to the panel: one font size per panel width and column count.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const fit = (): void => {
      const style = getComputedStyle(scroller);
      const available = scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const fitted = available / Math.max(1, doc.columns * monospaceCellRatio(scroller));
      setFontPx(Math.min(layout.maxPx, Math.max(layout.minPx, fitted)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [doc.columns, layout.maxPx, layout.minPx]);

  // A terminal reads from the bottom: stay there unless the reader scrolled up into the history.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller && pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [text, fontPx]);

  const onScroll = (): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    pinnedRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < BOTTOM_SLACK_PX;
  };

  return (
    <div
      ref={scrollerRef}
      onScroll={layout.scroll ? onScroll : undefined}
      aria-label={label}
      className={`absolute inset-0 bg-slate-950 text-left ${layout.padding} ${
        layout.scroll ? 'overflow-auto select-text' : 'overflow-hidden'
      }`}
    >
      <pre
        className="m-0 whitespace-pre-wrap font-mono text-slate-200"
        style={{
          width: `${doc.columns}ch`,
          fontSize: `${fontPx}px`,
          lineHeight: LINE_HEIGHT,
          wordBreak: 'break-all',
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </pre>
      {size === 'preview' && doc.stale && (
        <span className="sticky bottom-0 float-right rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
          {t('terminal.textStale', { time: new Date(doc.exportedAt).toLocaleTimeString() })}
        </span>
      )}
    </div>
  );
};

export default PcTerminalTextView;
