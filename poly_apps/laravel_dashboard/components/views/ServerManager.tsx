
import React, { useState, useEffect } from 'react';
import { 
  NginxSite, 
  SSLCertificate, 
  SystemInfo, 
  AsyncState, 
  Language,
  NginxSiteCreateRequest,
  NginxSiteConfig,
  ServerFileNode,
  PredefinedScript,
  ScriptExecution,
  UnifiedApp,
  UnifiedAppStatus,
  CertbotStatus,
  SystemProcess,
  SystemStorage,
  SystemServiceStatus
} from '../../types';
import { api } from '../../core/api';
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
import NginxSiteModal from '../server-manager/NginxSiteModal';

interface ServerManagerProps {
  lang?: Language;
}

type ServerTab = 'nginx' | 'ssl' | 'system' | 'files' | 'executor' | 'unified';

const ServerManager: React.FC<ServerManagerProps> = ({ lang = 'en' }) => {
  const [activeTab, setActiveTab] = useState<ServerTab>('nginx');
  const [octaneRestarting, setOctaneRestarting] = useState(false);
  const [restartProgress, setRestartProgress] = useState('');
  const [servicesSummary, setServicesSummary] = useState<any>(null);

  // Nginx Sites State
  const [nginxSites, setNginxSites] = useState<AsyncState<NginxSite[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [editingSite, setEditingSite] = useState<NginxSite | null>(null);
  const [selectedSite, setSelectedSite] = useState<NginxSite | null>(null);
  const [siteConfig, setSiteConfig] = useState<AsyncState<NginxSiteConfig>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  // SSL Certificates State
  const [sslCertificates, setSSLCertificates] = useState<AsyncState<SSLCertificate[]>>({
    data: [],
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
  const [systemProcesses, setSystemProcesses] = useState<AsyncState<SystemProcess[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [systemStorage, setSystemStorage] = useState<AsyncState<SystemStorage[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [systemServices, setSystemServices] = useState<AsyncState<SystemServiceStatus[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });

  const t = TRANSLATIONS[lang].server;
  const messages = t.messages || {};

  // Restart Octane with progress and auto-reconnect
  const handleRestartOctane = async () => {
    if (!confirm('Restart Octane server? This will reload all code changes.')) return;

    setOctaneRestarting(true);
    setRestartProgress('Initiating restart...');

    try {
      // Step 1: Trigger restart
      setRestartProgress('Sending restart command...');
      const response = await fetch('http://localhost:9000/api/server-manager/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Connection dropped is expected during restart
      if (!response.ok) {
        setRestartProgress('Server is restarting...');
      } else {
        const result = await response.json();
        if (result.success) {
          setRestartProgress('Server is restarting...');
        } else {
          throw new Error(result.message || result.error || 'Restart failed');
        }
      }
    } catch (error: any) {
      // Fetch error is expected when server goes down
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setRestartProgress('Server is restarting...');
      } else {
        setRestartProgress('Error: ' + error.message);
        setTimeout(() => setOctaneRestarting(false), 3000);
        return;
      }
    }

    // Step 2: Wait and reconnect (no timeout, keep trying until success)
    let attempts = 0;
    const checkInterval = 1000; // Check every 1 second

    const checkHealth = async (): Promise<boolean> => {
      try {
        const healthResponse = await fetch('http://localhost:9000/api/health', {
          method: 'GET',
          cache: 'no-cache'
        });
        return healthResponse.ok;
      } catch {
        return false;
      }
    };

    const reconnect = async () => {
      attempts++;
      const elapsed = Math.floor(attempts * checkInterval / 1000);
      setRestartProgress(`Reconnecting... (${elapsed}s elapsed)`);

      const isHealthy = await checkHealth();

      if (isHealthy) {
        setRestartProgress('Server is back online! Refreshing...');
        setTimeout(() => {
          setOctaneRestarting(false);
          window.location.reload();
        }, 1000);
      } else {
        // Keep trying indefinitely
        setTimeout(reconnect, checkInterval);
      }
    };

    // Wait 3 seconds before starting reconnection attempts
    setTimeout(() => {
      setRestartProgress('Waiting for server to start...');
      setTimeout(reconnect, 2000);
    }, 3000);
  };

  // Load Nginx Sites
  const loadNginxSites = async () => {
    setNginxSites(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getNginxSites();
      if (response.success && response.data) {
        const sites = response.data.sites || response.data;
        setNginxSites({
          data: Array.isArray(sites) ? sites : [],
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load nginx sites');
      }
    } catch (error: any) {
      setNginxSites({
        data: [],
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
      const response = await api.serverManagerV1.getSSLCertificates();
      if (response.success && response.data) {
        const certificates = response.data.certificates || response.data;
        setSSLCertificates({
          data: Array.isArray(certificates) ? certificates : [],
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load SSL certificates');
      }
    } catch (error: any) {
      setSSLCertificates({
        data: [],
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
      const response = await api.serverManagerV1.getSystemInfo();
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

  const loadSystemProcesses = async () => {
    setSystemProcesses(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getSystemProcesses();
      if (response.success && response.data) {
        setSystemProcesses({
          data: Array.isArray(response.data) ? response.data : [],
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error: any) {
      setSystemProcesses({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadSystemStorage = async () => {
    setSystemStorage(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getSystemStorage();
      if (response.success && response.data) {
        setSystemStorage({
          data: Array.isArray(response.data) ? response.data : [],
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error: any) {
      setSystemStorage({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadSystemServices = async () => {
    setSystemServices(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getSystemServices();
      if (response.success && response.data) {
        let servicesArray: SystemServiceStatus[] = [];

        if (Array.isArray(response.data)) {
          servicesArray = response.data;
        } else if (typeof response.data === 'object') {
          // New structure: { system_services: {...}, octane_services: {...}, application_services: {...} }
          const data = response.data as any;

          // Process system_services
          if (data.system_services && typeof data.system_services === 'object') {
            Object.entries(data.system_services).forEach(([key, service]: [string, any]) => {
              if (key !== 'certbot' && service && typeof service === 'object') {
                servicesArray.push({
                  name: service.name || key,
                  status: service.active ? 'running' : 'stopped',
                  active: service.active || false,
                  enabled: service.enabled || false,
                  status_output: service.status_output || ''
                });
              }
            });
          }

          // Process octane_services
          if (data.octane_services && typeof data.octane_services === 'object') {
            Object.entries(data.octane_services).forEach(([key, service]: [string, any]) => {
              if (service && typeof service === 'object') {
                servicesArray.push({
                  name: service.name || key,
                  status: service.status || (service.active ? 'running' : 'stopped'),
                  active: service.active || false,
                  enabled: service.enabled || false,
                  status_output: service.status_output || `PID: ${service.pid || 'N/A'}, Memory: ${service.memory || 'N/A'}, Uptime: ${service.uptime || 'N/A'}`
                });
              }
            });
          }

          // Process application_services
          if (data.application_services && typeof data.application_services === 'object') {
            Object.entries(data.application_services).forEach(([key, service]: [string, any]) => {
              if (service && typeof service === 'object') {
                servicesArray.push({
                  name: service.name || key,
                  status: service.status || (service.active ? 'running' : 'stopped'),
                  active: service.active || false,
                  enabled: service.enabled || false,
                  status_output: service.status_output || `PID: ${service.pid || 'N/A'}, Memory: ${service.memory || 'N/A'}, Uptime: ${service.uptime || 'N/A'}`
                });
              }
            });
          }
        }

        setSystemServices({
          data: servicesArray,
          loading: false,
          error: null,
          status: 'success'
        });

        // Save summary information
        if (data.summary) {
          setServicesSummary(data.summary);
        }
      }
    } catch (error: any) {
      setSystemServices({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
      setServicesSummary(null);
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
      loadSystemProcesses();
      loadSystemStorage();
      loadSystemServices();
    }
  }, [activeTab]);

  // Load Certbot Status
  const loadCertbotStatus = async () => {
    setCertbotStatus(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.detectCertbot();
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
      const response = await api.serverManagerV1.generateSSLCertificate({
        domain,
        provider: provider as 'dnspod' | 'cloudflare' | undefined,
        staging
      });
      if (response.success) {
        alert(response.data?.message || messages.cert_generation_started || 'Certificate generation started');
        setShowGenerateCert(false);
        await loadSSLCertificates();
      }
    } catch (error: any) {
      alert(error.message || messages.failed_to_generate_cert || 'Failed to generate certificate');
    }
  };

  const handleRenewAllCertificates = async () => {
    if (!confirm(messages.confirm_renew_certs || 'Are you sure you want to renew all certificates?')) return;
    try {
      const response = await api.serverManagerV1.renewSSLCertificates(true);
      if (response.success) {
        alert(response.data?.message || messages.cert_renewal_started || 'Certificate renewal started');
        await loadSSLCertificates();
      }
    } catch (error: any) {
      alert(error.message || messages.failed_to_renew_certs || 'Failed to renew certificates');
    }
  };

  const handleInstallCertbot = async () => {
    if (!confirm(messages.confirm_install_certbot || 'Are you sure you want to install Certbot?')) return;
    try {
      const response = await api.serverManagerV1.installCertbot();
      if (response.success) {
        alert(response.data?.message || messages.certbot_installation_started || 'Certbot installation started');
        await loadCertbotStatus();
      }
    } catch (error: any) {
      alert(error.message || messages.failed_to_install_certbot || 'Failed to install Certbot');
    }
  };

  // Nginx Site Actions
  const handleEnableSite = async (siteName: string) => {
    try {
      const response = await api.serverManagerV1.enableNginxSite(siteName);
      if (response.success) {
        await loadNginxSites();
      }
    } catch (error) {
      console.error('Failed to enable site:', error);
    }
  };

  const handleDisableSite = async (siteName: string) => {
    try {
      const response = await api.serverManagerV1.disableNginxSite(siteName);
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
      const response = await api.serverManagerV1.getNginxSiteConfig(siteName);
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
      const response = await api.serverManagerV1.reloadNginx();
      if (response.success) {
        alert(response.data?.message || messages.nginx_reloaded || 'Nginx reloaded successfully');
      }
    } catch (error) {
      console.error('Failed to reload nginx:', error);
    }
  };

  const handleCreateOrUpdateSite = async (data: NginxSiteCreateRequest) => {
    try {
      let response;
      if (editingSite) {
        response = await api.serverManagerV1.updateNginxSite(editingSite.site_name, data);
      } else {
        response = await api.serverManagerV1.createNginxSite(data);
      }

      if (response.success) {
        await loadNginxSites();
        alert(response.data?.message || (editingSite ? 'Site updated successfully' : 'Site created successfully'));
        setShowCreateSite(false);
        setEditingSite(null);
      }
    } catch (error) {
      console.error('Failed to save site:', error);
      throw error;
    }
  };

  const handleEditSite = (site: NginxSite) => {
    setEditingSite(site);
    setShowCreateSite(true);
  };

  const handleDeleteSite = async (siteName: string) => {
    const confirmMsg = (messages.confirm_delete_site || 'Are you sure you want to delete site: {site}?').replace('{site}', siteName);
    if (!confirm(confirmMsg)) return;
    try {
      const response = await api.serverManagerV1.deleteNginxSite(siteName);
      if (response.success) {
        await loadNginxSites();
        alert(response.data?.message || messages.site_deleted || 'Site deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete site:', error);
    }
  };

  const handleTestConfig = async () => {
    try {
      const response = await api.serverManagerV1.testNginxConfig();
      if (response.success && response.data) {
        if (response.data?.valid) {
          alert(messages.nginx_config_valid || 'Nginx configuration is valid!');
        } else {
          const errors = Array.isArray(response.data?.errors) ? response.data.errors : [];
          alert(`${messages.nginx_config_errors || 'Configuration errors:'}\n${errors.join('\n')}`);
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
              onClick={() => {
                loadSystemInfo();
                loadSystemProcesses();
                loadSystemStorage();
                loadSystemServices();
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${systemInfo.loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {activeTab === 'unified' && (
            <button
              onClick={handleRestartOctane}
              disabled={octaneRestarting}
              className={`px-4 py-2 ${octaneRestarting ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-lg text-sm font-medium flex items-center gap-2`}
            >
              <Rocket className={`w-4 h-4 ${octaneRestarting ? 'animate-spin' : ''}`} />
              {octaneRestarting ? 'Restarting...' : 'Restart Octane'}
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
                          onClick={() => handleEditSite(site)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          title={t.nginx.update}
                        >
                          <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
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
            {systemInfo.data && systemInfo.data.cpu && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`${commonClasses.card} p-4`}>
                  <h3 className="font-semibold mb-3">{t.system.cpu}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                      <span className="text-sm font-mono">{systemInfo.data.cpu?.usage || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${systemInfo.data.cpu?.usage || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                {systemInfo.data.memory && (
                  <div className={`${commonClasses.card} p-4`}>
                    <h3 className="font-semibold mb-3">{t.system.memory}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                        <span className="text-sm font-mono">{systemInfo.data.memory?.percentage || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${systemInfo.data.memory?.percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {systemInfo.data.disk && (
                  <div className={`${commonClasses.card} p-4`}>
                    <h3 className="font-semibold mb-3">{t.system.disk}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                        <span className="text-sm font-mono">{systemInfo.data.disk?.percentage || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${systemInfo.data.disk?.percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Services Summary */}
            {servicesSummary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className={`${commonClasses.card} p-4 bg-blue-50 dark:bg-blue-900/20`}>
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">System Services</h4>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {servicesSummary.system_running} / {servicesSummary.system_total}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Running</p>
                </div>
                <div className={`${commonClasses.card} p-4 bg-purple-50 dark:bg-purple-900/20`}>
                  <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Octane Services</h4>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {servicesSummary.octane_running} / {servicesSummary.octane_total}
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Running</p>
                </div>
                <div className={`${commonClasses.card} p-4 bg-green-50 dark:bg-green-900/20`}>
                  <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">Application Services</h4>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {servicesSummary.apps_running} / {servicesSummary.apps_total}
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Running</p>
                </div>
              </div>
            )}

            {/* System Services */}
            {systemServices.data && systemServices.data.length > 0 && (
              <div className={`${commonClasses.card} p-4`}>
                <h3 className="font-semibold mb-3">{t.system.services} ({systemServices.data.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {systemServices.data.map((service, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            service.status === 'running' ? 'bg-green-500' :
                            service.status === 'stopped' ? 'bg-slate-400' :
                            'bg-red-500'
                          }`} />
                          <span className="text-sm font-medium">{service.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            service.status === 'running' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            service.status === 'stopped' ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {service.status}
                          </span>
                          {service.enabled !== undefined && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              service.enabled
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}>
                              {service.enabled ? 'Auto-start: ON' : 'Auto-start: OFF'}
                            </span>
                          )}
                        </div>
                      </div>
                      {service.status_output && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
                            View detailed status
                          </summary>
                          <pre className="mt-2 text-xs bg-slate-900 text-green-400 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                            {service.status_output}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Storage */}
            {systemStorage.data && systemStorage.data.length > 0 && (
              <div className={`${commonClasses.card} p-4`}>
                <h3 className="font-semibold mb-3">{t.system.storage}</h3>
                <div className="space-y-2">
                  {systemStorage.data.map((storage, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{storage.filesystem}</span>
                        <span className="text-xs text-slate-500">{storage.use_percent}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-1">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: storage.use_percent }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{storage.used} / {storage.size}</span>
                        <span>{storage.available} available</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Mounted on: {storage.mounted_on}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Processes */}
            {systemProcesses.data && systemProcesses.data.length > 0 && (
              <div className={`${commonClasses.card} p-4`}>
                <h3 className="font-semibold mb-3">{t.system.processes}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-2">PID</th>
                        <th className="text-left p-2">User</th>
                        <th className="text-right p-2">CPU %</th>
                        <th className="text-right p-2">Memory %</th>
                        <th className="text-left p-2">Command</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemProcesses.data.slice(0, 20).map((process, idx) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-2 font-mono text-xs">{process.pid}</td>
                          <td className="p-2">{process.user}</td>
                          <td className="p-2 text-right">{process.cpu}%</td>
                          <td className="p-2 text-right">{process.memory}%</td>
                          <td className="p-2 font-mono text-xs truncate max-w-xs">{process.command}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
          <>
            {/* Octane Restart Progress */}
            {octaneRestarting && (
              <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 rounded-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Rocket className="w-12 h-12 text-purple-600 animate-bounce" />
                    <div className="absolute inset-0 animate-ping opacity-25">
                      <Rocket className="w-12 h-12 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-2">
                      Restarting Octane Server
                    </h3>
                    <p className="text-purple-700 dark:text-purple-300 font-medium mb-3">
                      {restartProgress}
                    </p>
                    <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-purple-600 dark:bg-purple-400 animate-pulse" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                      Please wait while the server restarts. The page will automatically reload when ready.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <UnifiedManagerTab lang={lang} />
          </>
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
                {siteConfig.data.content || siteConfig.data.config}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Nginx Site Create/Edit Modal */}
      <NginxSiteModal
        isOpen={showCreateSite}
        onClose={() => {
          setShowCreateSite(false);
          setEditingSite(null);
        }}
        onSave={handleCreateOrUpdateSite}
        site={editingSite}
        lang={lang}
      />
    </div>
  );
};

// File Manager Tab Component
const FileManagerTab: React.FC<{ lang: Language }> = ({ lang }) => {
  const [files, setFiles] = useState<AsyncState<ServerFileNode[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [currentPath, setCurrentPath] = useState<string>('/www/programing/core_node');
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const t = TRANSLATIONS[lang].server.files;

  const loadFiles = async (path?: string) => {
    setFiles(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.browseFiles(path);
      if (response.success && response.data) {
        const items = response.data.items || response.data;
        const responsePath = response.data.path || path;
        const paths = response.data.allowed_paths || [];

        setFiles({
          data: Array.isArray(items) ? items : [],
          loading: false,
          error: null,
          status: 'success'
        });
        setCurrentPath(responsePath || '');
        if (paths.length > 0) {
          setAllowedPaths(paths);
        }
      }
    } catch (error: any) {
      setFiles({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleDownload = async (filePath: string) => {
    try {
      const blob = await api.serverManagerV1.downloadFile(filePath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Allowed Paths Quick Access */}
      {allowedPaths.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Allowed Paths (Quick Access)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowedPaths.map((allowedPath, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentPath(allowedPath);
                  loadFiles(allowedPath);
                }}
                className="px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 transition-colors"
              >
                {allowedPath}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Path Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          placeholder="Enter path..."
          className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
        />
        <button
          onClick={() => loadFiles(currentPath || undefined)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
        >
          {t.browse}
        </button>
      </div>

      {files.loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {files.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-900 dark:text-red-100">{files.error}</span>
          </div>
        </div>
      )}

      {files.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.data.map((file, idx) => (
            <div key={idx} className={`${commonClasses.card} p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800`}>
              <div className="flex items-center gap-3 mb-2">
                {file.type === 'directory' ? (
                  <Folder className="w-5 h-5 text-blue-500" />
                ) : (
                  <File className="w-5 h-5 text-slate-500" />
                )}
                <span className="font-medium truncate">{file.name}</span>
              </div>
              {file.size && (
                <p className="text-xs text-slate-500 mb-2">{file.size} bytes</p>
              )}
              {file.type === 'file' && (
                <button
                  onClick={() => handleDownload(file.path)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  {t.download}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Code Executor Tab Component
const CodeExecutorTab: React.FC<{ lang: Language }> = ({ lang }) => {
  const [scripts, setScripts] = useState<AsyncState<PredefinedScript[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [execution, setExecution] = useState<AsyncState<ScriptExecution>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const t = TRANSLATIONS[lang].server.executor;

  const loadScripts = async () => {
    setScripts(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.listScripts();
      if (response.success && response.data) {
        const scripts = response.data.scripts || response.data;
        setScripts({
          data: Array.isArray(scripts) ? scripts : [],
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error: any) {
      setScripts({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const handleExecute = async (scriptId: number) => {
    setExecution(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.executeScript({ script_id: scriptId });
      if (response.success && response.data) {
        setExecution({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error: any) {
      setExecution({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  return (
    <div className="space-y-4">
      {scripts.loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {scripts.data && (
        <div className="grid grid-cols-1 gap-4">
          {scripts.data.map(script => (
            <div key={script.id} className={`${commonClasses.card} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{script.name}</h3>
                  <p className="text-sm text-slate-500">{script.category}</p>
                </div>
                <button
                  onClick={() => handleExecute(script.id)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                >
                  {t.execute}
                </button>
              </div>
              {script.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{script.description}</p>
              )}
              <div className="flex gap-4 text-xs text-slate-500">
                <span>{t.timeout}: {script.timeout}s</span>
                {script.requires_sudo && <span className="text-yellow-600">Requires Sudo</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {execution.data && (
        <div className={`${commonClasses.card} p-4`}>
          <h3 className="font-semibold mb-2">{t.output}</h3>
          <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-4 rounded overflow-x-auto">
            {execution.data.output}
          </pre>
          <div className="mt-2 text-xs text-slate-500">
            Exit Code: {execution.data.exit_code} | Time: {execution.data.execution_time}s
          </div>
        </div>
      )}
    </div>
  );
};

// Unified Manager Tab Component
const UnifiedManagerTab: React.FC<{ lang: Language }> = ({ lang }) => {
  const [apps, setApps] = useState<AsyncState<UnifiedApp[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<AsyncState<UnifiedAppStatus>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const t = TRANSLATIONS[lang].server.unified;

  const loadApps = async () => {
    setApps(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getUnifiedApps();
      if (response.success && response.data) {
        const apps = response.data.apps || response.data;
        setApps({
          data: Array.isArray(apps) ? apps : [],
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error: any) {
      setApps({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDeploy = async (appName: string, action: 'deploy' | 'start' | 'stop' | 'restart') => {
    try {
      const response = await api.serverManagerV1.deployUnifiedApp({ app_name: appName, action });
      if (response.success) {
        const actionMsg = (messages.action_completed || 'Action {action} completed').replace('{action}', action);
        alert(actionMsg);
        if (selectedApp === appName) {
          loadAppStatus(appName);
        }
      }
    } catch (error: any) {
      alert(error.message || messages.operation_failed || 'Operation failed');
    }
  };

  const loadAppStatus = async (appName: string) => {
    setAppStatus(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getUnifiedAppStatus(appName);
      if (response.success && response.data) {
        setAppStatus({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        setSelectedApp(appName);
      }
    } catch (error: any) {
      setAppStatus({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  return (
    <div className="space-y-4">
      {apps.loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {apps.data && (
        <div className="grid grid-cols-1 gap-4">
          {apps.data.map(app => (
            <div key={app.app_name} className={`${commonClasses.card} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{app.app_name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{app.app_path}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeploy(app.app_name, 'deploy')}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
                  >
                    {t.deploy}
                  </button>
                  <button
                    onClick={() => handleDeploy(app.app_name, 'start')}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  >
                    {t.start}
                  </button>
                  <button
                    onClick={() => handleDeploy(app.app_name, 'stop')}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  >
                    {t.stop}
                  </button>
                  <button
                    onClick={() => handleDeploy(app.app_name, 'restart')}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
                  >
                    {t.restart}
                  </button>
                  <button
                    onClick={() => loadAppStatus(app.app_name)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm"
                  >
                    {t.status}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  {app.port && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t.port}:</span> {app.port}
                    </p>
                  )}
                  {app.service_status && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-600 dark:text-slate-400">Service:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          app.service_status.status === 'running' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          app.service_status.status === 'stopped' ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                          app.service_status.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {app.service_status.installed ? app.service_status.status : 'Not Installed'}
                        </span>
                      </div>
                      {app.service_status.installed && (
                        <>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {app.service_status.service_name}
                            {app.service_status.enabled && ' (enabled)'}
                          </p>
                          {app.service_status.pid && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              PID: {app.service_status.pid}
                              {app.service_status.uptime && ` • ${app.service_status.uptime}`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  {app.nginx_proxy && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-600 dark:text-slate-400">Nginx Proxy:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          app.nginx_proxy.enabled ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          app.nginx_proxy.configured ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {app.nginx_proxy.enabled ? 'Enabled' : app.nginx_proxy.configured ? 'Configured' : 'Not Configured'}
                        </span>
                      </div>
                      {app.nginx_proxy.domains && app.nginx_proxy.domains.length > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium">Domains:</span>
                          <div className="mt-1 space-y-0.5">
                            {app.nginx_proxy.domains.map((domain, idx) => (
                              <div key={idx} className="ml-2">• {domain}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {app.nginx_proxy.config_file && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Config: {app.nginx_proxy.config_file}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {appStatus.data && selectedApp && (
        <div className={`${commonClasses.card} p-4`}>
          <h3 className="font-semibold mb-3">{selectedApp} - {t.status}</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-500">Overall Status:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                appStatus.data.overall_status === 'running' ? 'bg-green-100 text-green-700' :
                appStatus.data.overall_status === 'stopped' ? 'bg-slate-100 text-slate-700' :
                'bg-red-100 text-red-700'
              }`}>
                {appStatus.data.overall_status}
              </span>
            </div>
            {appStatus.data.service_status && (
              <div>
                <span className="text-slate-500">Service:</span>
                <span className="ml-2">{appStatus.data.service_status.status}</span>
              </div>
            )}
            {appStatus.data.process_info && (
              <div>
                <span className="text-slate-500">Processes:</span>
                <span className="ml-2">{appStatus.data.process_info.count} running</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerManager;

