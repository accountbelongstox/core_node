import React from 'react';
import { Copy } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { copyTextToSystemClipboard } from '../../../../core/browser/SystemClipboard';
import { notify } from '../../../../shared/notify/notify';

/** A value that copies itself on tap (bank account, payment reference). */
export const MobileCopyValue: React.FC<{ value: string }> = ({ value }) => {
  const { t } = useTranslation('cm');
  const copy = async (): Promise<void> => {
    if (await copyTextToSystemClipboard(value)) notify.success(t('mobile.ui.copied'));
  };
  return (
    <button type="button" className="cmm-copy" onClick={() => void copy()} aria-label={t('mobile.ui.copy')}>
      <span>{value}</span>
      <Copy aria-hidden="true" />
    </button>
  );
};
