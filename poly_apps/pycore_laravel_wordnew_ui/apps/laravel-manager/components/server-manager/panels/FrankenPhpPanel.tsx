import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  FileCode,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCw,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';
import {
  AsyncState,
  FrankenPhpSite,
  FrankenPhpSiteRequest,
  FrankenPhpStatusOverview,
  Language,
} from '@/apps/laravel-manager/uiTypes';
import { commonClasses } from '@/shared/styles/theme';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_BACKDROP, OVERLAY_CONTAINER, OVERLAY_Z } from '@/shared/styles/overlay';
import { ConfirmModal, useToast } from '../../admin';
import { AlertBox, LoadingBlock, StatusBadge } from '../../common';
import { NEXUS_DASH_FRONTEND_URL } from '@/core/contracts/ServiceContract';

interface FrankenPhpPanelProps {
  lang: Language;
}

type ServiceAction = 'start' | 'stop' | 'restart' | 'reload';

interface SiteFormState {
  site_name: string;
  hosts: string;
  upstream: string;
  certificate_domain: string;
  enabled: boolean;
  site_config: string;
}

const emptyForm: SiteFormState = {
  site_name: '',
  hosts: '',
  upstream: NEXUS_DASH_FRONTEND_URL,
  certificate_domain: '',
  enabled: true,
  site_config: '',
};

