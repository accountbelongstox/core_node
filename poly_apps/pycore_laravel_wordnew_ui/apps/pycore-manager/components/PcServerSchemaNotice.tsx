import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { SERVER_SCHEMA_PENDING_CODE, useServerSchemaGate } from '../../../core/integrations/laravel';
import { useAudioLaneState } from '../api/AudioLaneStateStore';

/** True when any lane of this node reports the server schema gate as the reason it is blocked. */
export function useNodeReportsSchemaPending(): boolean {
  const lanes = useAudioLaneState().payload?.lanes;
  return Object.values(lanes ?? {}).some(
    (lane) => lane?.assist?.state === 'blocked' && lane.assist.reason_code === SERVER_SCHEMA_PENDING_CODE,
  );
}

/** The server schema is behind its code (contract `schema_gate`): the one explanation shown instead of generic failures. */
export function PcServerSchemaNotice(): ReactElement | null {
  const { t } = useTranslation('pc');
  const gate = useServerSchemaGate();
  const nodeReports = useNodeReportsSchemaPending();
  if (gate.schema !== 'pending' && !nodeReports) return null;
  return (
    <section role="status" className="pc-glass p-3 text-xs text-amber-500 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="space-y-0.5">
        <b className="block">{t('queueCenter.schema.title')}</b>
        <span className="block">{t('queueCenter.schema.hint', { seconds: gate.retryAfterSeconds })}</span>
        {gate.schema !== 'pending' && <span className="block text-[10px] text-slate-500">{t('queueCenter.schema.nodeHint')}</span>}
      </span>
    </section>
  );
}
