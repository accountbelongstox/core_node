import React from 'react';

interface MobileRatingPickerProps {
  label: string;
  value: number | '';
  values: ReadonlyArray<number>;
  onChange: (value: number | '') => void;
  /** Label of the "no rating" choice; omitted = a rating is required. */
  emptyLabel?: string;
}

/** 1-5 style rating buttons; tapping the active value again clears an optional rating. */
export const MobileRatingPicker: React.FC<MobileRatingPickerProps> = ({ label, value, values, onChange, emptyLabel }) => (
  <div className="cmm-rating" role="radiogroup" aria-label={label}>
    <span className="cmm-rating__label">{label}{emptyLabel && value === '' ? ` · ${emptyLabel}` : ''}</span>
    <div className="cmm-rating__row">
      {values.map((score) => (
        <button
          key={score}
          type="button"
          role="radio"
          aria-checked={value === score}
          className={value === score ? 'is-active' : ''}
          onClick={() => onChange(value === score && emptyLabel ? '' : score)}
        >
          {score}
        </button>
      ))}
    </div>
  </div>
);
