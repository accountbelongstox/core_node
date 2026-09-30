/**
 * PcTestChip — the ONE "Test" button: opens the schema-driven test popup for a hub entry.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import type { AiHubEntry } from '@/apps/pycore-manager/api';
import { usePcTestPopup } from '../../PcTestPopupContext';

export const PcTestChip: React.FC<{
  entry: AiHubEntry;
  disabled?: boolean;
  label?: string;
  Icon?: React.FC<{ className?: string }>;
}> = ({ entry, disabled, label, Icon = Play }) => {
  const { t } = useTranslation('pc');
  const { openTest } = usePcTestPopup();
  const unavailable = !entry.capabilities.test || entry.boot.state === 'blocked';
  return (
    <button
      type="button"
      disabled={disabled || unavailable}
      onClick={(event) => { event.stopPropagation(); openTest(entry); }}
      title={unavailable ? t('aiHub.test.unavailable') : t('aiHub.test.open')}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed pc-glass hover:bg-indigo-500/10 text-indigo-500">
      <Icon className="w-3 h-3" /> {label ?? t('common.test')}
    </button>
  );
};
