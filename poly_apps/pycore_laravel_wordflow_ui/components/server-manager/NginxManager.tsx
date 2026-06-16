'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/core/api';
import { DataTable, Modal, ConfirmModal, type DataTableColumn } from '@/components/admin';
import { useToast } from '@/components/admin';
import { useTranslation } from '@/core/i18n';
import {
  Network,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  FileCode
} from 'lucide-react';

/**
 * Nginx Site Manager
 *
 * Manage Nginx virtual hosts/sites:
 * - List all sites
 * - Create new site
 * - Edit site configuration
 * - Enable/Disable sites
 * - Delete sites
 * - Test and reload Nginx
 */
export function NginxManager() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<any>(null);
  const [configContent, setConfigContent] = useState('');
  const [processing, setProcessing] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    root: '',
    port: 80,
    ssl: false,
    phpEnabled: false
  });

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    setLoading(true);
    try {
      const res = await api.serverManagerV1.listNginxSites();
      if (res.success) {
        setSites(res.data);
      }
    } catch (error: any) {
      toast.error(error.message || t('messages.networkError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name || !formData.domain || !formData.root) {
      toast.warning('Please fill all required fields');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.serverManagerV1.createNginxSite(formData);
      if (res.success) {
        toast.success('Site created successfully');
        setShowCreateModal(false);
        resetForm();
        loadSites();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create site');
    } finally {
      setProcessing(false);
    }
  }

  async function handleEdit() {
    if (!selectedSite) return;

    setProcessing(true);
    try {
      const res = await api.serverManagerV1.updateNginxSite(selectedSite.name, formData);
      if (res.success) {
        toast.success('Site updated successfully');
        setShowEditModal(false);
        setSelectedSite(null);
        resetForm();
        loadSites();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update site');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!selectedSite) return;

    setProcessing(true);
    try {
      const res = await api.serverManagerV1.deleteNginxSite(selectedSite.name);
      if (res.success) {
        toast.success('Site deleted successfully');
        setShowDeleteModal(false);
        setSelectedSite(null);
        loadSites();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete site');
    } finally {
      setProcessing(false);
    }
  }

  async function handleToggleStatus(site: any) {
    setProcessing(true);
    try {
      const res = site.enabled
        ? await api.serverManagerV1.disableNginxSite(site.name)
        : await api.serverManagerV1.enableNginxSite(site.name);

      if (res.success) {
        toast.success(`Site ${site.enabled ? 'disabled' : 'enabled'} successfully`);
        loadSites();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle site status');
    } finally {
      setProcessing(false);
    }
  }

  async function handleViewConfig(site: any) {
    setProcessing(true);
    try {
      const res = await api.serverManagerV1.getNginxSiteConfig(site.name);
      if (res.success) {
        setConfigContent(res.data.config || '');
        setSelectedSite(site);
        setShowConfigModal(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load configuration');
    } finally {
      setProcessing(false);
    }
  }

  async function handleTestConfig() {
    setProcessing(true);
    try {
      const res = await api.serverManagerV1.testNginxConfig();
      if (res.success) {
        toast.success('Configuration test passed!', 'All syntax is correct');
      } else {
        toast.error('Configuration test failed', res.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to test configuration');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReload() {
    setProcessing(true);
    try {
      const res = await api.serverManagerV1.reloadNginx();
      if (res.success) {
        toast.success('Nginx reloaded successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to reload Nginx');
    } finally {
      setProcessing(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      domain: '',
      root: '',
      port: 80,
      ssl: false,
      phpEnabled: false
    });
  }

  function openEditModal(site: any) {
    setSelectedSite(site);
    setFormData({
      name: site.name,
      domain: site.domain,
      root: site.root,
      port: site.port || 80,
      ssl: site.ssl || false,
      phpEnabled: site.phpEnabled || false
    });
    setShowEditModal(true);
  }

  const columns: DataTableColumn[] = [
    {
      key: 'name',
      title: 'Site Name',
      sortable: true
    },
    {
      key: 'domain',
      title: 'Domain',
      sortable: true
    },
    {
      key: 'enabled',
      title: 'Status',
      width: '120px',
      render: (value) => (
        <span className={`flex items-center gap-1 ${value ? 'text-green-600' : 'text-gray-400'}`}>
          {value ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {value ? 'Enabled' : 'Disabled'}
        </span>
      )
    },
    {
      key: 'ssl',
      title: 'SSL',
      width: '80px',
      render: (value) => (
        <span className={value ? 'text-green-600' : 'text-gray-400'}>
          {value ? 'Yes' : 'No'}
        </span>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      width: '200px',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStatus(row);
            }}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title={row.enabled ? 'Disable' : 'Enable'}
          >
            {row.enabled ? (
              <PowerOff className="w-4 h-4 text-gray-600" />
            ) : (
              <Power className="w-4 h-4 text-green-600" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewConfig(row);
            }}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="View Config"
          >
            <FileCode className="w-4 h-4 text-blue-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(row);
            }}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-orange-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSite(row);
              setShowDeleteModal(true);
            }}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="w-7 h-7" />
            {t('serverManager.nginxManager')}
          </h1>
          <p className="text-gray-600 mt-1">
            Manage Nginx virtual hosts and configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConfig}
            disabled={processing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Test Config
          </button>
          <button
            onClick={handleReload}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            Reload Nginx
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Site
          </button>
        </div>
      </div>

      {/* Sites Table */}
      <DataTable
        columns={columns}
        data={sites}
        loading={loading}
        search={{
          value: '',
          placeholder: 'Search sites...',
          onSearch: () => {}
        }}
        actions={{
          onRefresh: loadSites
        }}
        emptyMessage="No Nginx sites found"
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create New Site"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Creating...' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="my-site"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain *
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="example.com"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Root *
            </label>
            <input
              type="text"
              value={formData.root}
              onChange={(e) => setFormData({ ...formData, root: e.target.value })}
              placeholder="/var/www/html"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Port
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.ssl}
                onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Enable SSL</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.phpEnabled}
                onChange={(e) => setFormData({ ...formData, phpEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Enable PHP</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedSite(null);
          resetForm();
        }}
        title="Edit Site"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedSite(null);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleEdit}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        {/* Same form fields as Create Modal */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain *
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Root *
            </label>
            <input
              type="text"
              value={formData.root}
              onChange={(e) => setFormData({ ...formData, root: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.ssl}
                onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Enable SSL</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.phpEnabled}
                onChange={(e) => setFormData({ ...formData, phpEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Enable PHP</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Config View Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setSelectedSite(null);
        }}
        title={`Configuration: ${selectedSite?.name}`}
        size="xl"
      >
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
          {configContent}
        </pre>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedSite(null);
        }}
        onConfirm={handleDelete}
        title="Delete Site"
        message={`Are you sure you want to delete "${selectedSite?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={processing}
      />
    </div>
  );
}
