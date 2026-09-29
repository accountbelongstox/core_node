/**
 * VortexPycoreNotice — the OKX panels' pycore banner. Names a pycore access
 * rejection (K7 host/origin, client key) or a page pycore never serves directly
 * (shown before any request while pycore is not connected), and keeps the
 * panel's own "unreachable" text for real network failures.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { classifyPycoreAccess, onHttpStatus, type PycoreAccess } from '@/apps/vortex/api';

interface Props {
  failure: PycoreAccess | null;
  unreachableText: string;
}

export const VortexPycoreNotice: React.FC<Props> = ({ failure, unreachableText }) => {
  const { t } = useTranslation('vx');
  const [connected, setConnected] = useState(false);
  useEffect(() => onHttpStatus(setConnected), []);

  const access = failure ?? (connected ? null : classifyPycoreAccess());
  if (!access) return null;
  const text = access.kind === 'unreachable'
    ? unreachableText
    : t(`access.${access.kind}`, {
        origin: window.location.origin,
        code: 'code' in access ? access.code : '',
        ports: access.kind === 'origin_not_allowed' ? access.ports.join(' / ') : '',
      });

  return (
    <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-400">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{text}</span>
    </div>
  );
};

export default VortexPycoreNotice;
