import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { CM_APPROVED_DECISION, CM_CLIENT_DECISIONS, CM_RATING_VALUES, type CmSubmissionDecision } from '../../../../shared/useCmTaskSubmissions';
import { MobileButton, MobileField, MobileNotice, MobileSheet } from '../../../ui';
import { MobileRatingPicker } from './MobileRatingPicker';

interface MobileDecisionSheetProps {
  open: boolean;
  submissionId: number | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: CmSubmissionDecision) => Promise<unknown>;
}

/** Client decision on a submission: approve, request revision or reject, with notes and an optional rating. */
export const MobileDecisionSheet: React.FC<MobileDecisionSheetProps> = ({ open, submissionId, busy, onClose, onSubmit }) => {
  const { t } = useTranslation('cm');
  const [decision, setDecision] = useState<string>(CM_CLIENT_DECISIONS[0]);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number | ''>('');

  useEffect(() => {
    if (open) {
      setDecision(CM_CLIENT_DECISIONS[0]);
      setNotes('');
      setRating('');
    }
  }, [open, submissionId]);

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title={t('submissions.decisionTitle')}
      footer={(
        <>
          <MobileButton disabled={busy} onClick={onClose}>{t('common.cancel')}</MobileButton>
          <MobileButton variant={decision === 'rejected' ? 'danger' : 'primary'} loading={busy} disabled={!notes.trim()} onClick={() => void onSubmit({ decision, notes, rating: rating === '' ? '' : String(rating) })}>
            {t('submissions.submitDecision')}
          </MobileButton>
        </>
      )}
    >
      <div className="cmm-radio-list" role="radiogroup" aria-label={t('submissions.decision')}>
        {CM_CLIENT_DECISIONS.map((value) => (
          <label key={value} className={decision === value ? 'is-active' : ''}>
            <input type="radio" name="cmm-decision" value={value} checked={decision === value} onChange={() => setDecision(value)} />
            {t(`submissions.decisions.${value}`)}
          </label>
        ))}
      </div>
      {decision === CM_APPROVED_DECISION && <MobileNotice>{t('submissions.approveHint')}</MobileNotice>}
      <MobileRatingPicker label={t('submissions.ratingLabel')} value={rating} values={CM_RATING_VALUES} onChange={setRating} emptyLabel={t('submissions.noRating')} />
      <MobileField label={t('submissions.notes')}>
        <textarea className="cmm-input cmm-textarea" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('submissions.notesPlaceholder')} />
      </MobileField>
    </MobileSheet>
  );
};
