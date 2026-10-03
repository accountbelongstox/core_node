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

      if (queueRes.success) setQueue(queueRes.data.queue || queueRes.data.items || []);
      if (currentRes.success) setCurrent(currentRes.data.current ?? currentRes.data.item ?? null);
      if (groupsRes.success) setGroups(groupsRes.data);
      if (categoriesRes.success) setCategories(categoriesRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error: any) {
      toast.error(error.message || t('common.network_error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddText() {
    if (!formData.text.trim()) {
      toast.warning(t('uiAi.voice_subtitle.toast.enter_text'));
      return;
    }

    setProcessing(true);
    try {
      const res = await api.mcpV1.vsAddText(formData);
      const taskId = api.mcpV1.vsAcceptedTaskId(res);
      if (res.success) {
        toast.success(t('uiAi.voice_subtitle.toast.text_added'));
        setShowAddModal(false);
        resetForm();
        loadData();
      }
      // 202: the item joins the queue when its background task settles.
      if (taskId) void api.mcpV1.vsFollowTask(taskId).then(() => loadData());
    } catch (error: any) {
      toast.error(error.message || t('uiAi.voice_subtitle.toast.add_failed'));
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
      toast.error(error.message || t('uiAi.voice_subtitle.toast.play_failed'));
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
      toast.error(error.message || t('uiAi.voice_subtitle.toast.previous_failed'));
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
      toast.error(error.message || t('uiAi.voice_subtitle.toast.next_failed'));
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete(id: string) {
    setProcessing(true);
    try {
      const res = await api.mcpV1.vsRemoveItem(id);
      if (res.success) {
        toast.success(t('uiAi.voice_subtitle.toast.item_removed'));
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || t('uiAi.voice_subtitle.toast.remove_failed'));
    } finally {
      setProcessing(false);
    }
  }

  async function handleClearQueue() {
    if (!confirm(t('uiAi.voice_subtitle.confirm_clear'))) return;

    setProcessing(true);
    try {
      const res = await api.mcpV1.vsClearQueue();
      if (res.success) {
        toast.success(t('uiAi.voice_subtitle.toast.queue_cleared'));
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || t('uiAi.voice_subtitle.toast.clear_failed'));
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
        setQueue(res.data.queue || res.data.items || (Array.isArray(res.data) ? res.data : []));
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
      title: t('uiAi.voice_subtitle.col.id'),
      width: '80px'
    },
    {
      key: 'type',
      title: t('uiAi.voice_subtitle.col.type'),
      width: '100px',
      render: (value) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
          {value}
        </span>
      )
    },
    {
      key: 'content',
      title: t('uiAi.voice_subtitle.col.content'),
      render: (value) => (
        <span className="line-clamp-2">{value || '-'}</span>
      )
    },
    {
      key: 'group',
      title: t('uiAi.voice_subtitle.col.group'),
      width: '120px',
      render: (value) => value || '-'
    },
    {
      key: 'play_count',
      title: t('uiAi.voice_subtitle.col.plays'),
      width: '80px'
    },
    {
      key: 'actions',
      title: t('uiAi.voice_subtitle.col.actions'),
      width: '80px',
      align: 'right',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(row.id);
          }}
          className="p-2 hover:bg-red-50 rounded transition-colors"
          title={t('uiAi.voice_subtitle.delete')}
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
            {t('uiAi.voice_subtitle.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('uiAi.voice_subtitle.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearQueue}
            disabled={processing || queue.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {t('uiAi.voice_subtitle.clear_queue')}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {t('uiAi.voice_subtitle.add_text')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <StatsGrid columns={4} gap="md">
          <StatsCard
            title={t('uiAi.voice_subtitle.stat_total_items')}
            value={stats.total || 0}
            icon={List}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
            loading={loading}
          />

          <StatsCard
            title={t('uiAi.voice_subtitle.stat_groups')}
            value={groups.length}
            icon={FolderOpen}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
            loading={loading}
          />

          <StatsCard
            title={t('uiAi.voice_subtitle.stat_categories')}
            value={categories.length}
            icon={Tag}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
            loading={loading}
          />

          <StatsCard
            title={t('uiAi.voice_subtitle.stat_total_plays')}
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
                {t('uiAi.voice_subtitle.now_playing')}
              </h3>
              <p className="text-gray-700">{current.content || current.title}</p>
              <p className="text-sm text-gray-600 mt-1">
                {t('uiAi.voice_subtitle.current_meta', { type: current.type, group: current.group || t('uiAi.voice_subtitle.none') })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={processing}
                className="p-3 bg-white hover:bg-gray-50 rounded-full shadow disabled:opacity-50"
                title={t('uiAi.voice_subtitle.previous')}
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={handlePlay}
                disabled={processing}
                className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow disabled:opacity-50"
                title={t('uiAi.voice_subtitle.play')}
              >
                <Play className="w-6 h-6" />
              </button>

              <button
                onClick={handleNext}
                disabled={processing}
                className="p-3 bg-white hover:bg-gray-50 rounded-full shadow disabled:opacity-50"
                title={t('uiAi.voice_subtitle.next')}
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
          <span className="text-sm text-gray-600 whitespace-nowrap">{t('uiAi.voice_subtitle.filter_by_group')}</span>
          <button
            onClick={() => handleFilterByGroup('')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              selectedGroup === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t('uiAi.voice_subtitle.all')}
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
          placeholder: t('uiAi.voice_subtitle.search_placeholder'),
          onSearch: () => {}
        }}
        actions={{
          onRefresh: loadData
        }}
        emptyMessage={t('uiAi.voice_subtitle.queue_empty')}
      />

      {/* Add Text Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title={t('uiAi.voice_subtitle.modal.title')}
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
              {processing ? t('uiAi.voice_subtitle.modal.adding') : t('uiAi.voice_subtitle.modal.add')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('uiAi.voice_subtitle.modal.text_label')}
            </label>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder={t('uiAi.voice_subtitle.modal.text_placeholder')}
              rows={6}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('uiAi.voice_subtitle.modal.language_label')}
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">{t('uiAi.voice_subtitle.languages.en')}</option>
              <option value="zh">{t('uiAi.voice_subtitle.languages.zh')}</option>
              <option value="es">{t('uiAi.voice_subtitle.languages.es')}</option>
              <option value="fr">{t('uiAi.voice_subtitle.languages.fr')}</option>
              <option value="de">{t('uiAi.voice_subtitle.languages.de')}</option>
              <option value="ja">{t('uiAi.voice_subtitle.languages.ja')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('uiAi.voice_subtitle.modal.group_label')}
            </label>
            <input
              type="text"
              value={formData.group}
              onChange={(e) => setFormData({ ...formData, group: e.target.value })}
              placeholder={t('uiAi.voice_subtitle.modal.group_placeholder')}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
