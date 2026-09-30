/**
 * PcEngineLoadBadge — live model-load indicator of one engine: a spinner with the
 * elapsed seconds while loading, an error pill (message as tooltip) on failure,
 * nothing when idle / loaded (the runtime pill already says loaded).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { usePcEngineLoadStatus } from '@/apps/pycore-manager/api';
import { PcStatusPill } from './PcStatusPill';

const MS_PER_SECOND = 1000;

export const PcEngineLoadBadge: React.FC<{ engine: string }> = ({ engine }) => {
  const { t } = useTranslation('pc');
  const { getEngine } = usePcEngineLoadStatus(false);
  const entry = getEngine(engine);
  if (!entry) return null;
  if (entry.state === 'loading') {
    const seconds = Math.max(0, Math.round(entry.elapsed_ms / MS_PER_SECOND));
    return (
      <PcStatusPill
        tone="warn"
        busy
        label={`${t('engineLoad.loading')} ${seconds}s`}
        title={entry.message || undefined}
      />
    );
  }
  if (entry.state === 'error') {
    return <PcStatusPill tone="bad" Icon={AlertTriangle} label={t('engineLoad.error')} title={entry.message || undefined} />;
  }
  return null;
};
