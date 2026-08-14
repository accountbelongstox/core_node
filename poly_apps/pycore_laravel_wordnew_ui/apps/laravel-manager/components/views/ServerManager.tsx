
import React, { useState, useEffect, useRef } from 'react';
import {
  NginxSite,
  SSLCertificate,
  ServerRuntimeSystemInfo,
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
  SystemServiceStatus,
  StaticResourcesSummary,
  ViewType
} from '@/apps/laravel-manager/uiTypes';
import { api } from '@/apps/laravel-manager/api';
import { apiManager } from '@/core/integrations/laravel/ApiManager';
import { CenteredPage, CenteredTabBar } from '@/apps/laravel-manager/components/common/CenteredPageLayout';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';
import { useUnifiedApp } from '@/apps/laravel-manager/context/useUnifiedApp';
import { useToast, Modal, ConfirmModal } from '../admin';
import { logInfo, logSuccess, logError } from '@/core/logstore/logStore';
import {
  Network,
  Shield,
  Server,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Settings,
  Folder,
  File,
  Download,
  Terminal,
  Rocket,
  Copy,
  Save
} from 'lucide-react';
import { commonClasses } from '@/shared/styles/theme';
import { LoadingBlock, AlertBox, StatusBadge } from '../common';
import { useClipboard } from '@/apps/laravel-manager/hooks';
import NginxSiteModal from '../server-manager/NginxSiteModal';
import GenerateCertModal from '../server-manager/modals/GenerateCertModal';
import NginxPanel from '../server-manager/panels/NginxPanel';
import SslPanel from '../server-manager/panels/SslPanel';
import SystemPanel from '../server-manager/panels/SystemPanel';
import ServerFileManagerPanel from '../server-manager/panels/ServerFileManagerPanel';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '@/shared/styles/overlay';

interface ServerManagerProps {
  lang?: Language;
}

type ServerTab = 'nginx' | 'ssl' | 'system' | 'files' | 'executor' | 'unified';

