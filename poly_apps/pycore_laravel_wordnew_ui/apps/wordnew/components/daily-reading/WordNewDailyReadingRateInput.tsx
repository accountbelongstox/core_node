import React, { useId } from 'react';

const RATE_PRESETS = [0.5, 0.7, 0.9, 1.0, 1.2, 1.5, 1.8];

interface Props {
  value: number;
  onChange: (rate: number) => void;
  ariaLabel: string;
}

/** Playback-rate input: preset suggestions via datalist plus free decimal input. */
export const WordNewDailyReadingRateInput: React.FC<Props> = ({ value, onChange, ariaLabel }) => {
  const listId = useId();
  return (
    <>
      <input
        type="number"
        inputMode="decimal"
        min={0.25}
        max={4}
        step={0.1}
        value={value}
        list={listId}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (isFinite(next)) onChange(next);
        }}
        aria-label={ariaLabel}
        className="w-16 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
      />
      <datalist id={listId}>
        {RATE_PRESETS.map((rate) => (
          <option key={rate} value={rate} />
        ))}
      </datalist>
    </>
  );
};
