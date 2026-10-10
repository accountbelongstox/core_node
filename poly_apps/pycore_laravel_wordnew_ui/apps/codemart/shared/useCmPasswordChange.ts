import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmAuthApi } from '../auth/CmAuthApi';
import { useCmPasswordMinLength } from '../contexts/useCmPolicy';
import type { CmFeedback } from './cmFeedback';

const HTTP_VALIDATION_STATUS = 422;

export interface CmPasswordChangeModel {
  current: string;
  next: string;
  confirm: string;
  setCurrent: (value: string) => void;
  setNext: (value: string) => void;
  setConfirm: (value: string) => void;
  passwordMin: number;
  tooShort: boolean;
  mismatch: boolean;
  invalid: boolean;
  busy: boolean;
  submit: () => Promise<boolean>;
}

/** Signed-in password change form state, validation and submit (`POST /user/change-password`). */
export function useCmPasswordChange(feedback: CmFeedback): CmPasswordChangeModel {
  const { t } = useTranslation('cm');
  const passwordMin = useCmPasswordMinLength();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const tooShort = next !== '' && next.length < passwordMin;
  const mismatch = confirm !== '' && confirm !== next;
  const invalid = !current || next.length < passwordMin || confirm !== next;

  const submit = useCallback(async (): Promise<boolean> => {
    if (busy || invalid) return false;
    setBusy(true);
    feedback.clear();
    const response = await cmAuthApi.changePassword(current, next, confirm);
    setBusy(false);
    if (response.success) {
      setCurrent('');
      setNext('');
      setConfirm('');
      feedback.success(t('settings.password.changed'));
      return true;
    }
    feedback.error(t(response.status === HTTP_VALIDATION_STATUS ? 'settings.password.currentIncorrect' : 'settings.password.failed'));
    return false;
  }, [busy, invalid, feedback, current, next, confirm, t]);

  return { current, next, confirm, setCurrent, setNext, setConfirm, passwordMin, tooShort, mismatch, invalid, busy, submit };
}
