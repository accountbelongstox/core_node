/**
 * Domain switch of the shell dock: picks the Laravel domain every app of this UI talks to. The target is
 * probed first (apiManager.switchEndpoint), so a dead domain is reported and the current one stays.
 */
import React, { useEffect, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { useTranslation } from '../core/i18n/UiI18n';
import { API_HEALTH_EVENT, apiManager } from '../core/integrations/laravel/ApiManager';

export const ShellDomainSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const [currentId, setCurrentId] = useState(() => apiManager.getCurrentEndpoint()?.id ?? '');
  const [switching, setSwitching] = useState(false);
  const [failed, setFailed] = useState(false);
  const endpoints = apiManager.getAllEndpoints();

  useEffect(() => {
    const sync = (): void => setCurrentId(apiManager.getCurrentEndpoint()?.id ?? '');
    window.addEventListener(API_HEALTH_EVENT, sync);
    return () => window.removeEventListener(API_HEALTH_EVENT, sync);
  }, []);

  if (endpoints.length < 2) return null;

  const select = async (id: string): Promise<void> => {
    setSwitching(true);
    setFailed(false);
    const switched = await apiManager.switchEndpoint(id).catch(() => null);
    setSwitching(false);
    setFailed(!switched?.ok);
    setCurrentId(apiManager.getCurrentEndpoint()?.id ?? '');
  };

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 px-2 text-slate-700 dark:text-slate-200" title={t('common.shell_domain')}>
        {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        <select
          value={currentId}
          disabled={switching}
          onChange={(event) => void select(event.target.value)}
          aria-label={t('common.shell_domain')}
          className="min-w-0 flex-1 bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1"
        >
          {endpoints.map((endpoint) => (
            <option key={endpoint.id} value={endpoint.id}>{endpoint.description || endpoint.url}</option>
          ))}
        </select>
      </label>
      {failed && <p className="px-2 text-[11px] text-rose-500">{t('common.shell_domain_failed')}</p>}
    </div>
  );
};

export default ShellDomainSwitcher;
