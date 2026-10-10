import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { MobileField } from '../../../ui';

interface MobileCommentFieldProps {
  label: string;
  value: string;
  /** Minimum trimmed length from the server policy. */
  min: number;
  placeholder: string;
  onChange: (value: string) => void;
}

/** Comment textarea with the live length counter against the policy minimum. */
export const MobileCommentField: React.FC<MobileCommentFieldProps> = ({ label, value, min, placeholder, onChange }) => {
  const { t } = useTranslation('cm');
  const length = value.trim().length;
  const short = length > 0 && length < min;
  return (
    <MobileField label={label}>
      <textarea className="cmm-input cmm-textarea" rows={4} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={short} />
      <small className={`cmm-note-counter ${short ? 'is-bad' : ''}`}>{t('reviews.commentCounter', { count: length, min })}</small>
    </MobileField>
  );
};