const ServerManager: React.FC<ServerManagerProps> = ({ lang = 'en' }) => {
  const { setActiveView } = useUnifiedApp();
  const [activeTab, setActiveTab] = useState<ServerTab>(() => {
    try {
      const pending = localStorage.getItem('server_manager_tab');
      if (pending === 'system') {
        localStorage.removeItem('server_manager_tab');
        return 'system';
      }
    } catch { /* ignore */ }
    return 'nginx';
  });
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
  const [deleteFilesSite, setDeleteFilesSite] = useState<string | null>(null);
  const [deleteFilesPassword, setDeleteFilesPassword] = useState('');
  const [deleteFilesConfirm, setDeleteFilesConfirm] = useState('');
  const [certbotStatus, setCertbotStatus] = useState<AsyncState<CertbotStatus>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  // System Info State
  const [systemInfo, setSystemInfo] = useState<AsyncState<ServerRuntimeSystemInfo>>({
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
  const [staticResources, setStaticResources] = useState<AsyncState<StaticResourcesSummary>>({
    data: null,
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
  const { copy } = useClipboard();
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
      const response = await api.serverManager.restartCurrent();
      if (!response.success && !response.isNetworkError && !response.isTimeout) {
        throw new Error(response.error || response.message || 'Restart failed');
      }
      setRestartProgress('Server is restarting...');
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
        const endpoint = apiManager.getCurrentEndpoint();
        if (!endpoint) return false;
        const healthResponse = await apiManager.checkEndpoint(endpoint);
        return healthResponse.isHealthy;
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
      const response = await api.serverManagerV1.listNginxSites();
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
    if (renewingCert || certProgress) return;
    setRenewingCert(site.site_name);
    logInfo('nginx', `Certificate ensure for ${site.domain}…`);
    void startCertProgress(site.domain).finally(() => {
      setRenewingCert(null);
    });
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

  const handleCopyInstallHint = (hint: string) => {
    // useClipboard surfaces its own success/failure toasts (incl. execCommand fallback).
    void copy(hint, t.nginx.copied);
  };

  // Load SSL Certificates
  const loadSSLCertificates = async () => {
    setSSLCertificates(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.listCertificates();
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
      const response = await api.serverManagerV1.getProcesses();
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
      const response = await api.serverManagerV1.getStorage();
      if (response.success && response.data) {
        const data = response.data as Record<string, unknown>;
        const mounts = Array.isArray(data)
          ? data
          : (data.disk_usage as SystemStorage[] | undefined) ?? [];
        setSystemStorage({
          data: mounts,
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

  const loadStaticResources = async () => {
    setStaticResources(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getStaticResourcesSummary();
      if (response.success && response.data) {
        const summary = response.data as StaticResourcesSummary;
        setStaticResources({
          data: summary,
          loading: false,
          error: null,
          status: 'success'
        });
        if (summary.disk_usage?.length) {
          setSystemStorage(prev => ({
            ...prev,
            data: summary.disk_usage ?? prev.data,
            loading: false,
            error: null,
            status: 'success'
          }));
        }
      } else {
        throw new Error(response.error || 'Failed to load static resources');
      }
    } catch (error: any) {
      setStaticResources({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadSystemServices = async () => {
    setSystemServices(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getServices();
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
      loadStaticResources();
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

  // SSL Actions — unified: idempotent ensure (generate if missing, renew if present) with real-time progress.
  const [certProgress, setCertProgress] = useState<{
    requestId: string;
    domain: string;
    command: string;
    status: 'running' | 'completed' | 'failed';
    outputLines: string[];
    error?: string;
  } | null>(null);

  const certPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (certPollRef.current) clearInterval(certPollRef.current); };
  }, []);

  const startCertProgress = async (domain: string) => {
    if (certProgress) return;
    setCertProgress({ requestId: '', domain, command: '', status: 'running', outputLines: [] });
    try {
      const res = await api.serverManagerV1.ensureCertificate({ domain });
      if (res.success && res.data?.request_id) {
        setCertProgress(p => p ? {
          ...p,
          requestId: res.data.request_id,
          command: res.data.command || '',
          outputLines: [`[certbot] ${res.data.command || 'certbot ensure'}`],
        } : null);
        const id = res.data.request_id as string;
        certPollRef.current = setInterval(async () => {
          try {
            const pr = await api.serverManagerV1.certificateProgress(id);
            if (!pr.success) return;
            const d = pr.data || {};
            setCertProgress(prev => {
              if (!prev || prev.requestId !== id) return prev;
              const lines = Array.isArray(d.output_lines) ? d.output_lines : [];
              const next: typeof prev = { ...prev, outputLines: lines, status: d.status === 'completed' ? 'completed' : prev.status };
              if (d.status === 'completed') {
                // Check for error indicators in the output
                const hasError = lines.some((l: string) => l.toLowerCase().includes('error') || l.toLowerCase().includes('fail'));
                if (hasError) {
                  next.status = 'failed';
                  next.error = lines[lines.length - 1] || 'Certificate operation had errors';
                }
              }
              return next;
            });
            if (d.status === 'completed') {
              if (certPollRef.current) { clearInterval(certPollRef.current); certPollRef.current = null; }
              loadSSLCertificates();
              loadNginxSites();
              setShowGenerateCert(false);
            }
          } catch {
            // Polling error - keep trying.
          }
        }, 1500);
      } else {
        setCertProgress(p => p ? { ...p, status: 'failed', error: res.error || 'Failed to start certificate operation' } : null);
      }
    } catch (error: any) {
      setCertProgress(p => p ? { ...p, status: 'failed', error: error.message || 'Failed to start certificate operation' } : null);
    }
  };

  const handleGenerateCertificate = async (domain: string, provider?: string, staging?: boolean) => {
    void startCertProgress(domain);
  };

  const handleRenewAllCertificates = async () => {
    if (!confirm(messages.confirm_renew_certs || 'Are you sure you want to renew all certificates?')) return;
    try {
      const response = await api.serverManagerV1.renewCertificates();
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

  const handleDeleteFilesSite = (siteName: string) => {
    setDeleteFilesPassword('');
    setDeleteFilesConfirm('');
    setDeleteFilesSite(siteName);
  };

  const confirmDeleteFiles = async () => {
    if (!deleteFilesSite) return;
    if (deleteFilesConfirm !== 'delete') {
      toast.error('Type "delete" to confirm');
      return;
    }
    if (!deleteFilesPassword) {
      toast.error('Root password is required');
      return;
    }
    const siteName = deleteFilesSite;
    logInfo('nginx', `Purging site files ${siteName}…`);
    try {
      const response = await api.serverManagerV1.deleteNginxSiteFiles(siteName, {
        password: deleteFilesPassword,
        confirm: deleteFilesConfirm,
      });
      if (response.success) {
        await loadNginxSites();
        loadNginxStatus();
        toast.success(response.data?.message || 'Site files deleted successfully');
        logSuccess('nginx', `Site files ${siteName} purged`);
        setDeleteFilesSite(null);
        setDeleteFilesPassword('');
        setDeleteFilesConfirm('');
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`${messages.operation_failed || 'Operation failed'} - ${error.message}`);
      logError('nginx', `Purge site files ${siteName} failed - ${error.message}`);
    }
  };

  const handleRepairConfig = async () => {
    logInfo('nginx', 'Repairing nginx config…');
    try {
      const response = await api.serverManagerV1.repairNginxConfig();
      if (response.success) {
        const r = response.data || {};
        const quarantined = Array.isArray(r.quarantined) ? r.quarantined.length : 0;
        toast.success(
          r.valid
            ? `Nginx config repaired${r.reloaded ? ' & reloaded' : ''}${quarantined ? ` (${quarantined} site(s) quarantined)` : ''}`
            : 'Config still invalid after repair'
        );
        await loadNginxSites();
        loadNginxStatus();
        logSuccess('nginx', 'Nginx config repaired');
      } else {
        throw new Error(response.error || messages.operation_failed || 'Operation failed');
      }
    } catch (error: any) {
      toast.error(`${messages.operation_failed || 'Operation failed'} - ${error.message}`);
      logError('nginx', `Repair config failed - ${error.message}`);
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
    <CenteredPage className="h-full flex flex-col p-6 overflow-hidden">
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
                loadStaticResources();
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
      <div className="mb-6">
        <CenteredTabBar
          items={tabs.map((tab) => ({ id: tab.id, label: tab.label, icon: <tab.icon className="w-4 h-4" /> }))}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as ServerTab)}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'nginx' && (
          <NginxPanel
            lang={lang}
            nginxStatus={nginxStatus}
            nginxMetrics={nginxMetrics}
            nginxSites={nginxSites}
            nginxNotInstalled={nginxNotInstalled}
            installBusy={installBusy}
            serviceBusy={serviceBusy}
            showConfigTestOutput={showConfigTestOutput}
            setShowConfigTestOutput={setShowConfigTestOutput}
            batchMode={batchMode}
            setBatchMode={setBatchMode}
            selectedSiteNames={selectedSiteNames}
            setSelectedSiteNames={setSelectedSiteNames}
            batchBusy={batchBusy}
            renewingCert={renewingCert}
            showNginxLogs={showNginxLogs}
            setShowNginxLogs={setShowNginxLogs}
            nginxLogType={nginxLogType}
            setNginxLogType={setNginxLogType}
            nginxLogLines={nginxLogLines}
            setNginxLogLines={setNginxLogLines}
            nginxLogFollow={nginxLogFollow}
            setNginxLogFollow={setNginxLogFollow}
            nginxLogFilterInput={nginxLogFilterInput}
            setNginxLogFilterInput={setNginxLogFilterInput}
            nginxLogs={nginxLogs}
            nginxLogPreRef={nginxLogPreRef}
            showNginxBackups={showNginxBackups}
            setShowNginxBackups={setShowNginxBackups}
            nginxBackups={nginxBackups}
            onOpenMainConfig={openMainConfig}
            onLoadNginxStatus={loadNginxStatus}
            onLoadNginxMetrics={loadNginxMetrics}
            onInstallNginx={handleInstallNginx}
            onCopyInstallHint={handleCopyInstallHint}
            onNginxService={handleNginxService}
            onRepairConfig={handleRepairConfig}
            onLoadNginxLogs={loadNginxLogs}
            onLoadNginxBackups={loadNginxBackups}
            onRestoreBackup={handleRestoreBackup}
            onBatchAction={handleBatchAction}
            onToggleSiteSelected={toggleSiteSelected}
            onShowCreateSite={() => setShowCreateSite(true)}
            onRenewSiteCert={handleRenewSiteCert}
            onEnableSite={handleEnableSite}
            onDisableSite={handleDisableSite}
            onEditSite={handleEditSite}
            onViewConfig={handleViewConfig}
            onDeleteSite={handleDeleteSite}
            onDeleteFilesSite={handleDeleteFilesSite}
          />
        )}

        {activeTab === 'ssl' && (
          <SslPanel
            lang={lang}
            certbotStatus={certbotStatus}
            sslCertificates={sslCertificates}
            onInstallCertbot={handleInstallCertbot}
            onShowGenerateCert={() => setShowGenerateCert(true)}
            getStatusIcon={getStatusIcon}
          />
        )}

        {activeTab === 'system' && (
          <SystemPanel
            lang={lang}
            systemInfo={systemInfo}
            servicesSummary={servicesSummary}
            systemServices={systemServices}
            systemStorage={systemStorage}
            systemProcesses={systemProcesses}
            staticResources={staticResources}
            onRefreshStaticResources={() => {
              loadStaticResources();
              loadSystemStorage();
            }}
            onOpenMedia={() => setActiveView(ViewType.MEDIA_BROWSER)}
          />
        )}

        {activeTab === 'files' && (
          <ServerFileManagerPanel lang={lang} />
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

      {/* Certificate Progress (floating real-time output) */}
      {certProgress && (
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
          <div className="relative bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className={`w-5 h-5 ${certProgress.status === 'completed' ? 'text-green-500' : certProgress.status === 'failed' ? 'text-red-500' : 'text-amber-500 animate-pulse'}`} />
                {certProgress.status === 'running' ? `Working on ${certProgress.domain}…` : certProgress.status === 'completed' ? `Done: ${certProgress.domain}` : `Failed: ${certProgress.domain}`}
              </h3>
              <button
                onClick={() => {
                  if (certPollRef.current) { clearInterval(certPollRef.current); certPollRef.current = null; }
                  setCertProgress(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {certProgress.command && (
                <div className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded text-amber-700 dark:text-amber-400 break-all">
                  $ {certProgress.command}
                </div>
              )}
              <div className="text-xs font-mono bg-slate-900 text-green-400 p-3 rounded max-h-96 overflow-y-auto whitespace-pre-wrap">
                {certProgress.status === 'running' && certProgress.outputLines.length === 1
                  ? certProgress.outputLines[0]
                  : certProgress.outputLines.join('\n') || (certProgress.status === 'running' ? 'Waiting for certbot…' : '')}
                {certProgress.status === 'running' && <span className="animate-pulse">▊</span>}
              </div>
              {certProgress.error && (
                <div className="text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 rounded text-red-700 dark:text-red-300">
                  {certProgress.error}
                </div>
              )}
            </div>
            {certProgress.status !== 'running' && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0 flex justify-end">
                <button
                  onClick={() => {
                    if (certPollRef.current) { clearInterval(certPollRef.current); certPollRef.current = null; }
                    setCertProgress(null);
                    loadSSLCertificates();
                    loadNginxSites();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
        </Portal>
      )}

      {/* Generate Certificate Modal */}
      <GenerateCertModal
        isOpen={showGenerateCert}
        lang={lang}
        onClose={() => setShowGenerateCert(false)}
        onGenerate={(domain, provider, staging) => handleGenerateCertificate(domain, provider, staging)}
      />

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
                <LoadingBlock />
              )}
              {siteConfig.error && (
                <AlertBox variant="error">
                  {t.nginx.config_load_failed} — {siteConfig.error}
                </AlertBox>
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
          <LoadingBlock />
        )}
        {mainConfig.error && (
          <AlertBox variant="error">{mainConfig.error}</AlertBox>
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
                  {mainConfig.data.conf_d.map((f, idx) => (
                    <span
                      key={f.file ?? `conf-d-${idx}`}
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

      {/* Delete Files (purge web root + config) */}
      <Modal
        isOpen={deleteFilesSite !== null}
        onClose={() => {
          setDeleteFilesSite(null);
          setDeleteFilesPassword('');
          setDeleteFilesConfirm('');
        }}
        title={`Delete Files: ${deleteFilesSite ?? ''}`}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setDeleteFilesSite(null);
                setDeleteFilesPassword('');
                setDeleteFilesConfirm('');
              }}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteFiles}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Delete Files
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300">
            This permanently deletes the site's <strong>web-root files</strong> AND its nginx config.
            The <strong>core_node</strong> directory is never deletable (server-enforced). This cannot be undone.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Root password
            </label>
            <input
              type="password"
              value={deleteFilesPassword}
              onChange={(e) => setDeleteFilesPassword(e.target.value)}
              placeholder="root password"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Type "delete" to confirm
            </label>
            <input
              type="text"
              value={deleteFilesConfirm}
              onChange={(e) => setDeleteFilesConfirm(e.target.value)}
              placeholder="delete"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </Modal>

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
    </CenteredPage>
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
        <LoadingBlock />
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
  const [selectedApp, setSelectedApp] = useState<{ name: string; type: string } | null>(null);
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
      const response = await api.serverManagerV1.listApps();
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

  const handleDeploy = async (app: UnifiedApp, action: 'deploy' | 'start' | 'stop' | 'restart') => {
    try {
      const response = await api.serverManagerV1.deployApp({ app_name: app.app_name, action });
      if (response.success) {
        const actionMsg = (messages.action_completed || 'Action {action} completed').replace('{action}', action);
        alert(actionMsg);
        if (selectedApp?.name === app.app_name && selectedApp?.type === app.type) {
          loadAppStatus(app);
        }
      }
    } catch (error: any) {
      alert(error.message || messages.operation_failed || 'Operation failed');
    }
  };

  const loadAppStatus = async (app: UnifiedApp) => {
    if (!app.type) {
      setAppStatus({
        data: null,
        loading: false,
        error: 'Missing app type — reload the app list',
        status: 'error'
      });
      return;
    }

    setAppStatus(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getAppStatus(app.app_name, app.type);
      if (response.success && response.data) {
        setAppStatus({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        setSelectedApp({ name: app.app_name, type: app.type });
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
        <LoadingBlock />
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
                    onClick={() => handleDeploy(app, 'deploy')}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
                  >
                    {t.deploy}
                  </button>
                  <button
                    onClick={() => handleDeploy(app, 'start')}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  >
                    {t.start}
                  </button>
                  <button
                    onClick={() => handleDeploy(app, 'stop')}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  >
                    {t.stop}
                  </button>
                  <button
                    onClick={() => handleDeploy(app, 'restart')}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
                  >
                    {t.restart}
                  </button>
                  <button
                    onClick={() => loadAppStatus(app)}
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
                        <StatusBadge
                          status={app.service_status.installed ? app.service_status.status : 'Not Installed'}
                          tone={
                            app.service_status.status === 'running' ? 'success' :
                            app.service_status.status === 'failed' ? 'error' : 'idle'
                          }
                          withDot={false}
                        />
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
                        <StatusBadge
                          status={app.nginx_proxy.enabled ? 'Enabled' : app.nginx_proxy.configured ? 'Configured' : 'Not Configured'}
                          tone={app.nginx_proxy.enabled ? 'info' : app.nginx_proxy.configured ? 'warning' : 'idle'}
                          withDot={false}
                        />
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
          <h3 className="font-semibold mb-3">{selectedApp.name} ({selectedApp.type}) - {t.status}</h3>
          <div className="space-y-2 text-sm">
            {appStatus.data.service_name && (
              <div>
                <span className="text-slate-500">Service:</span>
                <span className="ml-2 font-mono">{appStatus.data.service_name}</span>
              </div>
            )}
            {appStatus.data.service_status && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Status:</span>
                  <StatusBadge
                    status={appStatus.data.service_status.installed ? appStatus.data.service_status.status : 'Not Installed'}
                    tone={
                      appStatus.data.service_status.status === 'running' ? 'success' :
                      appStatus.data.service_status.status === 'failed' ? 'error' : 'idle'
                    }
                    withDot={false}
                  />
                </div>
                {appStatus.data.service_status.pid && (
                  <div>
                    <span className="text-slate-500">PID:</span>
                    <span className="ml-2">{appStatus.data.service_status.pid}</span>
                    {appStatus.data.service_status.uptime && (
                      <span className="ml-2 text-slate-400">• {appStatus.data.service_status.uptime}</span>
                    )}
                  </div>
                )}
                {appStatus.data.service_status.launcher_exists && appStatus.data.service_status.launcher_path && (
                  <div>
                    <span className="text-slate-500">Launcher:</span>
                    <span className="ml-2 font-mono text-xs">{appStatus.data.service_status.launcher_path}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerManager;
