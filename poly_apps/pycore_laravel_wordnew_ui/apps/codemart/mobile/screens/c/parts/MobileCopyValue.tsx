import React from 'react';
import { Copy } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { copyTextToSystemClipboard } from '../../../../../../core/browser/SystemClipboard';
import { notify } from '../../../../../../shared/notify/notify';

/** A value that copies itself on tap (bank account, payment reference). */
export const MobileCopyValue: React.FC<{ value: string }> = ({ value }) => {
  const { t } = useTranslation('cm');
  const copy = async (): Promise<void> => {
    if (await copyTextToSystemClipboard(value)) notify.success(t('mobile.c.copied'));
  };
  return (
    <button type="button" className="cmmc-copy" onClick={() => void copy()} aria-label={t('mobile.c.copy')}>
      <span>{value}</span>
      <Copy aria-hidden="true" />
    </button>
  );
};
