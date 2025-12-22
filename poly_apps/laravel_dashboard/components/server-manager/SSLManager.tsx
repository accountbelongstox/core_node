'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/core/api';
import { DataTable, Modal, StatsCard, StatsGrid, type DataTableColumn } from '@/components/admin';
import { useToast } from '@/components/admin';
import { useTranslation } from '@/core/i18n';
import {
  Lock,
  Plus,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

/**
 * SSL Certificate Manager
 *
 * Manage SSL/TLS certificates with Let's Encrypt:
 * - List all certificates
 * - Generate new certificates
 * - Renew expiring certificates
 * - View certificate status
 * - Install Certbot
 */
export function SSLManager() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [certbotInstalled, setCertbotInstalled] = useState(false);
  const [certbotInfo, setCertbotInfo] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  // Form state
  const [formData, setFormData] = useState({
    domain: '',
    provider: 'dnspod',
    staging: false
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [certsRes, certbotRes] = await Promise.all([
        api.serverManagerV1.listCertificates(),
        api.serverManagerV1.detectCertbot()
      ]);

      if (certsRes.success) {
        setCertificates(certsRes.data);
      }
      if (certbotRes.success) {
        setCertbotInfo(certbotRes.data);
        setCertbotInstalled(certbotRes.data.installed);

        // Show warning if nginx not installed
        if (certbotRes.data.skip_reason) {
          toast.warning(certbotRes.data.skip_reason, 'SSL Certificate Setup');
        }
      }
    } catch (error: any) {
      toast.error(error.message || t('messages.networkError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!formData.domain) {
      toast.warning('Please enter a domain name');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.serverManagerV1.generateCertificate({
        domain: formData.domain,
        provider: formData.provider,
        staging: formData.staging
      });
      if (res.success) {
        toast.success('Certificate generated successfully', 'SSL certificate is now active');
        setShowGenerateModal(false);
        resetForm();
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate certificate');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRenewAll() {
    setProcessing(true);
    try {
      const res = await api.serverManagerV1.renewCertificates();
      if (res.success) {
        toast.success('Certificates renewed successfully');
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to renew certificates');
    } finally {
      setProcessing(false);
    }
  }

  async function handleInstallCertbot() {
    setProcessing(true);
    try {
      const res = await api.serverManagerV1.installCertbot();
      if (res.success) {
        toast.success('Certbot installed successfully');
        setCertbotInstalled(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to install Certbot');
    } finally {
      setProcessing(false);
    }
  }

  function resetForm() {
    setFormData({ domain: '', provider: 'dnspod', staging: false });
  }

  function getDaysUntilExpiry(expiresAt: string): number {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'valid': return 'text-green-600';
      case 'expiring': return 'text-yellow-600';
      case 'expired': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'valid': return <CheckCircle className="w-4 h-4" />;
      case 'expiring': return <Clock className="w-4 h-4" />;
      case 'expired': return <AlertTriangle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  }

  const columns: DataTableColumn[] = [
    {
      key: 'domain',
      title: 'Domain',
      sortable: true
    },
    {
      key: 'issuer',
      title: 'Issuer',
      render: (value) => value || 'Let\'s Encrypt'
    },
    {
      key: 'expires_at',
      title: 'Expires',
      sortable: true,
      render: (value) => {
        const days = getDaysUntilExpiry(value);
        return (
          <span className={days < 30 ? 'text-orange-600 font-medium' : ''}>
            {new Date(value).toLocaleDateString()} ({days} days)
          </span>
        );
      }
    },
    {
      key: 'status',
      title: 'Status',
      width: '120px',
      render: (value) => (
        <span className={`flex items-center gap-1 ${getStatusColor(value)}`}>
          {getStatusIcon(value)}
          {value}
        </span>
      )
    },
    {
      key: 'auto_renew',
      title: 'Auto Renew',
      width: '100px',
      render: (value) => (
        <span className={value ? 'text-green-600' : 'text-gray-400'}>
          {value ? 'Yes' : 'No'}
        </span>
      )
    }
  ];

  // Stats
  const totalCerts = certificates.length;
  const validCerts = certificates.filter(c => c.status === 'valid').length;
  const expiringCerts = certificates.filter(c => c.status === 'expiring').length;
  const expiredCerts = certificates.filter(c => c.status === 'expired').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-7 h-7" />
            {t('serverManager.sslManager')}
          </h1>
          <p className="text-gray-600 mt-1">
            Manage SSL/TLS certificates with Let's Encrypt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRenewAll}
            disabled={processing || !certbotInstalled}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            Renew All
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            disabled={!certbotInstalled}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Generate Certificate
          </button>
        </div>
      </div>

      {/* Certbot Warning */}
      {!certbotInstalled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900">Certbot Not Installed</h3>
            <p className="text-sm text-yellow-800 mt-1">
              Certbot is required to generate and manage SSL certificates. Install it to continue.
            </p>
            <button
              onClick={handleInstallCertbot}
              disabled={processing}
              className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              {processing ? 'Installing...' : 'Install Certbot'}
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <StatsGrid columns={4} gap="md">
        <StatsCard
          title="Total Certificates"
          value={totalCerts}
          icon={Shield}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          loading={loading}
        />

        <StatsCard
          title="Valid"
          value={validCerts}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          loading={loading}
        />

        <StatsCard
          title="Expiring Soon"
          value={expiringCerts}
          icon={Clock}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-100"
          subtitle="< 30 days"
          loading={loading}
        />

        <StatsCard
          title="Expired"
          value={expiredCerts}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBgColor="bg-red-100"
          loading={loading}
        />
      </StatsGrid>

      {/* Certificates Table */}
      <DataTable
        columns={columns}
        data={certificates}
        loading={loading}
        search={{
          value: '',
          placeholder: 'Search certificates...',
          onSearch: () => {}
        }}
        actions={{
          onRefresh: loadData
        }}
        emptyMessage="No SSL certificates found"
      />

      {/* Generate Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          resetForm();
        }}
        title="Generate SSL Certificate"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setShowGenerateModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleGenerate}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Generating...' : 'Generate'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain *
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="example.com or *.example.com"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Domain name (wildcard certificates supported with DNS challenge)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DNS Provider *
            </label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="dnspod">DNSPod (Tencent Cloud)</option>
              <option value="cloudflare">Cloudflare</option>
              <option value="aliyun">Aliyun DNS</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              DNS provider for DNS-01 challenge (supports wildcard certificates)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="staging"
              checked={formData.staging}
              onChange={(e) => setFormData({ ...formData, staging: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="staging" className="text-sm font-medium text-gray-700">
              Use Staging Environment (Test Mode)
            </label>
          </div>
          <p className="text-xs text-gray-500 -mt-2 ml-6">
            Test certificate generation without affecting rate limits
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-900">
              <strong>Important:</strong> DNS provider API credentials must be configured on the server first.
            </p>
            <p className="text-xs text-yellow-800 mt-1">
              Configure via GlobalSecretReader: DNS_DNSPOD_EMAILS and DNS_DNSPOD_API_TOKENS
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> DNS challenge method is used. Make sure your DNS provider API is properly configured before generating certificates.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