const FrankenPhpPanel: React.FC<FrankenPhpPanelProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang].server.frankenphp;
  const toast = useToast();
  const [status, setStatus] = useState<AsyncState<FrankenPhpStatusOverview>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle',
  });
  const [sites, setSites] = useState<AsyncState<FrankenPhpSite[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle',
  });
  const [form, setForm] = useState<SiteFormState>(emptyForm);
  const [editingSite, setEditingSite] = useState<FrankenPhpSite | null>(null);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deleteSite, setDeleteSite] = useState<FrankenPhpSite | null>(null);

  const loadStatus = useCallback(async () => {
    setStatus(previous => ({ ...previous, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getFrankenPhpStatus();
      if (!response.success || !response.data) {
        throw new Error(response.error || t.load_failed);
      }
      setStatus({
        data: response.data as FrankenPhpStatusOverview,
        loading: false,
        error: null,
        status: 'success',
      });
    } catch (error: any) {
      setStatus({ data: null, loading: false, error: error.message, status: 'error' });
    }
  }, [t.load_failed]);

  const loadSites = useCallback(async () => {
    setSites(previous => ({ ...previous, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.listFrankenPhpSites();
      if (!response.success || !response.data) {
        throw new Error(response.error || t.load_failed);
      }
      const payload = response.data as { sites?: FrankenPhpSite[] };
      setSites({
        data: Array.isArray(payload.sites) ? payload.sites : [],
        loading: false,
        error: null,
        status: 'success',
      });
    } catch (error: any) {
      setSites({ data: [], loading: false, error: error.message, status: 'error' });
    }
  }, [t.load_failed]);

  const refresh = useCallback(async () => {
    await Promise.all([loadStatus(), loadSites()]);
  }, [loadSites, loadStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runServiceAction = async (action: ServiceAction) => {
    setBusyAction(action);
    try {
      const response = action === 'reload'
        ? await api.serverManagerV1.reloadFrankenPhp()
        : await api.serverManagerV1.frankenPhpService(action);
      if (!response.success) {
        throw new Error(response.error || t.operation_failed);
      }
      if (action !== 'stop') {
        await api.serverManagerV1.waitForFrankenPhpReload(response);
      }
      toast.success(t.operation_succeeded.replace('{action}', t[action]));
      if (action !== 'stop') {
        await refresh();
      }
    } catch (error: any) {
      toast.error(`${t.operation_failed}: ${error.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const testConfiguration = async () => {
    setBusyAction('test');
    try {
      const response = await api.serverManagerV1.testFrankenPhpConfig();
      const valid = Boolean(response.data?.valid);
      if (!response.success || !valid) {
        throw new Error(response.data?.output || response.error || t.invalid_config);
      }
      toast.success(t.valid_config);
    } catch (error: any) {
      toast.error(`${t.invalid_config}: ${error.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const openCreate = () => {
    setEditingSite(null);
    setForm(emptyForm);
    setShowSiteModal(true);
  };

  const openEdit = (site: FrankenPhpSite) => {
    setEditingSite(site);
    setForm({
      site_name: site.site_name,
      hosts: site.hosts.join(', '),
      upstream: site.upstream || '',
      certificate_domain: site.certificate_domain || '',
      enabled: site.enabled,
      site_config: site.content,
    });
    setShowSiteModal(true);
  };

  const saveSite = async (event: React.FormEvent) => {
    const hosts = form.hosts.split(/[\s,]+/).map(host => host.trim()).filter(Boolean);
    let response;

    event.preventDefault();
    setSaving(true);
    try {
      if (editingSite) {
        response = await api.serverManagerV1.updateFrankenPhpSite(editingSite.site_name, {
          site_config: form.site_config,
          enabled: form.enabled,
        });
      } else {
        const request: FrankenPhpSiteRequest = {
          site_name: form.site_name,
          hosts,
          upstream: form.upstream,
          certificate_domain: form.certificate_domain,
          enabled: form.enabled,
        };
        response = await api.serverManagerV1.createFrankenPhpSite(request);
      }
      if (!response.success) {
        throw new Error(response.error || t.operation_failed);
      }
      await api.serverManagerV1.waitForFrankenPhpReload(response);
      toast.success(editingSite ? t.site_updated : t.site_created);
      setShowSiteModal(false);
      setEditingSite(null);
      await refresh();
    } catch (error: any) {
      toast.error(`${t.operation_failed}: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const setSiteEnabled = async (site: FrankenPhpSite, enabled: boolean) => {
    setBusyAction(`${enabled ? 'enable' : 'disable'}:${site.site_name}`);
    try {
      const response = enabled
        ? await api.serverManagerV1.enableFrankenPhpSite(site.site_name)
        : await api.serverManagerV1.disableFrankenPhpSite(site.site_name);
      if (!response.success) {
        throw new Error(response.error || t.operation_failed);
      }
      await api.serverManagerV1.waitForFrankenPhpReload(response);
      toast.success(enabled ? t.site_enabled : t.site_disabled);
      await refresh();
    } catch (error: any) {
      toast.error(`${t.operation_failed}: ${error.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const confirmDelete = async () => {
    const site = deleteSite;

    if (!site) return;
    setBusyAction(`delete:${site.site_name}`);
    try {
      const response = await api.serverManagerV1.deleteFrankenPhpSite(site.site_name);
      if (!response.success) {
        throw new Error(response.error || t.operation_failed);
      }
      await api.serverManagerV1.waitForFrankenPhpReload(response);
      toast.success(t.site_deleted);
      setDeleteSite(null);
      await refresh();
    } catch (error: any) {
      toast.error(`${t.operation_failed}: ${error.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.sites}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreate} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t.create_site}
          </button>
          <button onClick={() => void refresh()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title={t.refresh}>
            <RefreshCw className={`w-5 h-5 ${status.loading || sites.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {status.error && <AlertBox variant="error">{status.error}</AlertBox>}
      {status.data && (
        <div className={`${commonClasses.card} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {status.data.running
                ? <CheckCircle className="w-6 h-6 text-green-500" />
                : <AlertTriangle className="w-6 h-6 text-amber-500" />}
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{t.status}</p>
                  <StatusBadge
                    status={status.data.running ? t.running : t.stopped}
                    tone={status.data.running ? 'success' : 'warning'}
                    withDot={false}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {status.data.version || t.unknown_version} · PHP {status.data.embedded_php || '—'} · {t.protocols}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.dns01}: {status.data.dns01.manager} · {t.mercure}: {status.data.mercure.publisher_key_provisioned && status.data.mercure.subscriber_key_provisioned ? t.ready : t.not_ready}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => void testConfiguration()} disabled={busyAction !== null} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2">
                <FileCode className="w-4 h-4" />{t.test}
              </button>
              <button onClick={() => void runServiceAction('reload')} disabled={busyAction !== null} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${busyAction === 'reload' ? 'animate-spin' : ''}`} />{t.reload}
              </button>
              <button onClick={() => void runServiceAction('start')} disabled={busyAction !== null || status.data.running} className="p-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg" title={t.start}>
                <Power className="w-4 h-4" />
              </button>
              <button onClick={() => void runServiceAction('restart')} disabled={busyAction !== null || !status.data.running} className="p-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg" title={t.restart}>
                <RotateCw className={`w-4 h-4 ${busyAction === 'restart' ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => void runServiceAction('stop')} disabled={busyAction !== null || !status.data.running} className="p-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg" title={t.stop}>
                <PowerOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {sites.loading && !sites.data?.length && <LoadingBlock />}
      {sites.error && <AlertBox variant="error">{sites.error}</AlertBox>}
      {sites.data && sites.data.length === 0 && !sites.loading && (
        <div className={`${commonClasses.card} p-12 text-center text-slate-500 dark:text-slate-400`}>
          <Server className="w-12 h-12 mx-auto mb-4" />
          {t.no_sites}
        </div>
      )}
      {sites.data && sites.data.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {sites.data.map(site => (
            <div key={site.site_name} className={`${commonClasses.card} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{site.site_name}</h3>
                    <StatusBadge status={site.enabled ? t.enabled : t.disabled} tone={site.enabled ? 'success' : 'idle'} withDot={false} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">{site.hosts.join(', ') || site.domain}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => void setSiteEnabled(site, !site.enabled)} disabled={busyAction !== null} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title={site.enabled ? t.disable : t.enable}>
                    {site.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(site)} disabled={busyAction !== null} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title={t.edit}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteSite(site)} disabled={busyAction !== null} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded" title={t.delete}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">{t.upstream}</p>
                  <p className="font-mono break-all">{site.upstreams.join(', ') || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">{t.certificate_domain}</p>
                  <p className="font-mono break-all">{site.certificate_domain || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">{t.managed_by}</p>
                  <p className="font-mono break-all">{site.managed_by}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">{t.modified}</p>
                  <p>{site.updated_at ? new Date(site.updated_at).toLocaleString(lang) : '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSiteModal && (
        <Portal>
          <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
            <div className={`relative ${commonClasses.card} w-full max-w-3xl max-h-[90vh] overflow-y-auto`}>
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editingSite ? t.edit_site : t.create_site}</h3>
                <button onClick={() => setShowSiteModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={saveSite} className="p-5 space-y-4">
                {editingSite ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">{t.site_config}</label>
                    <textarea required value={form.site_config} onChange={event => setForm(previous => ({ ...previous, site_config: event.target.value }))} spellCheck={false} className="w-full h-96 font-mono text-xs p-3 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">{t.site_name}</label>
                      <input required value={form.site_name} onChange={event => setForm(previous => ({ ...previous, site_name: event.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{t.hosts}</label>
                      <input required value={form.hosts} onChange={event => setForm(previous => ({ ...previous, hosts: event.target.value }))} placeholder={t.hosts_placeholder} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{t.upstream}</label>
                      <input required value={form.upstream} onChange={event => setForm(previous => ({ ...previous, upstream: event.target.value }))} placeholder={NEXUS_DASH_FRONTEND_URL} className="w-full px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{t.certificate_domain}</label>
                      <input required value={form.certificate_domain} onChange={event => setForm(previous => ({ ...previous, certificate_domain: event.target.value }))} placeholder="example.com" className="w-full px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.certificate_hint}</p>
                    </div>
                  </>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.enabled} onChange={event => setForm(previous => ({ ...previous, enabled: event.target.checked }))} />
                  {t.enabled}
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowSiteModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg">{t.cancel}</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                    {saving ? t.saving : t.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      <ConfirmModal
        isOpen={deleteSite !== null}
        onClose={() => setDeleteSite(null)}
        onConfirm={confirmDelete}
        title={t.delete_site}
        message={t.delete_confirm.replace('{site}', deleteSite?.site_name || '')}
        confirmText={t.delete}
        cancelText={t.cancel}
        variant="danger"
        loading={busyAction?.startsWith('delete:') === true}
      />
    </div>
  );
};

export default FrankenPhpPanel;
