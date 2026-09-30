/**
 * PcModelHistoryDrawer — the test history of ONE hub model in a floating panel.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { aiHubEntryKey } from '@/apps/pycore-manager/api';
import type { AiHubEntry } from '@/apps/pycore-manager/api';
import { usePcHistory } from '../../../hooks/usePcHistory';
import PcFloatingPanel from '../../PcFloatingPanel';
import PcHistoryList from '../PcHistoryList';

const HistoryBody: React.FC<{ entry: AiHubEntry }> = ({ entry }) => {
  const history = usePcHistory({ modelKey: aiHubEntryKey(entry) });
  return <PcHistoryList history={history} showFilters={false} maxHeightClass="max-h-[60vh]" />;
};

export const PcModelHistoryDrawer: React.FC<{ entry: AiHubEntry | null; onClose: () => void }> = ({ entry, onClose }) => {
  const { t } = useTranslation('pc');
  return (
    <PcFloatingPanel
      open={!!entry}
      onClose={onClose}
      closeLabel={t('common.close')}
      title={entry ? t('aiHub.history.modelTitle', { id: entry.id }) : ''}
      subtitle={entry ? t(`aiHub.categories.${entry.category}`, { defaultValue: entry.category }) : undefined}>
      {entry && <HistoryBody entry={entry} />}
    </PcFloatingPanel>
  );
};
