import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OrchVideoSettings } from '../../core/integrations/pycore';
import {
  stageKeyframes,
  stageLineState,
  stageOffsetAt,
  type OrchKeyframe,
  type OrchLineState,
  type OrchStageCard,
} from './orchStageLayout';

/** The stage is laid out in the pycore video canvas (720p) and scaled to fit. */
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const PROGRESS_HEIGHT = 6;
const CHIP_RADIUS = 14;
const STATES: OrchLineState[] = ['upcoming', 'active', 'companion', 'past'];

interface Props {
  cards: OrchStageCard[];
  settings: OrchVideoSettings;
  timeRef: React.MutableRefObject<number>;
  duration: number;
  label: string;
  /** Words shown as new (lower case); their word cards carry `newLabel`. */
  newWords?: ReadonlySet<string>;
  newLabel?: string;
}

function rgba(hex: string, alpha: number): string {
  const value = /^#?([0-9a-f]{6})/i.exec(hex)?.[1] ?? '000000';
  const channel = (offset: number): number => parseInt(value.slice(offset, offset + 2), 16);
  return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${alpha})`;
}

function outlineShadow(color: string, width: number): string {
  if (width <= 0) return 'none';
  const steps = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  return [...steps.map(([x, y]) => `${x * width}px ${y * width}px 0 ${color}`), '0 2px 6px rgba(0,0,0,0.18)'].join(', ');
}

/** Scoped CSS of every role x state, mirroring pycore `orch_video.role_styles`. */
function stageCss(scope: string, settings: OrchVideoSettings): string {
  const { sentence, word } = settings;
  const up = settings.opacity_upcoming;
  const past = settings.opacity_past;
  const alphaOf = (state: OrchLineState): number => (state === 'upcoming' ? up : state === 'past' ? past : 1);
  const rules: string[] = [
    `.${scope} [data-role] { transition: color 160ms ease, background-color 160ms ease, text-shadow 160ms ease; }`,
    `.${scope} [data-role^="sentence"] { font-weight: ${sentence.bold ? 700 : 400}; line-height: 1.36; }`,
    `.${scope} [data-role="sentence_en"] { font-family: "${sentence.font_en}", Georgia, serif; font-size: ${sentence.size_en}px; }`,
    `.${scope} [data-role="sentence_zh"] { font-family: "${sentence.font_zh}", "Noto Serif SC", serif; font-size: ${sentence.size_zh}px; }`,
    `.${scope} [data-role="word"] { display: inline-block; font-family: "${word.font_en}", system-ui, sans-serif; font-size: ${word.size_en}px; font-weight: ${word.bold ? 700 : 500}; line-height: 1.2; padding: ${word.box_padding * 0.6}px ${word.box_padding * 1.4}px; border-radius: ${CHIP_RADIUS}px; }`,
    `.${scope} .orch-stage-new { display: inline-block; margin-left: 10px; padding: 2px 10px; border-radius: 999px; color: #FFFFFF; font: 700 18px/1.4 system-ui, sans-serif; letter-spacing: 0.08em; vertical-align: super; }`,
    `.${scope} [data-role="word_meaning"] { font-family: "${word.font_zh}", system-ui, sans-serif; font-size: ${word.size_zh}px; line-height: 1.36; }`,
  ];
  for (const state of STATES) {
    const alpha = alphaOf(state);
    const lit = state === 'active' || state === 'companion';
    const sentenceColor = state === 'active' ? sentence.active : rgba(sentence.text, alpha);
    const outline = rgba(sentence.outline_color, alpha);
    rules.push(
      `.${scope} [data-role^="sentence"][data-state="${state}"] { color: ${sentenceColor}; text-shadow: ${outlineShadow(outline, sentence.outline)}; }`,
      `.${scope} [data-role="word"][data-state="${state}"] { color: ${lit ? word.active : rgba(word.text, alpha)}; background-color: ${lit ? word.box_active : rgba(word.box, alpha)}; }`,
      `.${scope} [data-role="word_meaning"][data-state="${state}"] { color: ${lit ? word.meaning_active : rgba(word.meaning, alpha)}; text-shadow: ${outlineShadow(outline, 1)}; }`,
    );
  }
  return rules.join('\n');
}

