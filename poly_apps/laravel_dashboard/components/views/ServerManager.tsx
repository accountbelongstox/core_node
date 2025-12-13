
import React, { useState, useEffect } from 'react';
import { 
  NginxSite, 
  SSLCertificate, 
  SystemInfo, 
  AsyncState, 
  Language,
  NginxSiteCreateRequest,
  NginxSiteConfig
} from '../../types';
import { apiService } from '../../services/apiService';
import { TRANSLATIONS } from '../../constants';
import { 
  Network, 
  Shield, 
  Server, 
  RefreshCw, 
  Plus, 
  Power, 
  PowerOff, 
  Trash2, 
  Eye, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  FileText,
  Play,
  Settings,
  Folder,
  File,
  Download,
  Terminal,
  Rocket,
  Clock
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface ServerManagerProps {
  lang?: Language;
}

type ServerTab = 'nginx' | 'ssl' | 'system' | 'files' | 'executor' | 'unified';

const ServerManager: React.FC<ServerManagerProps> = ({ lang = 'en' }) => {
  const [activeTab, setActiveTab] = useState<ServerTab>('nginx');
  
  // Nginx Sites State
  const [nginxSites, setNginxSites] = useState<AsyncState<NginxSite[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [selectedSite, setSelectedSite] = useState<NginxSite | null>(null);
  const [siteConfig, setSiteConfig] = useState<AsyncState<NginxSiteConfig>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  // SSL Certificates State
  const [sslCertificates, setSSLCertificates] = useState<AsyncState<SSLCertificate[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [showGenerateCert, setShowGenerateCert] = useState(false);
  const [certbotStatus, setCertbotStatus] = useState<AsyncState<CertbotStatus>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  // System Info State
  const [systemInfo, setSystemInfo] = useState<AsyncState<SystemInfo>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  const t = TRANSLATIONS[lang].server;

  // Load Nginx Sites
  const loadNginxSites = async () => {
    setNginxSites(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getNginxSites();
      if (response.success && response.data) {
        setNginxSites({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load nginx sites');
      }
    } catch (error: any) {
      setNginxSites({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  // Load SSL Certificates
  const loadSSLCertificates = async () => {
    setSSLCertificates(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getSSLCertificates();
      if (response.success && response.data) {
        setSSLCertificates({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load SSL certificates');
      }
    } catch (error: any) {
      setSSLCertificates({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  // Load System Info
  const loadSystemInfo = async () => {
    setSystemInfo(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getSystemInfo();
      if (response.success && response.data) {
        setSystemInfo({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load system info');
      }
    } catch (error: any) {
      setSystemInfo({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  useEffect(() => {
    if (activeTab === 'nginx') {
      loadNginxSites();
    } else if (activeTab === 'ssl') {
      loadSSLCertificates();
      loadCertbotStatus();
    } else if (activeTab === 'system') {
      loadSystemInfo();
    }
  }, [activeTab]);

  // Load Certbot Status
  const loadCertbotStatus = async () => {
    setCertbotStatus(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.detectCertbot();
      if (response.success && response.data) {
        setCertbotStatus({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to detect certbot');
      }
    } catch (error: any) {
      setCertbotStatus({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  // SSL Actions
  const handleGenerateCertificate = async (domain: string, provider?: string, staging?: boolean) => {
    try {
      const response = await apiService.generateSSLCertificate({
        domain,
        provider: provider as 'dnspod' | 'cloudflare' | undefined,
        staging
      });
      if (response.success) {
        alert(response.data?.message || 'Certificate generation started');
        setShowGenerateCert(false);
        await loadSSLCertificates();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to generate certificate');
    }
  };

  const handleRenewAllCertificates = async () => {
    if (!confirm('Are you sure you want to renew all certificates?')) return;
    try {
      const response = await apiService.renewSSLCertificates(true);
      if (response.success) {
        alert(response.data?.message || 'Certificate renewal started');
        await loadSSLCertificates();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to renew certificates');
    }
  };

  const handleInstallCertbot = async () => {
    if (!confirm('Are you sure you want to install Certbot?')) return;
    try {
      const response = await apiService.installCertbot();
      if (response.success) {
        alert(response.data?.message || 'Certbot installation started');
        await loadCertbotStatus();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to install Certbot');
    }
  };

  // Nginx Site Actions
  const handleEnableSite = async (siteName: string) => {
    try {
      const response = await apiService.enableNginxSite(siteName);
      if (response.success) {
        await loadNginxSites();
      }
    } catch (error) {
      console.error('Failed to enable site:', error);
    }
  };

  const handleDisableSite = async (siteName: string) => {
    try {
      const response = await apiService.disableNginxSite(siteName);
      if (response.success) {
        await loadNginxSites();
      }
    } catch (error) {
      console.error('Failed to disable site:', error);
    }
  };

  const handleViewConfig = async (siteName: string) => {
    setSiteConfig({ data: null, loading: true, error: null, status: 'loading' });
    try {
      const response = await apiService.getNginxSiteConfig(siteName);
      if (response.success && response.data) {
        setSiteConfig({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        setSelectedSite(nginxSites.data?.find(s => s.site_name === siteName) || null);
      }
    } catch (error: any) {
      setSiteConfig({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleReloadNginx = async () => {
    try {
      const response = await apiService.reloadNginx();
      if (response.success) {
        alert(response.data?.message || 'Nginx reloaded successfully');
      }
    } catch (error) {
      console.error('Failed to reload nginx:', error);
    }
  };

  const handleDeleteSite = async (siteName: string) => {
    if (!confirm(`Are you sure you want to delete site: ${siteName}?`)) return;
    try {
      const response = await apiService.deleteNginxSite(siteName);
      if (response.success) {
        await loadNginxSites();
        alert(response.data?.message || 'Site deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete site:', error);
    }
  };

  const handleTestConfig = async () => {
    try {
      const response = await apiService.testNginxConfig();
      if (response.success && response.data) {
        if (response.data.valid) {
          alert('Nginx configuration is valid!');
        } else {
          alert(`Configuration errors:\n${response.data.errors.join('\n')}`);
        }
      }
    } catch (error) {
      console.error('Failed to test config:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'nginx' as ServerTab, label: t.tabs.nginx, icon: Network },
    { id: 'ssl' as ServerTab, label: t.tabs.ssl, icon: Shield },
    { id: 'system' as ServerTab, label: t.tabs.system, icon: Server },
    { id: 'files' as ServerTab, label: t.tabs.files, icon: FileText },
    { id: 'executor' as ServerTab, label: t.tabs.executor, icon: Settings },
    { id: 'unified' as ServerTab, label: t.tabs.unified, icon: Settings },
  ];

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'nginx' && (
            <>
              <button
                onClick={handleTestConfig}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {t.nginx.test}
              </button>
              <button
                onClick={handleReloadNginx}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {t.nginx.reload}
              </button>
              <button
                onClick={() => setShowCreateSite(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.nginx.create}
              </button>
              <button
                onClick={loadNginxSites}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${nginxSites.loading ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
          {activeTab === 'ssl' && (
            <>
              <button
                onClick={() => setShowGenerateCert(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.ssl.generate}
              </button>
              <button
                onClick={handleRenewAllCertificates}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t.ssl.renew_all}
              </button>
              <button
                onClick={loadSSLCertificates}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${sslCertificates.loading ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
          {activeTab === 'system' && (
            <button
              onClick={loadSystemInfo}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${systemInfo.loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'nginx' && (
          <div className="space-y-4">
            {nginxSites.loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            )}
            {nginxSites.error && (
              <div className={`${commonClasses.card} p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800`}>
                <p className="text-red-600 dark:text-red-400">{nginxSites.error}</p>
              </div>
            )}
            {nginxSites.data && nginxSites.data.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {nginxSites.data.map(site => (
                  <div key={site.site_name} className={`${commonClasses.card} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${site.enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <h3 className="font-semibold text-lg">{site.domain}</h3>
                        <span className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {site.site_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {site.enabled ? (
                          <button
                            onClick={() => handleDisableSite(site.site_name)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            title={t.nginx.disable}
                          >
                            <PowerOff className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnableSite(site.site_name)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            title={t.nginx.enable}
                          >
                            <Power className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          </button>
                        )}
                        <button
                          onClick={() => handleViewConfig(site.site_name)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          title={t.nginx.view_config}
                        >
                          <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(site.site_name)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title={t.nginx.delete}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{t.nginx.www_dir}:</span>
                        <p className="font-mono text-xs mt-1">{site.www_dir}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{t.nginx.php_mode}:</span>
                        <p className="mt-1">{site.php_mode}</p>
                      </div>
                      {site.swoole_port && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">{t.nginx.swoole_port}:</span>
                          <p className="mt-1">{site.swoole_port}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">SSL:</span>
                        <p className="mt-1">{site.ssl_enabled ? t.nginx.enabled : t.nginx.disabled}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {nginxSites.data && nginxSites.data.length === 0 && (
              <div className={`${commonClasses.card} p-12 text-center`}>
                <Network className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-500 dark:text-slate-400">No nginx sites found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ssl' && (
          <div className="space-y-4">
            {/* Certbot Status */}
            {certbotStatus.data && (
              <div className={`${commonClasses.card} p-4 ${certbotStatus.data.installed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {certbotStatus.data.installed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-semibold">Certbot Status</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {certbotStatus.data.installed 
                          ? `Installed${certbotStatus.data.version ? ` (v${certbotStatus.data.version})` : ''}`
                          : 'Not Installed'}
                      </p>
                    </div>
                  </div>
                  {!certbotStatus.data.installed && (
                    <button
                      onClick={handleInstallCertbot}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                    >
                      {t.ssl.certbot_install}
                    </button>
                  )}
                </div>
              </div>
            )}

            {sslCertificates.loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            )}
            {sslCertificates.error && (
              <div className={`${commonClasses.card} p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800`}>
                <p className="text-red-600 dark:text-red-400">{sslCertificates.error}</p>
              </div>
            )}
            {sslCertificates.data && sslCertificates.data.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {sslCertificates.data.map(cert => (
                  <div key={cert.domain} className={`${commonClasses.card} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(cert.status)}
                        <h3 className="font-semibold text-lg">{cert.domain}</h3>
                        <span className={`px-2 py-1 text-xs rounded ${
                          cert.status === 'ok' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          cert.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {cert.status}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{t.ssl.expiry_date}:</span>
                        <p className="mt-1">{cert.expiry_date}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{t.ssl.days_until_expiry}:</span>
                        <p className="mt-1">{cert.days_until_expiry} days</p>
                      </div>
                      {cert.certificate_path && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Certificate Path:</span>
                          <p className="font-mono text-xs mt-1">{cert.certificate_path}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {sslCertificates.data && sslCertificates.data.length === 0 && (
              <div className={`${commonClasses.card} p-12 text-center`}>
                <Shield className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-500 dark:text-slate-400">No SSL certificates found</p>
                <button
                  onClick={() => setShowGenerateCert(true)}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  {t.ssl.generate}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-4">
            {systemInfo.loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            )}
            {systemInfo.error && (
              <div className={`${commonClasses.card} p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800`}>
                <p className="text-red-600 dark:text-red-400">{systemInfo.error}</p>
              </div>
            )}
            {systemInfo.data && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`${commonClasses.card} p-4`}>
                  <h3 className="font-semibold mb-3">{t.system.cpu}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                      <span className="text-sm font-mono">{systemInfo.data.cpu.usage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${systemInfo.data.cpu.usage}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className={`${commonClasses.card} p-4`}>
                  <h3 className="font-semibold mb-3">{t.system.memory}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                      <span className="text-sm font-mono">{systemInfo.data.memory.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${systemInfo.data.memory.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className={`${commonClasses.card} p-4`}>
                  <h3 className="font-semibold mb-3">{t.system.disk}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                      <span className="text-sm font-mono">{systemInfo.data.disk.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${systemInfo.data.disk.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <FileManagerTab lang={lang} />
        )}

        {activeTab === 'executor' && (
          <CodeExecutorTab lang={lang} />
        )}

        {activeTab === 'unified' && (
          <UnifiedManagerTab lang={lang} />
        )}
      </div>

      {/* Generate Certificate Modal */}
      {showGenerateCert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg">{t.ssl.generate}</h3>
              <button
                onClick={() => setShowGenerateCert(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t.ssl.domain}</label>
                <input
                  type="text"
                  id="cert-domain"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Provider (Optional)</label>
                <select
                  id="cert-provider"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">Auto</option>
                  <option value="dnspod">DNSPod</option>
                  <option value="cloudflare">Cloudflare</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cert-staging"
                  className="w-4 h-4"
                />
                <label htmlFor="cert-staging" className="text-sm">Use Staging Environment</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowGenerateCert(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const domain = (document.getElementById('cert-domain') as HTMLInputElement)?.value;
                    const provider = (document.getElementById('cert-provider') as HTMLSelectElement)?.value;
                    const staging = (document.getElementById('cert-staging') as HTMLInputElement)?.checked;
                    if (domain) {
                      handleGenerateCertificate(domain, provider || undefined, staging);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Site Config Modal */}
      {selectedSite && siteConfig.data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg">{selectedSite.domain} - Configuration</h3>
              <button
                onClick={() => {
                  setSelectedSite(null);
                  setSiteConfig({ data: null, loading: false, error: null, status: 'idle' });
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 p-4 rounded border border-slate-200 dark:border-slate-700">
                {siteConfig.data.config}
              </pre>
            </div>
          </div>
        </div>
