/**
 * PcHistoryView — the "History" tab: one feed over the hub test records and the
 * image / search / translate / speech stores (usePcHistory + PcHistoryList), above
 * the shared cross-runtime AI usage viewer.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import AiUsagePanel from '@/shared/ai-usage/AiUsagePanel';
import { pycoreApi } from '@/apps/pycore-manager/api';
import { usePcHistory } from '../../hooks/usePcHistory';
import { usePcRefreshSignal } from '../../hooks/usePcRefreshSignal';
import { PC_HISTORY_KINDS } from '../../utils/pcHistorySources';
import PcHistoryList from './PcHistoryList';

const PcHistoryView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');
  const history = usePcHistory({ kinds: PC_HISTORY_KINDS });
  usePcRefreshSignal(refreshSignal, history.refresh);
  return (
    <div className="space-y-4">
      <AiUsagePanel
        title={t('aiHub.history.usageTitle')}
        fetchUsage={async (limit) => {
          const answer = await pycoreApi.getAiUsage({ limit });
          return answer.data ? { ...answer, data: { ...answer.data, entries: answer.data.items } } : answer;
        }}
      />
      <section className="pc-glass p-5">
        <PcHistoryList
          history={history}
          title={<><History className="w-4 h-4 text-indigo-500" /> {t('aiHub.history.title')}</>}
        />
      </section>
    </div>
  );
};

export default PcHistoryView;
