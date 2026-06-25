'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/core/api';
import { DataTable, Modal, StatsCard, StatsGrid, type DataTableColumn } from '@/components/admin';
import { useToast } from '@/components/admin';
import { useTranslation } from '@/core/i18n';
import { StatusBadge, AlertBox, Field } from '@/components/common';
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
        // Backend wraps the list as { certificates: [...], total_certificates }.
        // Each parsed cert exposes name/domains/expiry_date/certificate_path.
        const list = Array.isArray(certsRes.data?.certificates) ? certsRes.data.certificates : [];
        setCertificates(list.map((cert: any) => {
          const expiresAt = cert.expiry_date || cert.expires_at || null;
          const days = expiresAt ? getDaysUntilExpiry(expiresAt) : null;
          let status = 'unknown';
          if (days !== null) {
            status = days < 0 ? 'expired' : days < 30 ? 'expiring' : 'valid';
          }
          return {
            domain: cert.name || (Array.isArray(cert.domains) ? cert.domains[0] : cert.domain) || '-',
            domains: cert.domains || [],
            issuer: cert.issuer || "Let's Encrypt",
            expires_at: expiresAt,
            status,
            auto_renew: cert.auto_renew === true
          };
        }));
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

  function getDaysUntilExpiry(expiresAt: string): number | null {
    // certbot dates may carry a suffix ("... (VALID: 89 days)"); keep only the
    // leading ISO-ish portion so Date can parse it. Return null when unparseable.
    const raw = String(expiresAt || '').replace(/\s*\(.*$/, '').trim();
    const expiry = new Date(raw);
    if (isNaN(expiry.getTime())) {
      return null;
    }
    const diff = expiry.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Map cert status to a semantic StatusBadge tone (valid/expiring/expired/unknown).
  function certTone(status: string) {
    switch (status) {
      case 'valid': return 'success' as const;
      case 'expiring': return 'warning' as const;
      case 'expired': return 'error' as const;
      default: return 'idle' as const;
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
        if (!value) {
          return <span className="text-gray-400">-</span>;
        }
        const days = getDaysUntilExpiry(value);
        const raw = String(value).replace(/\s*\(.*$/, '').trim();
        const parsed = new Date(raw);
        const dateLabel = isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString();
        return (
          <span className={days !== null && days < 30 ? 'text-orange-600 font-medium' : ''}>
            {dateLabel}{days !== null ? ` (${days} days)` : ''}
          </span>
        );
      }
    },
    {
      key: 'status',
      title: 'Status',
      width: '120px',
      render: (value) => <StatusBadge status={value} tone={certTone(value)} />
    },
    {
      key: 'auto_renew',
      title: 'Auto Renew',
      width: '100px',
      render: (value) => (
        <StatusBadge status={value ? 'Yes' : 'No'} tone={value ? 'success' : 'idle'} withDot={false} />
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
        <AlertBox variant="warning">
          <h3 className="font-semibold">Certbot Not Installed</h3>
          <p className="mt-1">
            Certbot is required to generate and manage SSL certificates. Install it to continue.
          </p>
          <button
            onClick={handleInstallCertbot}
            disabled={processing}
            className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            {processing ? 'Installing...' : 'Install Certbot'}
          </button>
        </AlertBox>
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
          <Field label="Domain" required hint="Domain name (wildcard certificates supported with DNS challenge)">
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="example.com or *.example.com"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="DNS Provider" required hint="DNS provider for DNS-01 challenge (supports wildcard certificates)">
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="dnspod">DNSPod (Tencent Cloud)</option>
              <option value="cloudflare">Cloudflare</option>
              <option value="aliyun">Aliyun DNS</option>
            </select>
          </Field>

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

          <AlertBox variant="warning">
            <p>
              <strong>Important:</strong> DNS provider API credentials must be configured on the server first.
            </p>
            <p className="text-xs mt-1">
              Configure via GlobalSecretReader: DNSPOD_EMAILS and DNS_DNSPOD_API_TOKENS
            </p>
          </AlertBox>

          <AlertBox variant="info">
            <p>
              <strong>Note:</strong> DNS challenge method is used. Make sure your DNS provider API is properly configured before generating certificates.
            </p>
          </AlertBox>
        </div>
      </Modal>
    </div>
  );
}