/**
 * The composition "video": bilingual cards stacked in one column, scrolled so
 * the card being spoken sits on the focus line (played cards scroll away above,
 * upcoming ones wait below), line colours per playback state, progress bar -
 * drawn every animation frame from the sequencer clock, no rendering step.
 */
export const OrchStage: React.FC<Props> = ({ cards, settings, timeRef, duration, label, newWords, newLabel }) => {
  const scope = `orch-stage-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lineRefs = useRef<Array<Array<HTMLDivElement | null>>>([]);
  const [scale, setScale] = useState(1);
  const [keyframes, setKeyframes] = useState<OrchKeyframe[]>([[0, 0]]);
  const css = useMemo(() => stageCss(scope, settings), [scope, settings]);
  const focus = DESIGN_HEIGHT * Math.min(0.9, Math.max(0.1, settings.layout.focus_y));
  const columnWidth = DESIGN_WIDTH * Math.min(0.96, Math.max(0.3, settings.layout.column_width));

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / DESIGN_WIDTH));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    const measureCards = (): void => {
      if (cancelled) return;
      const centers = cards.map((_, index) => {
        const element = cardRefs.current[index];
        return element ? element.offsetTop + (element.offsetHeight - settings.layout.card_gap) / 2 : 0;
      });
      setKeyframes(stageKeyframes(cards, centers, settings.layout));
    };
    measureCards();
    void document.fonts?.ready.then(measureCards);
    return () => { cancelled = true; };
  }, [cards, settings]);

  useEffect(() => {
    let frame = 0;
    const draw = (): void => {
      const at = timeRef.current;
      if (columnRef.current) {
        columnRef.current.style.transform = `translate(-50%, ${focus - stageOffsetAt(keyframes, at)}px)`;
      }
      if (progressRef.current) {
        progressRef.current.style.width = `${duration > 0 ? Math.min(100, (at / duration) * 100) : 0}%`;
      }
      cards.forEach((card, cardIndex) => card.lines.forEach((line, lineIndex) => {
        const element = lineRefs.current[cardIndex]?.[lineIndex];
        const state = stageLineState(card, line, at);
        if (element && element.dataset.state !== state) element.dataset.state = state;
      }));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [cards, keyframes, focus, duration, timeRef]);

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={label}
      className={`${scope} relative w-full overflow-hidden rounded-2xl shadow-lg`}
      style={{ aspectRatio: `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}`, backgroundColor: settings.background.color }}
    >
      <style>{css}</style>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
      >
        <div ref={columnRef} className="absolute left-1/2 top-0 text-center" style={{ width: columnWidth }}>
          {cards.map((card, cardIndex) => (
            <div
              key={card.key}
              ref={(element) => { cardRefs.current[cardIndex] = element; }}
              style={{ paddingBottom: settings.layout.card_gap }}
            >
              {card.lines.map((line, lineIndex) => (
                <div key={`${line.role}:${lineIndex}`} style={{ marginTop: lineIndex > 0 ? settings.layout.line_gap : 0 }}>
                  <div
                    ref={(element) => {
                      lineRefs.current[cardIndex] ??= [];
                      lineRefs.current[cardIndex][lineIndex] = element;
                    }}
                    data-role={line.role}
                    data-state="upcoming"
                    className="break-words"
                  >
                    {line.text}
                  </div>
                  {line.role === 'word' && newLabel && newWords?.has(line.text.toLowerCase()) && (
                    <span className="orch-stage-new" style={{ backgroundColor: settings.progress_color }}>{newLabel}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        {settings.show_progress_bar && (
          <div className="absolute bottom-0 left-0 w-full" style={{ height: PROGRESS_HEIGHT, backgroundColor: rgba(settings.progress_color, 0.18) }}>
            <div ref={progressRef} className="h-full" style={{ width: 0, backgroundColor: settings.progress_color }} />
          </div>
        )}
      </div>
    </div>
  );
};
