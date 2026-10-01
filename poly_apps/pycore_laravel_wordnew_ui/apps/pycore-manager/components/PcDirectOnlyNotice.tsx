import React from 'react';
import { Link2Off } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Panel shown in place of a feature that only works on a direct pycore connection. */
export function PcDirectOnlyNotice({ reasonKey }: { reasonKey: string }) {
  const { t } = useTranslation('pc');
  return (
    <div className="pc-glass flex items-start gap-3 rounded-xl p-4 text-sm text-slate-300" role="status">
      <Link2Off className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div>
        <div className="font-medium text-slate-100">{t('common.directOnly')}</div>
        <div className="mt-1 text-slate-400">{t(reasonKey)}</div>
      </div>
    </div>
  );
}
