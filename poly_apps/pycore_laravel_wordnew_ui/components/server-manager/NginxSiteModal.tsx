import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { NginxSite, NginxSiteCreateRequest, NginxPortCheck, Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { commonClasses } from '../../styles/theme';
import { api } from '@/apps/laravel-manager/api';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';
import { AlertBox, Field } from '../common';

interface NginxSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NginxSiteCreateRequest) => Promise<void>;
  site?: NginxSite | null;
  lang?: Language;
}

const NginxSiteModal: React.FC<NginxSiteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  site,
  lang = 'en'
}) => {
  const t = TRANSLATIONS[lang].server.nginx;
  const isEdit = !!site;

  const [formData, setFormData] = useState<NginxSiteCreateRequest>({
    site_name: '',
    domain: '',
    site_type: 'static',
    config: {
      www_dir: '/www/wwwroot/',
      php_mode: 'none',
      php_version: '8.2'
    },
    ssl_enabled: false,
    auto_ssl: false,
    dns_provider: 'none'
  });

  const [saving, setSaving] = useState(false);
  const [polyApps, setPolyApps] = useState<any[]>([]);
  const [selectedPolyApp, setSelectedPolyApp] = useState<string>('');
  const [loadingApps, setLoadingApps] = useState(false);
  const [portChecks, setPortChecks] = useState<Record<number, NginxPortCheck>>({});

  // Load PolyApps list
  useEffect(() => {
    if (isOpen) {
      loadPolyApps();
    } else {
      setPortChecks({});
    }
  }, [isOpen]);

  // Port-conflict probe (create mode only, non-blocking): port 80 on open,
  // port 443 once SSL is enabled.
  const checkPort = async (port: number) => {
    try {
      const response = await api.serverManagerV1.checkNginxPort(port);
      if (response.success && response.data) {
        setPortChecks(prev => ({ ...prev, [port]: response.data as NginxPortCheck }));
      }
    } catch {
      // best-effort probe — never block the form on failure
    }
  };

  useEffect(() => {
    if (isOpen && !isEdit) {
      checkPort(80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit]);

  useEffect(() => {
    if (isOpen && !isEdit && formData.ssl_enabled && !portChecks[443]) {
      checkPort(443);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, formData.ssl_enabled]);

  const portWarnings = [80, 443]
    .map(port => portChecks[port])
    .filter((check: NginxPortCheck | undefined): check is NginxPortCheck =>
      !!check && check.in_use && !check.is_nginx
    );

  const loadPolyApps = async () => {
    setLoadingApps(true);
    try {
      const response = await api.serverManagerV1.listApps();
      if (response.success && response.data?.apps) {
        // Filter only polyApp type
        const polyAppsOnly = response.data.apps.filter((app: any) => app.type === 'polyApp');
        setPolyApps(polyAppsOnly);
      }
    } catch (error) {
      console.error('Failed to load PolyApps:', error);
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    if (site) {
      setFormData({
        site_name: site.site_name,
        domain: site.domain,
        site_type: site.site_type || 'static',
        config: {
          www_dir: site.www_dir || '/www/wwwroot/',
          php_mode: site.php_mode || 'none',
          php_version: '8.2',
          swoole_port: site.swoole_port
        },
        ssl_enabled: site.ssl_enabled || false,
        auto_ssl: false,
        dns_provider: 'none'
      });
    } else {
      setFormData({
        site_name: '',
        domain: '',
        site_type: 'static',
        config: {
          www_dir: '/www/wwwroot/',
          php_mode: 'none',
          php_version: '8.2'
        },
        ssl_enabled: false,
        auto_ssl: false,
        dns_provider: 'none'
      });
    }
  }, [site]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save site:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof NginxSiteCreateRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSiteTypeChange = (siteType: NginxSiteCreateRequest['site_type']) => {
    const updates: Partial<NginxSiteCreateRequest> = { site_type: siteType };

    // Auto-update php_mode and www_dir based on site type
    if (siteType === 'static') {
      updates.config = {
        ...formData.config!,
        php_mode: 'none',
        www_dir: `/www/wwwroot/${formData.domain || 'site'}`
      };
    } else if (siteType === 'laravel') {
      updates.config = {
        ...formData.config!,
        php_mode: 'swoole',
        www_dir: '/www/programing/core_node/poly_apps/laravel_main'
      };
    } else if (siteType === 'proxy') {
      updates.config = {
        ...formData.config!,
        php_mode: 'none',
        www_dir: '' // Will be set from polyApp selection
      };
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handlePolyAppChange = (appName: string) => {
    setSelectedPolyApp(appName);
    const app = polyApps.find(a => a.name === appName);
    if (app) {
      setFormData(prev => ({
        ...prev,
        config: {
          ...prev.config!,
          proxy_target: `http://localhost:${app.port}`,
          www_dir: `/www/programing/core_node/${app.path}`
        }
      }));
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config!, [field]: value }
    }));
  };

  if (!isOpen) return null;

  return (
    <Portal>
    <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
      <div className={`relative ${commonClasses.card} w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isEdit ? t.update : t.create_site}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isEdit && portWarnings.length > 0 && (
            <AlertBox variant="warning">
              <div className="space-y-1">
                {portWarnings.map(warning => (
                  <p key={warning.port}>
                    {t.port_in_use
                      .replace('{port}', String(warning.port))
                      .replace('{holder}', warning.holder || '?')}
                  </p>
                ))}
              </div>
            </AlertBox>
          )}

          <Field label={t.site_name} hint="Config file name (no spaces or special characters)">
            <input
              type="text"
              required
              value={formData.site_name}
              onChange={(e) => handleChange('site_name', e.target.value)}
              disabled={isEdit}
              className={commonClasses.input}
              placeholder="example_com"
            />
          </Field>

          <Field label={t.domain}>
            <input
              type="text"
              required
              value={formData.domain}
              onChange={(e) => handleChange('domain', e.target.value)}
              className={commonClasses.input}
              placeholder="example.com"
            />
          </Field>

          <Field label={t.site_type}>
            <select
              value={formData.site_type}
              onChange={(e) => handleSiteTypeChange(e.target.value as NginxSiteCreateRequest['site_type'])}
              className={commonClasses.input}
            >
              <option value="static">Static HTML/Files</option>
              <option value="laravel">Laravel (Swoole/Octane)</option>
              <option value="proxy">Reverse Proxy (PolyApp)</option>
            </select>
          </Field>

          {formData.site_type === 'proxy' && (
            <Field label="Select PolyApp" hint="Port is automatically assigned. Web directory is from app path.">
              <select
                value={selectedPolyApp}
                onChange={(e) => handlePolyAppChange(e.target.value)}
                className={commonClasses.input}
                disabled={loadingApps}
                required
              >
                <option value="">-- Select a PolyApp --</option>
                {polyApps.map((app) => (
                  <option key={app.name} value={app.name}>
                    {app.name} (Port: {app.port}) - {app.framework}
                  </option>
                ))}
              </select>
              {loadingApps && <p className="text-xs text-slate-500 mt-1">Loading applications...</p>}
              {!loadingApps && polyApps.length === 0 && (
                <p className="text-xs text-orange-500 mt-1">No PolyApps found. Deploy apps first.</p>
              )}
            </Field>
          )}

          <Field
            label={t.www_dir}
            hint={
              formData.site_type === 'static' ? 'Path where static files are located' :
              formData.site_type === 'laravel' ? 'Laravel application root directory (mapped via PathMapper)' :
              'Automatically set from selected PolyApp path'
            }
          >
            <input
              type="text"
              required
              value={formData.config?.www_dir || ''}
              onChange={(e) => handleConfigChange('www_dir', e.target.value)}
              className={commonClasses.input}
              placeholder={
                formData.site_type === 'static' ? '/www/wwwroot/example.com' :
                formData.site_type === 'laravel' ? '/www/programing/core_node/poly_apps/laravel_main' :
                'Auto-set from PolyApp'
              }
              readOnly={formData.site_type === 'proxy'}
            />
          </Field>

          {formData.site_type !== 'proxy' && (
            <>
              <Field
                label={t.php_mode}
                hint={formData.site_type === 'laravel' ? 'Laravel uses Swoole via Octane (fixed)' : undefined}
              >
                <select
                  value={formData.config?.php_mode || 'none'}
                  onChange={(e) => handleConfigChange('php_mode', e.target.value)}
                  className={commonClasses.input}
                  disabled={formData.site_type === 'laravel'}
                >
                  {formData.site_type === 'static' && <option value="none">None (Static Files)</option>}
                  {formData.site_type === 'static' && <option value="php-fpm">PHP-FPM</option>}
                  {formData.site_type === 'laravel' && <option value="swoole">Swoole (Laravel Octane)</option>}
                </select>
              </Field>

              {formData.config?.php_mode !== 'none' && formData.config?.php_mode !== 'swoole' && (
                <Field label="PHP Version">
                  <select
                    value={formData.config?.php_version || '8.2'}
                    onChange={(e) => handleConfigChange('php_version', e.target.value)}
                    className={commonClasses.input}
                  >
                    <option value="7.4">PHP 7.4</option>
                    <option value="8.0">PHP 8.0</option>
                    <option value="8.1">PHP 8.1</option>
                    <option value="8.2">PHP 8.2</option>
                    <option value="8.3">PHP 8.3</option>
                  </select>
                </Field>
              )}
            </>
          )}

          {formData.site_type === 'proxy' && formData.config?.proxy_target && (
            <Field
              label="Proxy Target"
              hint={`Automatically set to http://localhost:${(selectedPolyApp && polyApps.find(a => a.name === selectedPolyApp)?.port) || ''}`}
            >
              <input
                type="text"
                value={formData.config?.proxy_target || ''}
                readOnly
                className={`${commonClasses.input} bg-slate-100 dark:bg-slate-700 cursor-not-allowed`}
                placeholder="http://localhost:3000"
              />
            </Field>
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">SSL Configuration (Optional)</h3>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="ssl_enabled"
                checked={formData.ssl_enabled}
                onChange={(e) => handleChange('ssl_enabled', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="ssl_enabled" className="text-sm font-medium">Enable SSL</label>
            </div>

            {formData.ssl_enabled && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="auto_ssl"
                    checked={formData.auto_ssl}
                    onChange={(e) => handleChange('auto_ssl', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="auto_ssl" className="text-sm font-medium">Auto-generate SSL Certificate</label>
                </div>

                {formData.auto_ssl && (
                  <Field label="DNS Provider (for wildcard certs)" hint="DNS providers allow wildcard certificates. Requires API credentials configured on server.">
                    <select
                      value={formData.dns_provider || 'none'}
                      onChange={(e) => handleChange('dns_provider', e.target.value)}
                      className={commonClasses.input}
                    >
                      <option value="none">HTTP-01 Challenge (No DNS)</option>
                      <option value="dnspod">DNSPod (Tencent Cloud)</option>
                      <option value="cloudflare">Cloudflare</option>
                    </select>
                  </Field>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : (isEdit ? t.update : t.create)}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};

export default NginxSiteModal;
