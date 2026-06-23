
import React, { useState, useEffect, useRef } from 'react';
import {
  NginxSite,
  SSLCertificate,
  SystemInfo,
  AsyncState,
  Language,
  NginxSiteCreateRequest,
  NginxSiteConfig,
  NginxStatusOverview,
  NginxServiceAction,
  NginxServiceResult,
  NginxLogsResponse,
  NginxInstallResult,
  NginxBackup,
  NginxBackupRestoreResult,
  NginxMainConfig,
  NginxMetrics,
  NginxBatchAction,
  NginxBatchResult,
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
import { getDefaultBaseURL } from '../../config/constants';
import { useToast, Modal, ConfirmModal } from '../admin';
import { logInfo, logSuccess, logError } from '../../core/logstore/logStore';
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
  Clock,
  Square,
  RotateCw,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Copy,
  Activity,
  Archive,
  FileCode,
  Save,
  ListChecks
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import NginxSiteModal from '../server-manager/NginxSiteModal';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';

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

  // Nginx Status / Service / Logs State
  const [nginxStatus, setNginxStatus] = useState<AsyncState<NginxStatusOverview>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [serviceBusy, setServiceBusy] = useState<NginxServiceAction | null>(null);
  const [showConfigTestOutput, setShowConfigTestOutput] = useState(false);
  const [showNginxLogs, setShowNginxLogs] = useState(false);
  const [nginxLogType, setNginxLogType] = useState<'access' | 'error'>('error');
  const [nginxLogLines, setNginxLogLines] = useState(200);
  const [nginxLogFollow, setNginxLogFollow] = useState(false);
  const [nginxLogFilterInput, setNginxLogFilterInput] = useState('');
  const [nginxLogFilter, setNginxLogFilter] = useState('');
  const [nginxLogs, setNginxLogs] = useState<AsyncState<NginxLogsResponse>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const nginxLogPreRef = useRef<HTMLPreElement | null>(null);

  // Nginx install / metrics / backups / main-config / batch state
  const [installBusy, setInstallBusy] = useState(false);
  const [nginxMetrics, setNginxMetrics] = useState<AsyncState<NginxMetrics>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [showNginxBackups, setShowNginxBackups] = useState(false);
  const [nginxBackups, setNginxBackups] = useState<AsyncState<NginxBackup[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [showMainConfig, setShowMainConfig] = useState(false);
  const [mainConfig, setMainConfig] = useState<AsyncState<NginxMainConfig>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [editedSiteConfig, setEditedSiteConfig] = useState('');
  const [savingSiteConfig, setSavingSiteConfig] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedSiteNames, setSelectedSiteNames] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState<NginxBatchAction | null>(null);
  const [renewingCert, setRenewingCert] = useState<string | null>(null);

  // Shared confirm-modal state (replaces window.confirm for nginx operations)
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText?: string;
    action: (() => Promise<void>) | null;
    loading: boolean;
  }>({ open: false, title: '', message: '', variant: 'warning', action: null, loading: false });

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
  const toast = useToast();
  const nginxNotInstalled = nginxStatus.data ? !nginxStatus.data.installed : false;

  // Scroll nginx log viewer to the bottom (newest lines) whenever new data arrives
  useEffect(() => {
    if (nginxLogPreRef.current) {
      nginxLogPreRef.current.scrollTop = nginxLogPreRef.current.scrollHeight;
    }
  }, [nginxLogs.data]);

  // Restart Octane with progress and auto-reconnect
  const handleRestartOctane = async () => {
    if (!confirm('Restart Octane server? This will reload all code changes.')) return;

    setOctaneRestarting(true);
    setRestartProgress('Initiating restart...');

    try {
      // Step 1: Trigger restart
      setRestartProgress('Sending restart command...');
      const apiBaseUrl = api.systemConfig['baseURL'] || getDefaultBaseURL();
      const response = await fetch(`${apiBaseUrl}/api/server-manager/restart`, {
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
        const apiBaseUrl = api.systemConfig['baseURL'] || getDefaultBaseURL();
        const healthResponse = await fetch(`${apiBaseUrl}/api/health`, {
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

  // Load Nginx Status Overview
  const loadNginxStatus = async () => {
    setNginxStatus(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getNginxStatus();
      if (response.success && response.data) {
        setNginxStatus({
          data: response.data as NginxStatusOverview,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load nginx status');
      }
    } catch (error: any) {
      setNginxStatus({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  // Open the shared confirm modal for a destructive nginx operation
  const requestConfirm = (opts: {
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    action: () => Promise<void>;
  }) => {
    setConfirmState({
      open: true,
      title: opts.title,
      message: opts.message,
      variant: opts.variant || 'warning',
      confirmText: opts.confirmText,
      action: opts.action,
      loading: false
    });
  };

  const handleConfirmAccept = async () => {
    const action = confirmState.action;
    if (!action) return;
    setConfirmState(prev => ({ ...prev, loading: true }));
    try {
      await action();
    } finally {
      setConfirmState(prev => ({ ...prev, open: false, loading: false, action: null }));
    }
  };

  // Load Nginx runtime metrics (stub_status + process totals)
  const loadNginxMetrics = async () => {
    setNginxMetrics(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getNginxMetrics();
      if (response.success && response.data) {
        setNginxMetrics({
          data: response.data as NginxMetrics,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load nginx metrics');
      }
    } catch (error: any) {
      setNginxMetrics({ data: null, loading: false, error: error.message, status: 'error' });
    }
  };

  // Nginx service control (start / stop / restart / reload)
  const runNginxService = async (action: NginxServiceAction) => {
    setServiceBusy(action);
    logInfo('nginx', `Running nginx ${action}…`);
    try {
      const response = await api.serverManagerV1.nginxService(action);
      const result = response.data as NginxServiceResult | undefined;
      if (response.success && result && result.success) {
        toast.success(`Nginx ${action} — OK${result.executed_via ? ` (${result.executed_via})` : ''}`);
        logSuccess('nginx', `Nginx ${action} succeeded${result.executed_via ? ` via ${result.executed_via}` : ''}`);
      } else {
        const msg = result?.error || result?.output || response.error || messages.operation_failed || 'Operation failed';
        toast.error(`Nginx ${action} failed — ${msg}`);
        logError('nginx', `Nginx ${action} failed — ${msg}`);
      }
    } catch (error: any) {
      toast.error(`Nginx ${action} failed — ${error.message}`);
      logError('nginx', `Nginx ${action} failed — ${error.message}`);
    } finally {
      setServiceBusy(null);
      // Refresh immediately, then once more after ~1.2s: pgrep can lag right
      // after a service transition and report the previous process state.
      await loadNginxStatus();
      setTimeout(() => {
        loadNginxStatus();
      }, 1200);
    }
  };

  const handleNginxService = (action: NginxServiceAction) => {
    if (nginxNotInstalled || serviceBusy) return;
    if (action === 'stop' || action === 'restart') {
      requestConfirm({
        title: action === 'stop' ? t.nginx.stop : t.nginx.restart,
        message: action === 'stop' ? t.nginx.confirm_stop : t.nginx.confirm_restart,
        variant: 'danger',
        confirmText: action === 'stop' ? t.nginx.stop : t.nginx.restart,
        action: () => runNginxService(action)
      });
      return;
    }
    void runNginxService(action);
  };

  // Install nginx (long-running — up to ~15 min per-request timeout in the API module)
  const handleInstallNginx = async () => {
    if (installBusy) return;
    setInstallBusy(true);
    logInfo('nginx', `Installing nginx… (${t.nginx.installing})`);
    try {
      const response = await api.serverManagerV1.installNginx();
      const result = response.data as NginxInstallResult | undefined;
      const tail = (result?.output || '')
        .split('\n')
        .map(l => l.trimEnd())
        .filter(Boolean)
        .slice(-15)
        .join('\n');
      if (response.success && result && result.installed) {
        if (result.already_installed) {
          toast.info(`${t.nginx.already_installed}${result.version ? ` (${result.version})` : ''}`);
          logInfo('nginx', `Nginx already installed${result.version ? ` — ${result.version}` : ''}`);
        } else {
          toast.success(`${t.nginx.install_success}${result.version ? ` (${result.version})` : ''}`);
          logSuccess('nginx', `Nginx installed${result.version ? ` — ${result.version}` : ''}${tail ? `\n${tail}` : ''}`);
        }
      } else {
        const msg = response.error || messages.operation_failed || 'Operation failed';
        toast.error(`${t.nginx.install_failed} — ${msg}`);
        logError('nginx', `${t.nginx.install_failed} — ${msg}${result?.exit_code !== undefined ? ` (exit ${result.exit_code})` : ''}${tail ? `\n${tail}` : ''}`);
      }
    } catch (error: any) {
      toast.error(`${t.nginx.install_failed} — ${error.message}`);
      logError('nginx', `${t.nginx.install_failed} — ${error.message}`);
    } finally {
      setInstallBusy(false);
      await loadNginxStatus();
      loadNginxSites();
    }
  };

  // Load Nginx config backups
  const loadNginxBackups = async () => {
    setNginxBackups(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getNginxBackups();
      if (response.success && response.data) {
        const raw: any = response.data;
        const backups = Array.isArray(raw) ? raw : raw.backups;
        setNginxBackups({
          data: Array.isArray(backups) ? backups : [],
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load nginx backups');
      }
    } catch (error: any) {
      setNginxBackups({ data: [], loading: false, error: error.message, status: 'error' });
    }
  };

  const handleRestoreBackup = (backup: NginxBackup) => {
    requestConfirm({
      title: t.nginx.backup_restore_title,
      message: t.nginx.backup_restore_message.replace('{file}', backup.file),
      variant: 'warning',
      confirmText: t.nginx.backup_restore,
      action: async () => {
        logInfo('nginx', `Restoring backup ${backup.file}…`);
        try {
          const response = await api.serverManagerV1.restoreNginxBackup(backup.file);
          const result = response.data as NginxBackupRestoreResult | undefined;
          if (response.success) {
            toast.success(`${t.nginx.backup_restored} — ${result?.site || backup.site}`);
            logSuccess('nginx', `Backup ${backup.file} restored → ${result?.config_file || ''}${result?.previous_backup ? ` (previous saved as ${result.previous_backup})` : ''}`);
            if (result?.config_test && !result.config_test.valid) {
              toast.error(`${t.nginx.config_test}: ${t.nginx.invalid} — ${result.config_test.output}`);
              logError('nginx', `Config test after restore failed — ${result.config_test.output}`);
            }
            await loadNginxSites();
            loadNginxStatus();
            loadNginxBackups();
          } else {
            throw new Error(response.error || messages.operation_failed || 'Operation failed');
          }
        } catch (error: any) {
          toast.error(`${t.nginx.backup_restore} — ${error.message}`);
          logError('nginx', `Restore backup ${backup.file} failed — ${error.message}`);
        }
      }
    });
  };

  // Load nginx.conf (main configuration) and open the viewer modal
  const openMainConfig = () => {
    setShowMainConfig(true);
    setMainConfig(prev => ({ ...prev, loading: true, status: 'loading' }));
    api.serverManagerV1
      .getNginxMainConfig()
      .then(response => {
        if (response.success && response.data) {
          setMainConfig({
            data: response.data as NginxMainConfig,
            loading: false,
            error: null,
            status: 'success'
          });
        } else {
          throw new Error(response.error || 'Failed to load nginx main config');
        }
      })
      .catch((error: any) => {
        setMainConfig({ data: null, loading: false, error: error.message, status: 'error' });
      });
  };

  // Batch operations on selected sites
  const toggleSiteSelected = (siteName: string) => {
    setSelectedSiteNames(prev =>
      prev.includes(siteName) ? prev.filter(n => n !== siteName) : [...prev, siteName]
    );
  };

  const handleBatchAction = async (action: NginxBatchAction) => {
    if (selectedSiteNames.length === 0 || batchBusy) return;
    setBatchBusy(action);
    logInfo('nginx', `Batch ${action}: ${selectedSiteNames.join(', ')}`);
    try {
      const response = await api.serverManagerV1.batchNginxSites(action, selectedSiteNames);
      const result = response.data as NginxBatchResult | undefined;
      if (response.success && result) {
        const summary = t.nginx.batch_summary
          .replace('{action}', action)
          .replace('{ok}', String(result.succeeded))
          .replace('{fail}', String(result.failed));
        if (result.failed > 0) {
          toast.warning(summary);
        } else {
          toast.success(summary);
        }
        (result.results || []).forEach(r => {
          if (r.success) {
            logSuccess('nginx', `[batch ${action}] ${r.site} — ${r.message}`);
          } else {
            logError('nginx', `[batch ${action}] ${r.site} — ${r.message}`);
          }
        });
        await loadNginxSites();
        loadNginxStatus();
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`Batch ${action} — ${error.message}`);
      logError('nginx', `Batch ${action} failed — ${error.message}`);
    } finally {
      setBatchBusy(null);
    }
  };

  // Renew the SSL certificate for one site (uses the certificates module)
  const handleRenewSiteCert = async (site: NginxSite) => {
    if (renewingCert) return;
    setRenewingCert(site.site_name);
    logInfo('nginx', `Renewing certificate for ${site.domain}…`);
    try {
      const response = await api.serverManagerV1.renewCertificates({ domain: site.domain });
      if (response.success) {
        toast.success(t.nginx.renew_cert_started.replace('{domain}', site.domain));
        logSuccess('nginx', `Certificate renewal started for ${site.domain}`);
        loadNginxSites();
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`${t.nginx.renew_cert_failed} — ${error.message}`);
      logError('nginx', `Renew certificate for ${site.domain} failed — ${error.message}`);
    } finally {
      setRenewingCert(null);
    }
  };

  // Load Nginx Logs
  const loadNginxLogs = async (
    type: 'access' | 'error' = nginxLogType,
    lines: number = nginxLogLines,
    filter: string = nginxLogFilter
  ) => {
    setNginxLogs(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getNginxLogs(type, lines, filter || undefined);
      if (response.success && response.data) {
        setNginxLogs({
          data: response.data as NginxLogsResponse,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load nginx logs');
      }
    } catch (error: any) {
      setNginxLogs({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleCopyInstallHint = async (hint: string) => {
    try {
      await navigator.clipboard.writeText(hint);
      toast.success(t.nginx.copied);
    } catch {
      toast.error(messages.operation_failed || 'Operation failed');
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
        const data = response.data as any;

        if (Array.isArray(response.data)) {
          servicesArray = response.data;
        } else if (typeof response.data === 'object') {
          // New structure: { system_services: {...}, octane_services: {...}, application_services: {...} }

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
        if (data && data.summary) {
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

  // Reload nginx data every time the nginx tab becomes active (not just on first mount)
  useEffect(() => {
    if (activeTab === 'nginx') {
      loadNginxSites();
      loadNginxStatus();
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

  // Load metrics whenever nginx is reported installed+running on the nginx tab
  useEffect(() => {
    if (activeTab === 'nginx' && nginxStatus.data?.installed && nginxStatus.data?.running) {
      loadNginxMetrics();
    }
  }, [activeTab, nginxStatus.data?.installed, nginxStatus.data?.running]);

  // Debounce the log keyword filter input (~400ms) into the effective filter
  useEffect(() => {
    const id = setTimeout(() => {
      setNginxLogFilter(nginxLogFilterInput.trim());
    }, 400);
    return () => clearTimeout(id);
  }, [nginxLogFilterInput]);

  // Re-fetch logs when the effective (debounced) filter changes
  useEffect(() => {
    if (showNginxLogs && activeTab === 'nginx') {
      loadNginxLogs(nginxLogType, nginxLogLines, nginxLogFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nginxLogFilter]);

  // Auto-follow: poll logs every 3s while enabled and the viewer is visible.
  // Cleared automatically on tab leave / viewer collapse / unmount.
  useEffect(() => {
    if (!nginxLogFollow || !showNginxLogs || activeTab !== 'nginx') return;
    const id = setInterval(() => {
      loadNginxLogs(nginxLogType, nginxLogLines, nginxLogFilter);
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nginxLogFollow, showNginxLogs, activeTab, nginxLogType, nginxLogLines, nginxLogFilter]);

  // Keep the editable config buffer in sync with the loaded site config
  useEffect(() => {
    if (siteConfig.data) {
      setEditedSiteConfig(siteConfig.data.content || siteConfig.data.config || '');
    } else {
      setEditedSiteConfig('');
    }
  }, [siteConfig.data]);

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
      const response = await api.serverManagerV1.renewSSLCertificates();
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
    logInfo('nginx', `Enabling site ${siteName}…`);
    try {
      const response = await api.serverManagerV1.enableNginxSite(siteName);
      if (response.success) {
        toast.success(t.nginx.site_enabled.replace('{site}', siteName));
        logSuccess('nginx', `Site ${siteName} enabled`);
        await loadNginxSites();
        loadNginxStatus();
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`Enable failed — ${error.message}`);
      logError('nginx', `Enable site ${siteName} failed — ${error.message}`);
    }
  };

  const handleDisableSite = async (siteName: string) => {
    logInfo('nginx', `Disabling site ${siteName}…`);
    try {
      const response = await api.serverManagerV1.disableNginxSite(siteName);
      if (response.success) {
        toast.success(t.nginx.site_disabled.replace('{site}', siteName));
        logSuccess('nginx', `Site ${siteName} disabled`);
        await loadNginxSites();
        loadNginxStatus();
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`Disable failed — ${error.message}`);
      logError('nginx', `Disable site ${siteName} failed — ${error.message}`);
    }
  };

  const handleViewConfig = async (siteName: string) => {
    // Open the modal immediately (selectedSite drives visibility) so a load
    // failure still shows the read-only fallback instead of nothing.
    setSelectedSite(nginxSites.data?.find(s => s.site_name === siteName) || null);
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
      } else {
        throw new Error(response.error || messages.failed_to_load || 'Failed to load');
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

  const closeSiteConfigModal = () => {
    setSelectedSite(null);
    setSiteConfig({ data: null, loading: false, error: null, status: 'idle' });
  };

  // Save the edited site config; the backend auto-tests and rolls back on
  // invalid config — its message is surfaced as-is.
  const handleSaveSiteConfig = async () => {
    if (!selectedSite || savingSiteConfig) return;
    setSavingSiteConfig(true);
    logInfo('nginx', `Saving config for ${selectedSite.site_name}…`);
    try {
      const response = await api.serverManagerV1.updateNginxSite(selectedSite.site_name, {
        site_config: editedSiteConfig
      });
      if (response.success) {
        toast.success(response.data?.message || response.message || t.nginx.config_saved);
        logSuccess('nginx', `Config for ${selectedSite.site_name} saved`);
        await loadNginxSites();
        loadNginxStatus();
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`${t.nginx.config_save_failed} — ${error.message}`);
      logError('nginx', `Save config for ${selectedSite.site_name} failed — ${error.message}`);
    } finally {
      setSavingSiteConfig(false);
    }
  };

  const handleCreateOrUpdateSite = async (data: NginxSiteCreateRequest) => {
    const siteName = editingSite ? editingSite.site_name : data.site_name;
    logInfo('nginx', `${editingSite ? 'Updating' : 'Creating'} site ${siteName}…`);
    try {
      let response;
      if (editingSite) {
        response = await api.serverManagerV1.updateNginxSite(editingSite.site_name, data);
      } else {
        response = await api.serverManagerV1.createNginxSite(data);
      }

      if (response.success) {
        await loadNginxSites();
        loadNginxStatus();
        toast.success(response.data?.message || (editingSite ? 'Site updated successfully' : 'Site created successfully'));
        logSuccess('nginx', `Site ${siteName} ${editingSite ? 'updated' : 'created'}`);
        setShowCreateSite(false);
        setEditingSite(null);
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`Save failed — ${error.message}`);
      logError('nginx', `Save site ${siteName} failed — ${error.message}`);
      throw error;
    }
  };

  const handleEditSite = (site: NginxSite) => {
    setEditingSite(site);
    setShowCreateSite(true);
  };

  const handleDeleteSite = (siteName: string) => {
    const confirmMsg = (messages.confirm_delete_site || 'Are you sure you want to delete site: {site}?').replace('{site}', siteName);
    requestConfirm({
      title: t.nginx.delete,
      message: confirmMsg,
      variant: 'danger',
      confirmText: t.nginx.delete,
      action: async () => {
        logInfo('nginx', `Deleting site ${siteName}…`);
        try {
          const response = await api.serverManagerV1.deleteNginxSite(siteName);
          if (response.success) {
            await loadNginxSites();
            loadNginxStatus();
            toast.success(response.data?.message || messages.site_deleted || 'Site deleted successfully');
            logSuccess('nginx', `Site ${siteName} deleted`);
          } else {
            throw new Error(response.error || messages.operation_failed || 'Operation failed');
          }
        } catch (error: any) {
          toast.error(`${messages.operation_failed || 'Operation failed'} — ${error.message}`);
          logError('nginx', `Delete site ${siteName} failed — ${error.message}`);
        }
      }
    });
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
              {/* Service Test/Reload live in the status card — header keeps Create + Refresh only */}
              <button
                onClick={() => setShowCreateSite(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.nginx.create}
              </button>
              <button
                onClick={() => {
                  loadNginxSites();
                  loadNginxStatus();
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                title={t.nginx.refresh}
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
            {/* Nginx Status Card */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-500" />
                  {t.nginx.status}
                </h3>
                <div className="flex items-center gap-2">
                  {nginxStatus.data?.installed && (
                    <button
                      onClick={openMainConfig}
                      className="px-2 py-1.5 text-xs font-mono flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
                      title={t.nginx.main_config}
                    >
                      <FileCode className="w-4 h-4" />
                      {t.nginx.main_config}
                    </button>
                  )}
                  <button
                    onClick={loadNginxStatus}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    title={t.nginx.refresh_status}
                  >
                    <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${nginxStatus.loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {nginxStatus.loading && !nginxStatus.data && (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              )}

              {nginxStatus.error && (
                <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{nginxStatus.error}</p>
                </div>
              )}

              {nginxStatus.data && (
                <div className="space-y-3">
                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1 ${
                      nginxStatus.data.installed
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {nginxStatus.data.installed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {nginxStatus.data.installed ? t.nginx.installed : t.nginx.not_installed}
                    </span>
                    {nginxStatus.data.version && (
                      <span className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                        {t.nginx.version}: {nginxStatus.data.version}
                      </span>
                    )}
                    {nginxStatus.data.installed && (
                      <span className={`px-2 py-1 text-xs rounded font-medium ${
                        nginxStatus.data.running
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {nginxStatus.data.running
                          ? `${t.nginx.running} · ${nginxStatus.data.process_count} ${t.nginx.processes}`
                          : t.nginx.stopped}
                      </span>
                    )}
                    {nginxStatus.data.config_test && (
                      <button
                        onClick={() => setShowConfigTestOutput(prev => !prev)}
                        title={nginxStatus.data.config_test.output}
                        className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1 ${
                          nginxStatus.data.config_test.valid
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {t.nginx.config_test}: {nginxStatus.data.config_test.valid ? t.nginx.valid : t.nginx.invalid}
                        {showConfigTestOutput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                    <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {t.nginx.sites_count}: {nginxStatus.data.sites.total} / {t.nginx.enabled} {nginxStatus.data.sites.enabled} / {t.nginx.disabled} {nginxStatus.data.sites.disabled}
                    </span>
                    {nginxStatus.data.service_manager && (
                      <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-mono">
                        {t.nginx.service_manager}: {nginxStatus.data.service_manager}
                      </span>
                    )}
                  </div>

                  {/* Config Test Output (expandable) */}
                  {showConfigTestOutput && nginxStatus.data.config_test && (
                    <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {nginxStatus.data.config_test.output}
                    </pre>
                  )}

                  {/* Not Installed Callout */}
                  {!nginxStatus.data.installed && (
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold text-amber-900 dark:text-amber-100">{t.nginx.install_hint_title}</span>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <button
                          onClick={handleInstallNginx}
                          disabled={installBusy}
                          className={`px-4 py-2 ${installBusy ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg text-sm font-medium flex items-center gap-2`}
                        >
                          {installBusy ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          {t.nginx.install}
                        </button>
                        {installBusy && (
                          <span className="text-xs text-amber-700 dark:text-amber-300">{t.nginx.installing}</span>
                        )}
                      </div>
                      {nginxStatus.data.install_hint && (
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-3 py-2 rounded overflow-x-auto">
                            {nginxStatus.data.install_hint}
                          </code>
                          <button
                            onClick={() => handleCopyInstallHint(nginxStatus.data!.install_hint!)}
                            className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded"
                            title={t.nginx.copy}
                          >
                            <Copy className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Runtime Metrics (stub_status + process totals) */}
                  {nginxStatus.data.installed && nginxStatus.data.running && (
                    <div className="flex flex-wrap items-center gap-2">
                      {nginxMetrics.data?.stub_status ? (
                        <>
                          <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                            {t.nginx.metrics_active}: {nginxMetrics.data.stub_status.active_connections}
                          </span>
                          <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                            {t.nginx.metrics_requests}: {nginxMetrics.data.stub_status.requests}
                          </span>
                          <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                            {t.nginx.metrics_memory}: {((nginxMetrics.data.totals?.memory_kb ?? 0) / 1024).toFixed(1)} MB
                          </span>
                          <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                            {t.nginx.metrics_cpu}: {(nginxMetrics.data.totals?.cpu_percent ?? 0).toFixed(1)}%
                          </span>
                        </>
                      ) : nginxMetrics.data && !nginxMetrics.data.stub_status ? (
                        <span
                          className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 cursor-help"
                          title={nginxMetrics.data.hint || t.nginx.metrics_unavailable}
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </span>
                      ) : null}
                      <button
                        onClick={loadNginxMetrics}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        title={t.nginx.refresh}
                      >
                        <Activity className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${nginxMetrics.loading ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  )}

                  {/* Service Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {([
                      { action: 'start' as NginxServiceAction, label: t.nginx.start, icon: Play, color: 'bg-green-600 hover:bg-green-700', disabledColor: 'bg-green-400' },
                      { action: 'stop' as NginxServiceAction, label: t.nginx.stop, icon: Square, color: 'bg-red-600 hover:bg-red-700', disabledColor: 'bg-red-400' },
                      { action: 'restart' as NginxServiceAction, label: t.nginx.restart, icon: RotateCw, color: 'bg-yellow-600 hover:bg-yellow-700', disabledColor: 'bg-yellow-400' },
                      { action: 'reload' as NginxServiceAction, label: t.nginx.reload, icon: RefreshCw, color: 'bg-indigo-600 hover:bg-indigo-700', disabledColor: 'bg-indigo-400' }
                    ]).map(({ action, label, icon: Icon, color, disabledColor }) => {
                      const disabled = nginxNotInstalled || serviceBusy !== null;
                      return (
                        <button
                          key={action}
                          onClick={() => handleNginxService(action)}
                          disabled={disabled}
                          className={`px-3 py-1.5 ${disabled ? `${disabledColor} cursor-not-allowed opacity-60` : color} text-white rounded-lg text-sm font-medium flex items-center gap-2`}
                        >
                          <Icon className={`w-4 h-4 ${serviceBusy === action ? 'animate-spin' : ''}`} />
                          {label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        setShowNginxLogs(prev => {
                          const next = !prev;
                          if (next && !nginxLogs.data && !nginxLogs.loading) loadNginxLogs();
                          return next;
                        });
                      }}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <ScrollText className="w-4 h-4" />
                      {t.nginx.logs}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {nginxNotInstalled ? (
              /* When nginx is not installed the sites area shows install guidance */
              <div className={`${commonClasses.card} p-12 text-center`}>
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                <p className="text-slate-500 dark:text-slate-400">{t.nginx.install_guidance}</p>
              </div>
            ) : (
              <>
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
                  <>
                    {/* Sites list header with batch-mode toggle + action bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Network className="w-4 h-4 text-indigo-500" />
                        {t.nginx.sites}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {batchMode && (
                          <>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {t.nginx.batch_selected.replace('{n}', String(selectedSiteNames.length))}
                            </span>
                            <button
                              onClick={() => handleBatchAction('enable')}
                              disabled={selectedSiteNames.length === 0 || batchBusy !== null}
                              className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1 ${
                                selectedSiteNames.length === 0 || batchBusy !== null
                                  ? 'bg-green-400 cursor-not-allowed opacity-60'
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              <Power className={`w-3.5 h-3.5 ${batchBusy === 'enable' ? 'animate-pulse' : ''}`} />
                              {t.nginx.batch_enable}
                            </button>
                            <button
                              onClick={() => handleBatchAction('disable')}
                              disabled={selectedSiteNames.length === 0 || batchBusy !== null}
                              className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1 ${
                                selectedSiteNames.length === 0 || batchBusy !== null
                                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                                  : 'bg-slate-600 hover:bg-slate-700'
                              }`}
                            >
                              <PowerOff className={`w-3.5 h-3.5 ${batchBusy === 'disable' ? 'animate-pulse' : ''}`} />
                              {t.nginx.batch_disable}
                            </button>
                            <button
                              onClick={() => handleBatchAction('test')}
                              disabled={selectedSiteNames.length === 0 || batchBusy !== null}
                              className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1 ${
                                selectedSiteNames.length === 0 || batchBusy !== null
                                  ? 'bg-yellow-400 cursor-not-allowed opacity-60'
                                  : 'bg-yellow-600 hover:bg-yellow-700'
                              }`}
                            >
                              <CheckCircle className={`w-3.5 h-3.5 ${batchBusy === 'test' ? 'animate-pulse' : ''}`} />
                              {t.nginx.batch_test}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setBatchMode(prev => {
                              if (prev) setSelectedSiteNames([]);
                              return !prev;
                            });
                          }}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1 ${
                            batchMode
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <ListChecks className="w-4 h-4" />
                          {t.nginx.batch}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {nginxSites.data.map(site => {
                        const cert = site.cert_expiry;
                        const certClass = cert
                          ? cert.days_left <= 7
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : cert.days_left <= 30
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : '';
                        const certLabel = cert
                          ? cert.days_left < 0
                            ? t.nginx.cert_expired
                            : t.nginx.cert_expires_in.replace('{days}', String(cert.days_left))
                          : '';
                        return (
                          <div key={site.site_name} className={`${commonClasses.card} p-4`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {batchMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedSiteNames.includes(site.site_name)}
                                    onChange={() => toggleSiteSelected(site.site_name)}
                                    className="w-4 h-4"
                                  />
                                )}
                                <div className={`w-3 h-3 rounded-full shrink-0 ${site.enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                                <h3 className="font-semibold text-lg truncate">{site.domain}</h3>
                                <span className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {site.site_type}
                                </span>
                                {site.config_type && (
                                  <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    {site.config_type}
                                  </span>
                                )}
                                {Array.isArray(site.listen_ports) && site.listen_ports.length > 0 && (
                                  <span
                                    className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-mono"
                                    title={t.nginx.ports}
                                  >
                                    {site.listen_ports.map(p => `:${p}`).join(' ')}
                                  </span>
                                )}
                                {cert && (
                                  <span
                                    className={`px-2 py-1 text-xs rounded font-medium ${certClass}`}
                                    title={cert.expires_at}
                                  >
                                    SSL · {certLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {site.ssl_enabled && (
                                  <button
                                    onClick={() => handleRenewSiteCert(site)}
                                    disabled={renewingCert !== null}
                                    className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                                    title={t.nginx.renew_cert}
                                  >
                                    <Shield className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 ${renewingCert === site.site_name ? 'animate-pulse' : ''}`} />
                                  </button>
                                )}
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
                              {Array.isArray(site.server_names) && site.server_names.length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-slate-500 dark:text-slate-400">{t.nginx.domain}:</span>
                                  <p className="font-mono text-xs mt-1 truncate" title={site.server_names.join(' ')}>
                                    {site.server_names.join(' ')}
                                  </p>
                                </div>
                              )}
                              {site.modified_human && (
                                <div>
                                  <span className="text-slate-500 dark:text-slate-400">{t.nginx.modified}:</span>
                                  <p className="text-xs mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {site.modified_human}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {nginxSites.data && nginxSites.data.length === 0 && !nginxSites.loading && (
                  <div className={`${commonClasses.card} p-12 text-center`}>
                    <Network className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                    <p className="text-slate-500 dark:text-slate-400">{t.nginx.no_sites}</p>
                    <button
                      onClick={() => setShowCreateSite(true)}
                      className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {t.nginx.create}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Nginx Logs (collapsible) */}
            <div className={commonClasses.card}>
              <button
                onClick={() => {
                  setShowNginxLogs(prev => {
                    const next = !prev;
                    if (next && !nginxLogs.data && !nginxLogs.loading) loadNginxLogs();
                    return next;
                  });
                }}
                className="w-full flex items-center justify-between p-4"
              >
                <span className="font-semibold flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-indigo-500" />
                  {t.nginx.logs}
                </span>
                {showNginxLogs ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {showNginxLogs && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
                      {(['access', 'error'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => {
                            setNginxLogType(type);
                            loadNginxLogs(type, nginxLogLines);
                          }}
                          className={`px-3 py-1.5 text-sm font-medium ${
                            nginxLogType === type
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {type === 'access' ? t.nginx.access_log : t.nginx.error_log}
                        </button>
                      ))}
                    </div>
                    <label className="text-sm text-slate-500 dark:text-slate-400">{t.nginx.lines}</label>
                    <select
                      value={nginxLogLines}
                      onChange={(e) => {
                        const lines = parseInt(e.target.value, 10);
                        setNginxLogLines(lines);
                        loadNginxLogs(nginxLogType, lines);
                      }}
                      className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      {[100, 200, 500, 1000].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={nginxLogFilterInput}
                      onChange={(e) => setNginxLogFilterInput(e.target.value)}
                      placeholder={t.nginx.filter_placeholder}
                      className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-44"
                    />
                    <button
                      onClick={() => setNginxLogFollow(prev => !prev)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1 ${
                        nginxLogFollow
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                      title={t.nginx.auto_follow}
                    >
                      <Play className={`w-3.5 h-3.5 ${nginxLogFollow ? 'animate-pulse' : ''}`} />
                      {t.nginx.auto_follow}
                    </button>
                    <button
                      onClick={() => loadNginxLogs()}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      title={t.nginx.refresh}
                    >
                      <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${nginxLogs.loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {nginxLogs.loading && !nginxLogs.data && (
                    <div className="flex items-center justify-center py-6">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                    </div>
                  )}

                  {nginxLogs.error && (
                    <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-600 dark:text-red-400">{nginxLogs.error}</p>
                    </div>
                  )}

                  {nginxLogs.data && !nginxLogs.data.exists && (
                    <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.nginx.no_log_file}</p>
                      <p className="text-xs font-mono text-slate-400 mt-1">{nginxLogs.data.file}</p>
                    </div>
                  )}

                  {nginxLogs.data && nginxLogs.data.exists && (
                    <>
                      <pre
                        ref={nginxLogPreRef}
                        className="text-xs font-mono bg-slate-900 text-slate-200 p-3 rounded h-64 overflow-y-auto overflow-x-auto whitespace-pre-wrap"
                      >
                        {nginxLogs.data.lines.length > 0 ? nginxLogs.data.lines.join('\n') : '(empty)'}
                      </pre>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{nginxLogs.data.file}</span>
                        <span>
                          {nginxLogs.data.filter && nginxLogs.data.scanned_lines !== undefined && (
                            <span className="mr-2">{t.nginx.scanned_lines.replace('{n}', String(nginxLogs.data.scanned_lines))}</span>
                          )}
                          {(nginxLogs.data.size_bytes / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Nginx Config Backups (collapsible) */}
            {!nginxNotInstalled && (
              <div className={commonClasses.card}>
                <button
                  onClick={() => {
                    setShowNginxBackups(prev => {
                      const next = !prev;
                      if (next && !nginxBackups.loading) loadNginxBackups();
                      return next;
                    });
                  }}
                  className="w-full flex items-center justify-between p-4"
                >
                  <span className="font-semibold flex items-center gap-2">
                    <Archive className="w-4 h-4 text-indigo-500" />
                    {t.nginx.backups}
                  </span>
                  {showNginxBackups ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showNginxBackups && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex justify-end">
                      <button
                        onClick={loadNginxBackups}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        title={t.nginx.refresh}
                      >
                        <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${nginxBackups.loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {nginxBackups.loading && (!nginxBackups.data || nginxBackups.data.length === 0) && (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                      </div>
                    )}

                    {nginxBackups.error && (
                      <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400">{nginxBackups.error}</p>
                      </div>
                    )}

                    {!nginxBackups.loading && !nginxBackups.error && nginxBackups.data && nginxBackups.data.length === 0 && (
                      <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded">
                        <Archive className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t.nginx.backups_empty}</p>
                      </div>
                    )}

                    {nginxBackups.data && nginxBackups.data.length > 0 && (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {nginxBackups.data.map(backup => (
                          <div
                            key={backup.file}
                            className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`px-2 py-0.5 text-xs rounded font-medium shrink-0 ${
                                  backup.type === 'delete'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}
                              >
                                {backup.type === 'delete' ? t.nginx.backup_type_delete : t.nginx.backup_type_update}
                              </span>
                              <span className="text-sm font-medium shrink-0">{backup.site}</span>
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={backup.file}>
                                {backup.file}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                              <span>{(backup.size_bytes / 1024).toFixed(1)} KB</span>
                              <span>{backup.created_at}</span>
                              <button
                                onClick={() => handleRestoreBackup(backup)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                              >
                                <RotateCw className="w-3 h-3" />
                                {t.nginx.backup_restore}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
          <div className="relative bg-white dark:bg-slate-800 rounded-lg max-w-md w-full">
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
        </Portal>
      )}

      {/* Site Config Modal (editable) */}
      {selectedSite && (
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
          <div className="relative bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg">{selectedSite.domain} - {t.nginx.edit_config}</h3>
              <button
                onClick={closeSiteConfigModal}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {siteConfig.loading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              )}
              {siteConfig.error && (
                <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {t.nginx.config_load_failed} — {siteConfig.error}
                  </p>
                </div>
              )}
              {siteConfig.data && (
                <textarea
                  value={editedSiteConfig}
                  onChange={(e) => setEditedSiteConfig(e.target.value)}
                  spellCheck={false}
                  className="w-full h-80 text-xs font-mono bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 p-4 rounded border border-slate-200 dark:border-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
            {siteConfig.data && (
              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => handleCopyInstallHint(editedSiteConfig)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {t.nginx.copy}
                </button>
                <button
                  onClick={handleSaveSiteConfig}
                  disabled={savingSiteConfig}
                  className={`px-4 py-2 ${savingSiteConfig ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg text-sm font-medium flex items-center gap-2`}
                >
                  <Save className={`w-4 h-4 ${savingSiteConfig ? 'animate-pulse' : ''}`} />
                  {savingSiteConfig ? t.nginx.saving : t.nginx.save}
                </button>
              </div>
            )}
          </div>
        </div>
        </Portal>
      )}

      {/* Main nginx.conf Viewer Modal */}
      <Modal
        isOpen={showMainConfig}
        onClose={() => setShowMainConfig(false)}
        title={t.nginx.main_config}
        size="xl"
      >
        {mainConfig.loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}
        {mainConfig.error && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{mainConfig.error}</p>
          </div>
        )}
        {mainConfig.data && !mainConfig.data.exists && (
          <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.nginx.config_file_missing}</p>
            <p className="text-xs font-mono text-slate-400 mt-1">{mainConfig.data.file}</p>
          </div>
        )}
        {mainConfig.data && mainConfig.data.exists && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                {t.nginx.worker_processes}: {mainConfig.data.parsed?.worker_processes ?? '—'}
              </span>
              <span className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                {t.nginx.worker_connections}: {mainConfig.data.parsed?.worker_connections ?? '—'}
              </span>
              {mainConfig.data.truncated && (
                <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {t.nginx.truncated}
                </span>
              )}
              <button
                onClick={() => handleCopyInstallHint(mainConfig.data!.content)}
                className="ml-auto px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                {t.nginx.copy}
              </button>
            </div>

            {Array.isArray(mainConfig.data.conf_d) && mainConfig.data.conf_d.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t.nginx.conf_d_files}</p>
                <div className="flex flex-wrap gap-2">
                  {mainConfig.data.conf_d.map(f => (
                    <span
                      key={f.file}
                      className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-mono"
                    >
                      {f.file} · {(f.size_bytes / 1024).toFixed(1)} KB
                    </span>
                  ))}
                </div>
              </div>
            )}

            <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 p-4 rounded border border-slate-200 dark:border-slate-700 max-h-96 overflow-y-auto overflow-x-auto whitespace-pre-wrap">
              {mainConfig.data.content}
            </pre>
            <p className="text-xs font-mono text-slate-400">{mainConfig.data.file}</p>
          </div>
        )}
      </Modal>

      {/* Shared confirm modal for nginx operations (stop/restart/delete/restore) */}
      <ConfirmModal
        isOpen={confirmState.open}
        onClose={() => setConfirmState(prev => ({ ...prev, open: false, action: null }))}
        onConfirm={handleConfirmAccept}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={t.nginx.cancel}
        variant={confirmState.variant}
        loading={confirmState.loading}
      />

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
      const blob = (await api.serverManagerV1.downloadFile(filePath)) as unknown as Blob;
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
  const messages = TRANSLATIONS[lang].server.messages || {};

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
            // app_name alone is not unique: apps/ and pyapps/ can both contain
            // an app of the same name (e.g. okx_price_monitor), so key on path.
            <div key={`${app.app_name}:${app.app_path}`} className={`${commonClasses.card} p-4`}>
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

