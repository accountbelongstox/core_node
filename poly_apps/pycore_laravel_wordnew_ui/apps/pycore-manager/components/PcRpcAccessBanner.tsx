import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import {
  classifyPycoreAccess,
  getHttpDebugEntries,
  getPycoreHealth,
  isPycoreRelayMode,
  PYCORE_HEALTH_EVENT,
  PycoreHttpError,
  subscribeHttpDebug,
  type PycoreAccess,
} from '@/apps/pycore-manager/api';

const REJECTION_STATUSES = new Set([401, 403]);
const RELAY_HINT_KEY = 'pycoreTarget.relayOnly';

/**
 * Explains why this page cannot use pycore: a K7 rejection of the last pycore
 * request, or (while pycore is not up) a page pycore never serves directly.
 */
export const PcRpcAccessBanner: React.FC = () => {
  const { t } = useTranslation('pc');
  const entries = useSyncExternalStore(subscribeHttpDebug, getHttpDebugEntries);
  const [pycoreUp, setPycoreUp] = useState(() => getPycoreHealth().up === true);

  useEffect(() => {
    const sync = () => setPycoreUp(getPycoreHealth().up === true);
    window.addEventListener(PYCORE_HEALTH_EVENT, sync);
    return () => window.removeEventListener(PYCORE_HEALTH_EVENT, sync);
  }, []);

  const rejection = useMemo((): PycoreAccess | null => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const record = entries[index];
      if (record.direction !== 'pycore') continue;
      if (!REJECTION_STATUSES.has(record.status)) return null;
      const code = String(record.error || '');
      const access = classifyPycoreAccess(new PycoreHttpError(record.status, code, code));
      return access?.kind === 'unreachable' ? null : access;
    }
    return null;
  }, [entries]);

  if (isPycoreRelayMode()) return null;
  const access = rejection ?? (pycoreUp ? null : classifyPycoreAccess());
  if (!access || access.kind === 'unreachable') return null;

  const origin = window.location.origin;
  const message = access.kind === 'host_forbidden'
    ? t('rpcAccess.hostForbidden')
    : access.kind === 'origin_forbidden'
      ? t('rpcAccess.originForbidden', { origin })
      : access.kind === 'origin_not_allowed'
        ? t('rpcAccess.originHint', { origin, ports: access.ports.join(' / ') })
        : t(RELAY_HINT_KEY);

  return (
    <div className="mx-3 mt-2 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  );
};

export default PcRpcAccessBanner;
