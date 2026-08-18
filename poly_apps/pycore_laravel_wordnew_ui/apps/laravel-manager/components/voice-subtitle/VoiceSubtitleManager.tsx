'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/apps/laravel-manager/api';
import { DataTable, Modal, StatsCard, StatsGrid, type DataTableColumn } from '../admin';
import { useToast } from '../admin';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Plus,
  Trash2,
  List,
  FolderOpen,
  Tag
} from 'lucide-react';

/**
 * Voice Subtitle Manager
 *
 * Manage voice subtitle queue:
 * - View queue items
 * - Add text/image/voice to queue
 * - Play/pause/navigate queue
 * - Manage groups and categories
 * - View statistics
 */
export function VoiceSubtitleManager() {
  const [queue, setQueue] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  // Form state
  const [formData, setFormData] = useState({
    text: '',
    language: 'en',
    group: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [queueRes, currentRes, groupsRes, categoriesRes, statsRes] = await Promise.all([
        api.mcpV1.vsGetQueue({ page: 1, limit: 100 }),
        api.mcpV1.vsGetCurrent(),
        api.mcpV1.vsGetAllGroups(),
        api.mcpV1.vsGetCategories(),
        api.mcpV1.vsGetStats()
      ]);

      if (queueRes.success) setQueue(queueRes.data.items || []);
      if (currentRes.success) setCurrent(currentRes.data.item);
      if (groupsRes.success) setGroups(groupsRes.data);
      if (categoriesRes.success) setCategories(categoriesRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error: any) {
      toast.error(error.message || t('messages.networkError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddText() {
    if (!formData.text.trim()) {
      toast.warning('Please enter text');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.mcpV1.vsAddText(formData);
      if (res.success) {
        toast.success('Text added to queue');
        setShowAddModal(false);
        resetForm();
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add text');
    } finally {
      setProcessing(false);
    }
  }

  async function handlePlay() {
    setProcessing(true);
    try {
      const res = await api.mcpV1.vsNext();
      if (res.success) {
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to play');
    } finally {
      setProcessing(false);
    }
  }

  async function handlePrevious() {
    setProcessing(true);
    try {
      const res = await api.mcpV1.vsPrevious();
      if (res.success) {
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to go to previous');
    } finally {
      setProcessing(false);
    }
  }

  async function handleNext() {
    setProcessing(true);
    try {
      const res = await api.mcpV1.vsNext();
      if (res.success) {
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to go to next');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete(id: string) {
    setProcessing(true);
    try {
      const res = await api.mcpV1.vsRemoveItem(id);
      if (res.success) {
        toast.success('Item removed from queue');
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove item');
    } finally {
      setProcessing(false);
    }
  }

  async function handleClearQueue() {
    if (!confirm('Are you sure you want to clear the entire queue?')) return;

    setProcessing(true);
    try {
      const res = await api.mcpV1.vsClearQueue();
      if (res.success) {
        toast.success('Queue cleared');
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear queue');
    } finally {
      setProcessing(false);
    }
  }

  async function handleFilterByGroup(group: string) {
    setSelectedGroup(group);
    setLoading(true);
    try {
      const res = group
        ? await api.mcpV1.vsGetQueueByGroup(group)
        : await api.mcpV1.vsGetQueue({ page: 1, limit: 100 });
      if (res.success) {
        setQueue(res.data.items || res.data || []);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({ text: '', language: 'en', group: '' });
  }

  const columns: DataTableColumn[] = [
    {
      key: 'id',
      title: 'ID',
      width: '80px'
    },
    {
      key: 'type',
      title: 'Type',
      width: '100px',
      render: (value) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
          {value}
        </span>
      )
    },
    {
      key: 'content',
      title: 'Content',
      render: (value) => (
        <span className="line-clamp-2">{value || '-'}</span>
      )
    },
    {
      key: 'group',
      title: 'Group',
      width: '120px',
      render: (value) => value || '-'
    },
    {
      key: 'play_count',
      title: 'Plays',
      width: '80px'
    },
    {
      key: 'actions',
      title: 'Actions',
      width: '80px',
      align: 'right',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(row.id);
          }}
          className="p-2 hover:bg-red-50 rounded transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Music className="w-7 h-7" />
            Voice Subtitle Manager
          </h1>
          <p className="text-gray-600 mt-1">
            Manage voice subtitle queue and playback
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearQueue}
            disabled={processing || queue.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Clear Queue
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Text
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <StatsGrid columns={4} gap="md">
          <StatsCard
            title="Total Items"
            value={stats.total || 0}
            icon={List}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
            loading={loading}
          />

          <StatsCard
            title="Groups"
            value={groups.length}
            icon={FolderOpen}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
            loading={loading}
          />

          <StatsCard
            title="Categories"
            value={categories.length}
            icon={Tag}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
            loading={loading}
          />

          <StatsCard
            title="Total Plays"
            value={stats.total_plays || 0}
            icon={Play}
            iconColor="text-orange-600"
            iconBgColor="bg-orange-100"
            loading={loading}
          />
        </StatsGrid>
      )}

      {/* Current Playing */}
      {current && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Now Playing
              </h3>
              <p className="text-gray-700">{current.content || current.title}</p>
              <p className="text-sm text-gray-600 mt-1">
                Type: {current.type} | Group: {current.group || 'None'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={processing}
                className="p-3 bg-white hover:bg-gray-50 rounded-full shadow disabled:opacity-50"
                title="Previous"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={handlePlay}
                disabled={processing}
                className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow disabled:opacity-50"
                title="Play"
              >
                <Play className="w-6 h-6" />
              </button>

              <button
                onClick={handleNext}
                disabled={processing}
                className="p-3 bg-white hover:bg-gray-50 rounded-full shadow disabled:opacity-50"
                title="Next"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Filter */}
      {groups.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Filter by group:</span>
          <button
            onClick={() => handleFilterByGroup('')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              selectedGroup === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => handleFilterByGroup(group)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                selectedGroup === group
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {group}
            </button>
          ))}
        </div>
      )}

      {/* Queue Table */}
      <DataTable
        columns={columns}
        data={queue}
        loading={loading}
        search={{
          value: '',
          placeholder: 'Search queue...',
          onSearch: () => {}
        }}
        actions={{
          onRefresh: loadData
        }}
        emptyMessage="Queue is empty"
      />

      {/* Add Text Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add Text to Queue"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAddText}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Adding...' : 'Add'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Text *
            </label>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Enter text to add to queue..."
              rows={6}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="zh">Chinese</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group (optional)
            </label>
            <input
              type="text"
              value={formData.group}
              onChange={(e) => setFormData({ ...formData, group: e.target.value })}
              placeholder="Enter group name..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
