import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { MobileButton } from './MobileButton';
import { MobileField } from './MobileField';
import { MobileSheet } from './MobileSheet';

interface MobileConfirmSheetProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  /** Ask for an optional note, passed to `onConfirm`. */
  withReason?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<unknown>;
}

/** Confirmation in a bottom sheet, optionally collecting a reason; the confirm button shows the busy state. */
export const MobileConfirmSheet: React.FC<MobileConfirmSheetProps> = ({ open, title, message, confirmLabel, busy = false, danger = false, withReason = false, onClose, onConfirm }) => {
  const { t } = useTranslation('cm');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <MobileSheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      footer={(
        <>
          <MobileButton disabled={busy} onClick={onClose}>{t('common.cancel')}</MobileButton>
          <MobileButton variant={danger ? 'danger' : 'primary'} loading={busy} onClick={() => void onConfirm(reason.trim())}>{confirmLabel ?? t('common.confirm')}</MobileButton>
        </>
      )}
    >
      <p className="cmm-prose">{message}</p>
      {withReason && (
        <MobileField label={t('transitions.reasonLabel')} hint={t('common.optional')}>
          <textarea className="cmm-input cmm-textarea" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('transitions.reasonPlaceholder')} />
        </MobileField>
      )}
    </MobileSheet>
  );
};
