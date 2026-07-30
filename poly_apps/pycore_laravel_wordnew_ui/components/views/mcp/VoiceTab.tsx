import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2, Play, Pause, SkipBack, SkipForward, Clock, Calendar, Upload, X,
  Plus, RefreshCw, Trash2, Check, XCircle, Edit2
} from 'lucide-react';
import { Language, AsyncState, VoiceQueueItem } from '../../../types';
import { api } from '../../../core/api';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, AlertBox, EmptyState, StatusBadge } from '../../common';

/**
 * MCP Voice Subtitle tab — self-contained: queue stats, add text/url/voice/image
 * to queue, transport (prev/play-pause/next) with a hidden <audio>, queue list
 * with batch select/delete + per-item group editing, and background tasks.
 * Extracted from MCPManager (owns its own state/effects/handlers).
 */
const VoiceTab: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].mcp;

  const [voiceQueue, setVoiceQueue] = useState<AsyncState<VoiceQueueItem[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [currentVoiceTrack, setCurrentVoiceTrack] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [newVoiceContent, setNewVoiceContent] = useState('');
  const [newVoiceType, setNewVoiceType] = useState<'text' | 'url' | 'voice' | 'image'>('text');
  const [newVoiceLanguage, setNewVoiceLanguage] = useState('en');
  const [newVoiceImageFile, setNewVoiceImageFile] = useState<File | null>(null);
  const [newVoiceImageDescription, setNewVoiceImageDescription] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [voiceCategories, setVoiceCategories] = useState<AsyncState<any[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedVoiceCategory, setSelectedVoiceCategory] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceStats, setVoiceStats] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [voiceQueueFilter, setVoiceQueueFilter] = useState<'all' | 'today' | 'latest'>('all');
  const [voiceGroups, setVoiceGroups] = useState<AsyncState<string[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedVoiceGroup, setSelectedVoiceGroup] = useState<string | null>(null);
  const [selectedVoiceItems, setSelectedVoiceItems] = useState<Set<string>>(new Set());
  const [editingGroupItemId, setEditingGroupItemId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [voiceBackgroundTasks, setVoiceBackgroundTasks] = useState<AsyncState<any[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });

  useEffect(() => {
    loadVoiceQueue();
    loadCurrentVoiceTrack();
    loadVoiceStats();
    loadVoiceGroups();
    loadSupportedLanguages();
    loadVoiceCategories();
    loadVoiceBackgroundTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Voice queue filter effect
  useEffect(() => {
    loadVoiceQueue();
  }, [voiceQueueFilter, selectedVoiceGroup, selectedVoiceCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadVoiceQueue = async () => {
    setVoiceQueue(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      let response;

      // Apply filters (priority: group > category > filter > all)
      if (selectedVoiceGroup) {
        response = await api.mcpV1.vsGetQueueByGroup(selectedVoiceGroup);
      } else if (selectedVoiceCategory) {
        response = await api.mcpV1.vsGetQueueByCategory(selectedVoiceCategory);
      } else if (voiceQueueFilter === 'today') {
        response = await api.mcpV1.vsGetQueueToday();
      } else if (voiceQueueFilter === 'latest') {
        response = await api.mcpV1.vsGetQueueLatest();
      } else {
        response = await api.mcpV1.vsGetQueue();
      }

      if (response.success && response.data) {
        // Ensure data is an array - handle multiple response formats
        const voiceQueueData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).queue || (response.data as any).items || []);

        setVoiceQueue({
          data: voiceQueueData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.voice.load_queue_failed);
      }
    } catch (error: any) {
      console.error('Failed to load voice queue:', error);
      setVoiceQueue({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadCurrentVoiceTrack = async () => {
    try {
      const response = await api.mcpV1.vsGetCurrent();
      if (response.success && response.data) {
        setCurrentVoiceTrack({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error) {
      // Ignore if no current track
    }
  };

  const loadVoiceStats = async () => {
    setVoiceStats(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.vsGetStats();
      if (response.success && response.data) {
        setVoiceStats({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.voice.stats_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load voice stats:', error);
      setVoiceStats({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadVoiceGroups = async () => {
    setVoiceGroups(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.vsGetAllGroups();
      if (response.success && response.data) {
        const groupsData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).groups || []);

        setVoiceGroups({
          data: groupsData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.voice.groups_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load voice groups:', error);
      setVoiceGroups({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadSupportedLanguages = async () => {
    setSupportedLanguages(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.vsGetSupportedLanguages();
      if (response.success && response.data) {
        setSupportedLanguages({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.voice.languages_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load supported languages:', error);
      setSupportedLanguages({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadVoiceCategories = async () => {
    setVoiceCategories(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.vsGetCategories();
      if (response.success && response.data) {
        const categoriesData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).categories || []);

        setVoiceCategories({
          data: categoriesData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.voice.categories_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load voice categories:', error);
      setVoiceCategories({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleRemoveVoiceItem = async (id: string) => {
    try {
      const response = await api.mcpV1.vsRemoveItem(id);
      if (response.success) {
        loadVoiceQueue();
        loadVoiceStats();
      }
    } catch (error) {
      console.error('Failed to remove voice item:', error);
    }
  };

  const handlePlayVoiceItem = async (index: number) => {
    try {
      const response = await api.mcpV1.vsSetIndex(index);
      if (response.success) {
        loadCurrentVoiceTrack();
        // Increment play count for the selected item
        if (voiceQueue.data && voiceQueue.data[index]) {
          await api.mcpV1.vsIncrementPlayCount(voiceQueue.data[index].id);
          loadVoiceQueue(); // Refresh to show updated play count
        }
      }
    } catch (error) {
      console.error('Failed to play voice item:', error);
    }
  };

  const handleVoicePrevious = async () => {
    try {
      const response = await api.mcpV1.vsPrevious();
      loadCurrentVoiceTrack();
      loadVoiceQueue();
      // Increment play count if response contains item info
      if (response.success && response.data?.queue_item?.id) {
        await api.mcpV1.vsIncrementPlayCount(response.data.queue_item.id);
      }
    } catch (error) {
      console.error('Failed to play previous:', error);
    }
  };

  const handleVoiceNext = async () => {
    try {
      const response = await api.mcpV1.vsNext();
      loadCurrentVoiceTrack();
      loadVoiceQueue();
      // Increment play count if response contains item info
      if (response.success && response.data?.queue_item?.id) {
        await api.mcpV1.vsIncrementPlayCount(response.data.queue_item.id);
      }
    } catch (error) {
      console.error('Failed to play next:', error);
    }
  };

  const toggleVoiceItemSelection = (id: string) => {
    setSelectedVoiceItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleBatchDeleteVoiceItems = async () => {
    if (selectedVoiceItems.size === 0) return;

    if (!confirm(`${t.voice.delete_selected_confirm_prefix} ${selectedVoiceItems.size} ${t.voice.delete_selected_confirm_suffix}`)) return;

    try {
      const ids = Array.from(selectedVoiceItems) as string[];
      const response = await api.mcpV1.vsRemoveItems(ids);
      if (response.success) {
        setSelectedVoiceItems(new Set());
        loadVoiceQueue();
        loadVoiceStats();
      }
    } catch (error) {
      console.error('Failed to batch delete voice items:', error);
    }
  };

  const handleClearVoiceQueue = async () => {
    if (!confirm(t.voice.clear_queue_confirm)) return;

    try {
      const response = await api.mcpV1.vsClearQueue();
      if (response.success) {
        setSelectedVoiceItems(new Set());
        loadVoiceQueue();
        loadVoiceStats();
      }
    } catch (error) {
      console.error('Failed to clear voice queue:', error);
    }
  };

  const handleUpdateVoiceItemGroup = async (id: string, group: string) => {
    try {
      const response = await api.mcpV1.vsUpdateItemGroup({ id, group });
      if (response.success) {
        setEditingGroupItemId(null);
        setNewGroupName('');
        loadVoiceQueue();
        loadVoiceGroups();
      }
    } catch (error) {
      console.error('Failed to update voice item group:', error);
    }
  };

  const handleAddToVoiceQueue = async () => {
    try {
      let response;

      if (newVoiceType === 'image') {
        // Handle image upload
        if (!newVoiceImageFile) return;
        response = await api.mcpV1.vsAddImage({
          image: newVoiceImageFile,
          description: newVoiceImageDescription,
          group: ''
        });
        if (response.success) {
          setNewVoiceImageFile(null);
          setNewVoiceImageDescription('');
        }
      } else {
        // Handle text/url/voice
        if (!newVoiceContent.trim()) return;
        const request = {
          type: newVoiceType,
          content: newVoiceContent,
          language: newVoiceLanguage,
          auto_play: false
        };
        response = await api.mcpV1.vsAddToQueue(request);
        if (response.success) {
          setNewVoiceContent('');
        }
      }

      if (response.success) {
        loadVoiceQueue();
        loadVoiceStats();
      }
    } catch (error) {
      console.error('Failed to add to voice queue:', error);
    }
  };

  const loadVoiceBackgroundTasks = async () => {
    setVoiceBackgroundTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.vsListTasks();
      if (response.success && response.data) {
        const tasksData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).tasks || []);

        setVoiceBackgroundTasks({
          data: tasksData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.voice.tasks_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load voice background tasks:', error);
      setVoiceBackgroundTasks({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleDeleteVoiceBackgroundTasks = async (taskIds: string[]) => {
    if (!confirm(`${t.voice.delete_tasks_confirm_prefix} ${taskIds.length} ${t.voice.delete_tasks_confirm_suffix}`)) {
      return;
    }

    try {
      const response = await api.mcpV1.vsDeleteTasks(taskIds);
      if (response.success) {
        loadVoiceBackgroundTasks();
      }
    } catch (error) {
      console.error('Failed to delete voice background tasks:', error);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Statistics */}
      {voiceStats.data && (
        <div className="grid grid-cols-4 gap-4">
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.voice.stats_total}</span>
            </div>
            <p className="text-2xl font-bold">{voiceStats.data.total_count || 0}</p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Play className="w-4 h-4 text-green-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.completed}</span>
            </div>
            <p className="text-2xl font-bold">{voiceStats.data.completed_count || 0}</p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.pending}</span>
            </div>
            <p className="text-2xl font-bold">{voiceStats.data.pending_count || 0}</p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.today}</span>
            </div>
            <p className="text-2xl font-bold">{voiceStats.data.daily_count || 0}</p>
          </div>
        </div>
      )}

      {/* Add to Queue */}
      <div className={`${commonClasses.card} p-4`}>
        <h3 className="font-semibold mb-4">{t.voice.add_to_queue}</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={newVoiceType}
              onChange={(e) => {
                setNewVoiceType(e.target.value as any);
                setNewVoiceContent('');
                setNewVoiceImageFile(null);
                setNewVoiceImageDescription('');
              }}
              className={commonClasses.input}
            >
              <option value="text">{t.voice.type_text}</option>
              <option value="url">{t.voice.type_url}</option>
              <option value="voice">{t.voice.type_voice}</option>
              <option value="image">{t.voice.type_image}</option>
            </select>
            {newVoiceType !== 'image' && (
              <select
                value={newVoiceLanguage}
                onChange={(e) => setNewVoiceLanguage(e.target.value)}
                className={`${commonClasses.input} w-32`}
                disabled={supportedLanguages.loading}
              >
                {supportedLanguages.loading ? (
                  <option value="en">{t.common.loading}</option>
                ) : supportedLanguages.data ? (
                  <>
                    {Array.isArray(supportedLanguages.data) ? (
                      supportedLanguages.data.map((lang: any) => (
                        <option key={typeof lang === 'string' ? lang : lang.code} value={typeof lang === 'string' ? lang : lang.code}>
                          {typeof lang === 'string' ? lang : (lang.name || lang.code)}
                        </option>
                      ))
                    ) : (
                      <option value="en">en</option>
                    )}
                  </>
                ) : (
                  <>
                    <option value="en">en</option>
                    <option value="zh">zh</option>
                    <option value="ja">ja</option>
                    <option value="ko">ko</option>
                    <option value="es">es</option>
                    <option value="fr">fr</option>
                    <option value="de">de</option>
                  </>
                )}
              </select>
            )}
          </div>

          {newVoiceType === 'image' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className={`${commonClasses.button} ${commonClasses.buttonSecondary} cursor-pointer`}>
                  <Upload className="w-4 h-4 inline mr-2" />
                  {newVoiceImageFile ? newVoiceImageFile.name : t.voice.choose_image}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setNewVoiceImageFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                {newVoiceImageFile && (
                  <button
                    onClick={() => setNewVoiceImageFile(null)}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={newVoiceImageDescription}
                onChange={(e) => setNewVoiceImageDescription(e.target.value)}
                placeholder={t.voice.description_placeholder}
                className={commonClasses.input}
              />
              <button
                onClick={handleAddToVoiceQueue}
                disabled={!newVoiceImageFile}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 w-full`}
              >
                <Plus className="w-4 h-4" />
                {t.voice.add_image_to_queue}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={newVoiceContent}
                onChange={(e) => setNewVoiceContent(e.target.value)}
                placeholder={newVoiceType === 'text' ? t.voice.content_placeholder_text : newVoiceType === 'url' ? t.voice.content_placeholder_url : t.voice.content_placeholder_voice}
                className={`${commonClasses.input} flex-1`}
              />
              <button
                onClick={handleAddToVoiceQueue}
                disabled={!newVoiceContent.trim()}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                {t.common.add}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Current Track */}
      {currentVoiceTrack.data && (
        <div className={`${commonClasses.card} p-4`}>
          <h3 className="font-semibold mb-4">{t.voice.now_playing}</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleVoicePrevious}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (audioRef.current) {
                    if (isPlaying) {
                      audioRef.current.pause();
                    } else {
                      audioRef.current.play();
                    }
                    setIsPlaying(!isPlaying);
                  }
                }}
                className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={handleVoiceNext}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1">
              <p className="font-medium">{currentVoiceTrack.data.queue_item?.content}</p>
              <p className="text-sm text-slate-500">
                {currentVoiceTrack.data.queue_item?.language} • {currentVoiceTrack.data.queue_item?.type}
              </p>
            </div>
            <audio
              ref={audioRef}
              src={currentVoiceTrack.data.queue_item?.audio_url}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className={`flex-1 ${commonClasses.card} p-4 overflow-y-auto`}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{t.voice.queue}</h3>
            <button
              onClick={loadVoiceQueue}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <RefreshCw className="w-4 h-4" />
              {t.common.refresh}
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
              <button
                onClick={() => setVoiceQueueFilter('all')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  voiceQueueFilter === 'all'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {t.common.all}
              </button>
              <button
                onClick={() => setVoiceQueueFilter('today')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  voiceQueueFilter === 'today'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {t.common.today}
              </button>
              <button
                onClick={() => setVoiceQueueFilter('latest')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  voiceQueueFilter === 'latest'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {t.common.latest}
              </button>
            </div>

            {/* Group Filter */}
            {voiceGroups.data && voiceGroups.data.length > 0 && (
              <select
                value={selectedVoiceGroup || ''}
                onChange={(e) => setSelectedVoiceGroup(e.target.value || null)}
                className={`${commonClasses.input} w-48`}
              >
                <option value="">{t.voice.all_groups}</option>
                {voiceGroups.data.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            )}

            {/* Category Filter */}
            {voiceCategories.data && voiceCategories.data.length > 0 && (
              <select
                value={selectedVoiceCategory || ''}
                onChange={(e) => setSelectedVoiceCategory(e.target.value || null)}
                className={`${commonClasses.input} w-48`}
              >
                <option value="">{t.voice.all_categories}</option>
                {voiceCategories.data.map((category: any) => (
                  <option key={typeof category === 'string' ? category : category.id} value={typeof category === 'string' ? category : category.id}>
                    {typeof category === 'string' ? category : (category.name || category.id)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Batch Operations */}
          {voiceQueue.data && voiceQueue.data.length > 0 && (
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  if (selectedVoiceItems.size === voiceQueue.data!.length) {
                    setSelectedVoiceItems(new Set());
                  } else {
                    setSelectedVoiceItems(new Set(voiceQueue.data!.map(item => item.id)));
                  }
                }}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-xs`}
              >
                {selectedVoiceItems.size === voiceQueue.data.length ? t.common.deselect_all : t.common.select_all}
              </button>
              {selectedVoiceItems.size > 0 && (
                <>
                  <button
                    onClick={handleBatchDeleteVoiceItems}
                    className={`${commonClasses.button} text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {t.common.delete} ({selectedVoiceItems.size})
                  </button>
                </>
              )}
              <button
                onClick={handleClearVoiceQueue}
                className={`${commonClasses.button} text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 ml-auto`}
                title={t.voice.clear_queue_title}
              >
                {t.common.clear_all}
              </button>
            </div>
          )}
        </div>
        {voiceQueue.loading && (
          <LoadingBlock label="" className="py-8" />
        )}
        {voiceQueue.data && voiceQueue.data.length > 0 ? (
          <div className="space-y-2">
            {voiceQueue.data.map((item, index) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition-all ${
                  selectedVoiceItems.has(item.id)
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                    : item.status === 'playing'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedVoiceItems.has(item.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleVoiceItemSelection(item.id);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span
                      className={`px-2 py-1 rounded text-xs cursor-pointer ${
                        item.status === 'playing' ? commonClasses.badgeInfo :
                        item.status === 'completed' ? commonClasses.badgeSuccess :
                        item.status === 'error' ? commonClasses.badgeError :
                        commonClasses.badgeWarning
                      }`}
                      onClick={() => handlePlayVoiceItem(index)}
                    >
                      {item.status}
                    </span>
                    <span className="text-sm font-medium cursor-pointer" onClick={() => handlePlayVoiceItem(index)}>{item.type}</span>
                    {editingGroupItemId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder={t.voice.group_name_placeholder}
                          className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 w-24"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              handleUpdateVoiceItemGroup(item.id, newGroupName);
                            } else if (e.key === 'Escape') {
                              e.stopPropagation();
                              setEditingGroupItemId(null);
                              setNewGroupName('');
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateVoiceItemGroup(item.id, newGroupName);
                          }}
                          className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                          title={t.common.save}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroupItemId(null);
                            setNewGroupName('');
                          }}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                          title={t.common.cancel}
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {item.group && (
                          <span className="px-2 py-1 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            {item.group}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroupItemId(item.id);
                            setNewGroupName(item.group || '');
                          }}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                          title={t.voice.edit_group}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveVoiceItem(item.id);
                      }}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1 line-clamp-2">{item.content}</p>
                <p className="text-xs text-slate-500">
                  {item.language} • {new Date(item.created_at).toLocaleString()}
                  {item.play_count > 0 && ` • ${t.voice.played_prefix} ${item.play_count}${t.voice.played_suffix}`}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Volume2} message={t.voice.queue_empty} />
        )}
      </div>

      {/* Background Tasks Panel */}
      <div className={`${commonClasses.card} p-4`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t.voice.background_tasks}</h3>
          <div className="flex gap-2">
            <button
              onClick={loadVoiceBackgroundTasks}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 text-xs`}
            >
              <RefreshCw className="w-3 h-3" />
              {t.common.refresh}
            </button>
          </div>
        </div>

        {voiceBackgroundTasks.loading && (
          <LoadingBlock label="" className="py-8" />
        )}

        {voiceBackgroundTasks.error && (
          <AlertBox variant="error">{voiceBackgroundTasks.error}</AlertBox>
        )}

        {voiceBackgroundTasks.data && voiceBackgroundTasks.data.length > 0 ? (
          <div className="space-y-2">
            {voiceBackgroundTasks.data.map((task: any) => (
              <div
                key={task.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{task.name || task.id}</span>
                      <StatusBadge status={task.status} withDot={false} />
                    </div>
                    {task.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{task.description}</p>
                    )}
                    {task.progress !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{task.progress}%</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {task.created_at && `${t.voice.created_label} ${new Date(task.created_at).toLocaleString()}`}
                      {task.updated_at && ` • ${t.voice.updated_label} ${new Date(task.updated_at).toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteVoiceBackgroundTasks([task.id])}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    title={t.voice.delete_task}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : voiceBackgroundTasks.data && voiceBackgroundTasks.data.length === 0 ? (
          <EmptyState message={t.voice.no_background_tasks} />
        ) : null}
      </div>
    </div>
  );
};

export default VoiceTab;
