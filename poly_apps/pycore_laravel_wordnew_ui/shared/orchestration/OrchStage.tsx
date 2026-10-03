import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OrchVideoSettings } from '../../core/integrations/pycore';
import {
  stageCardIndexAt,
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
const WINDOW_BEFORE = 12;
const WINDOW_AFTER = 24;
const WINDOW_MARGIN = 6;
const HEIGHT_TOLERANCE = 0.5;
const LINE_HEIGHT = { sentence: 1.36, word: 1.2, meaning: 1.36 } as const;

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

interface StageStore {
  heights: Float64Array;
  tops: Float64Array;
  keyframes: OrchKeyframe[];
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

function estimateHeight(card: OrchStageCard, settings: OrchVideoSettings): number {
  const { sentence, word, layout } = settings;
  const lines = card.lines.reduce((sum, line, index) => {
    const size = line.role === 'sentence_en' ? sentence.size_en * LINE_HEIGHT.sentence
      : line.role === 'sentence_zh' ? sentence.size_zh * LINE_HEIGHT.sentence
        : line.role === 'word' ? word.size_en * LINE_HEIGHT.word + word.box_padding * 1.2
          : word.size_zh * LINE_HEIGHT.meaning;
    return sum + size + (index > 0 ? layout.line_gap : 0);
  }, 0);
  return lines + layout.card_gap;
}

/** Card tops and viewport keyframes from the measured heights; a card never rendered uses the estimate scaled by what was measured of its kind. */
function layoutStore(store: StageStore, cards: OrchStageCard[], settings: OrchVideoSettings): void {
  const { heights, tops } = store;
  const measured = { word: [0, 0], sentence: [0, 0] };
  cards.forEach((card, index) => {
    if (Number.isNaN(heights[index])) return;
    measured[card.kind][0] += heights[index];
    measured[card.kind][1] += estimateHeight(card, settings);
  });
  const scale = {
    word: measured.word[1] > 0 ? measured.word[0] / measured.word[1] : 1,
    sentence: measured.sentence[1] > 0 ? measured.sentence[0] / measured.sentence[1] : 1,
  };
  const centers: number[] = new Array(cards.length);
  tops[0] = 0;
  cards.forEach((card, index) => {
    const height = Number.isNaN(heights[index]) ? estimateHeight(card, settings) * scale[card.kind] : heights[index];
    centers[index] = tops[index] + (height - settings.layout.card_gap) / 2;
    tops[index + 1] = tops[index] + height;
  });
  store.keyframes = stageKeyframes(cards, centers, settings.layout);
}

function createStore(cards: OrchStageCard[], settings: OrchVideoSettings): StageStore {
  const store: StageStore = {
    heights: new Float64Array(cards.length).fill(Number.NaN),
    tops: new Float64Array(cards.length + 1),
    keyframes: [[0, 0]],
  };
  layoutStore(store, cards, settings);
  return store;
}

function windowAround(cards: OrchStageCard[], at: number): [number, number] {
  const active = stageCardIndexAt(cards, at);
  return [Math.max(0, active - WINDOW_BEFORE), Math.min(cards.length, active + WINDOW_AFTER)];
}

/**
 * The composition "video": bilingual cards stacked in one column, scrolled so
 * the card being spoken sits on the focus line (played cards scroll away above,
 * upcoming ones wait below), line colours per playback state, progress bar -
 * drawn every animation frame from the sequencer clock, no rendering step.
 * Only the cards around the playback position are in the DOM (a book has tens
 * of thousands); the rest is a spacer of their measured or estimated height.
 */
export const OrchStage: React.FC<Props> = ({ cards, settings, timeRef, duration, label, newWords, newLabel }) => {
  const scope = `orch-stage-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lineRefs = useRef<Map<number, Array<HTMLDivElement | null>>>(new Map());
  const dirtyRef = useRef(true);
  const [scale, setScale] = useState(1);
  const [, setLayoutVersion] = useState(0);
  const [range, setRange] = useState<[number, number]>(() => windowAround(cards, timeRef.current));
  const rangeRef = useRef(range);
  const store = useMemo(() => createStore(cards, settings), [cards, settings]);
  const css = useMemo(() => stageCss(scope, settings), [scope, settings]);
  const focus = DESIGN_HEIGHT * Math.min(0.9, Math.max(0.1, settings.layout.focus_y));
  const columnWidth = DESIGN_WIDTH * Math.min(0.96, Math.max(0.3, settings.layout.column_width));
  const from = Math.min(range[0], cards.length);
  const to = Math.min(range[1], cards.length);
  rangeRef.current = [from, to];

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / DESIGN_WIDTH));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setRange(windowAround(cards, timeRef.current));
    dirtyRef.current = true;
  }, [cards, timeRef]);

  useLayoutEffect(() => {
    let cancelled = false;
    const measureCards = (): void => {
      if (cancelled) return;
      let changed = false;
      cardRefs.current.forEach((element, index) => {
        if (index >= cards.length) return;
        const height = element.offsetHeight;
        if (!(Math.abs(height - store.heights[index]) < HEIGHT_TOLERANCE)) {
          store.heights[index] = height;
          changed = true;
        }
      });
      if (changed) {
        layoutStore(store, cards, settings);
        setLayoutVersion((version) => version + 1);
      }
      dirtyRef.current = true;
    };
    measureCards();
    void document.fonts?.ready.then(measureCards);
    return () => { cancelled = true; };
  }, [cards, settings, store, from, to]);

  useEffect(() => {
    let frame = 0;
    let drawnAt = Number.NaN;
    const draw = (): void => {
      frame = requestAnimationFrame(draw);
      const at = timeRef.current;
      const [windowFrom, windowTo] = rangeRef.current;
      const active = stageCardIndexAt(cards, at);
      if ((active < windowFrom + WINDOW_MARGIN && windowFrom > 0) || (active >= windowTo - WINDOW_MARGIN && windowTo < cards.length)) {
        setRange(windowAround(cards, at));
        return;
      }
      if (at === drawnAt && !dirtyRef.current) return;
      drawnAt = at;
      dirtyRef.current = false;
      if (columnRef.current) {
        columnRef.current.style.transform = `translate(-50%, ${focus - stageOffsetAt(store.keyframes, at)}px)`;
      }
      if (progressRef.current) {
        progressRef.current.style.width = `${duration > 0 ? Math.min(100, (at / duration) * 100) : 0}%`;
      }
      for (let cardIndex = windowFrom; cardIndex < windowTo; cardIndex += 1) {
        const card = cards[cardIndex];
        const elements = lineRefs.current.get(cardIndex);
        if (!card || !elements) continue;
        card.lines.forEach((line, lineIndex) => {
          const element = elements[lineIndex];
          const state = stageLineState(card, line, at);
          if (element && element.dataset.state !== state) element.dataset.state = state;
        });
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [cards, store, focus, duration, timeRef]);

  const rendered: React.ReactNode[] = [];
  for (let cardIndex = from; cardIndex < to; cardIndex += 1) {
    const card = cards[cardIndex];
    rendered.push(
      <div
        key={card.key}
        ref={(element) => {
          if (element) {
            cardRefs.current.set(cardIndex, element);
          } else {
            cardRefs.current.delete(cardIndex);
            lineRefs.current.delete(cardIndex);
          }
        }}
        style={{ paddingBottom: settings.layout.card_gap }}
      >
        {card.lines.map((line, lineIndex) => (
          <div key={`${line.role}:${lineIndex}`} style={{ marginTop: lineIndex > 0 ? settings.layout.line_gap : 0 }}>
            <div
              ref={(element) => {
                let elements = lineRefs.current.get(cardIndex);
                if (!elements) {
                  elements = [];
                  lineRefs.current.set(cardIndex, elements);
                }
                elements[lineIndex] = element;
              }}
              data-role={line.role}
              data-state={stageLineState(card, line, timeRef.current)}
              className="break-words"
            >
              {line.text}
            </div>
            {line.role === 'word' && newLabel && newWords?.has(line.text.toLowerCase()) && (
              <span className="orch-stage-new" style={{ backgroundColor: settings.progress_color }}>{newLabel}</span>
            )}
          </div>
        ))}
      </div>,
    );
  }

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
          <div style={{ height: store.tops[from] }} />
          {rendered}
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
