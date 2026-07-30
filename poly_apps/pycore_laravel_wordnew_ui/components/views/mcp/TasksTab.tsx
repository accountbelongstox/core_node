import React, { useState, useEffect } from 'react';
import {
  Plus, RefreshCw, HardDrive, Search, X, ListTodo, Edit2, Eye, Trash2
} from 'lucide-react';
import { Language, AsyncState, TaskCategory, DispatchTask } from '../../../types';
import { api } from '../../../core/api';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, AlertBox, EmptyState, Field, StatusBadge } from '../../common';
import { useToast } from '../../admin/Toast';
import Portal from '../../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';

/**
 * MCP Tasks tab — self-contained: task-category sidebar, queue stats, add/search/
 * edit/delete tasks, per-category prompt mapping, and the category-files modal.
 * Extracted from MCPManager (owns its own state/effects/handlers).
 */
const TasksTab: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].mcp;
  const toast = useToast();

  const [categories, setCategories] = useState<AsyncState<TaskCategory[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AsyncState<DispatchTask[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [queueStats, setQueueStats] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskFileName, setNewTaskFileName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState(2);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryFiles, setCategoryFiles] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [viewingFilesForCategory, setViewingFilesForCategory] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [promptMapping, setPromptMapping] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [promptFilePath, setPromptFilePath] = useState('');
  const [promptContent, setPromptContent] = useState('');

  useEffect(() => {
    loadCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedCategory) {
      loadTasks(selectedCategory);
      loadQueueStats(selectedCategory);
      loadPromptMapping(selectedCategory);
    }
  }, [selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Task search effect
  useEffect(() => {
    if (selectedCategory) {
      const timeoutId = setTimeout(() => {
        if (taskSearchQuery.trim()) {
          searchTasksInCategory(selectedCategory, taskSearchQuery);
        } else {
          loadTasks(selectedCategory);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [taskSearchQuery, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCategories = async () => {
    setCategories(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getTaskCategories();
      if (response.success && response.data) {
        // Ensure data is an array - handle multiple response formats
        const categoriesData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).categories || (response.data as any).items || []);

        setCategories({
          data: categoriesData,
          loading: false,
          error: null,
          status: 'success'
        });
        if (categoriesData.length > 0 && !selectedCategory) {
          setSelectedCategory(categoriesData[0].id);
        }
      } else {
        throw new Error(response.error || t.tasks.load_categories_failed);
      }
    } catch (error: any) {
      console.error('Failed to load categories:', error);
      // No fake fallback rows: a phantom "Default Category" hid real backend
      // failures (e.g. the _prompts-path 500) and selecting it created junk
      // queues server-side. Surface the error + a Retry affordance instead.
      setCategories({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadTasks = async (categoryId: string) => {
    setTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getTaskQueue(categoryId);
      if (response.success && response.data) {
        // Ensure data is an array - handle multiple response formats
        const tasksData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).tasks || (response.data as any).items || []);

        setTasks({
          data: tasksData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.tasks.load_tasks_failed);
      }
    } catch (error: any) {
      console.error('Failed to load tasks:', error);
      setTasks({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const searchTasksInCategory = async (categoryId: string, query: string) => {
    setTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.searchTasks(categoryId, query);
      if (response.success && response.data) {
        const tasksData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).tasks || (response.data as any).items || []);

        setTasks({
          data: tasksData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.tasks.search_failed);
      }
    } catch (error: any) {
      console.error('Task search failed:', error);
      setTasks({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const response = await api.mcpV1.createTaskCategory(newCategoryName.trim());
      if (!response.success) {
        throw new Error((response as any).error || (response as any).message || t.tasks.create_category_failed);
      }
      setNewCategoryName('');
      setIsCreatingCategory(false);
      toast.success(t.tasks.category_created);
      loadCategories();
    } catch (error: any) {
      console.error('Failed to create category:', error);
      toast.error(error.message || t.tasks.create_category_failed);
    }
  };

  const loadQueueStats = async (categoryId: string) => {
    setQueueStats(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getQueueStats(categoryId);
      if (response.success && response.data) {
        setQueueStats({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error) {
      // Ignore stats errors
    }
  };

  const handleAddTask = async () => {
    if (!selectedCategory || !newTaskContent.trim()) return;

    try {
      const response = await api.mcpV1.addTask({
        category_id: selectedCategory,
        content: newTaskContent,
        file_name: newTaskFileName || undefined,
        priority: newTaskPriority
      });

      if (response.success) {
        setNewTaskContent('');
        setNewTaskFileName('');
        setNewTaskPriority(2);
        loadTasks(selectedCategory);
        loadQueueStats(selectedCategory);
      }
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const loadCategoryFiles = async (categoryId: string) => {
    setCategoryFiles(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getCategoryFiles(categoryId);
      if (response.success && response.data) {
        setCategoryFiles({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error: any) {
      console.error('Failed to load category files:', error);
      setCategoryFiles({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'pending' | 'in_progress' | 'completed' | 'failed') => {
    if (!selectedCategory) return;

    try {
      const response = await api.mcpV1.updateTaskStatus(selectedCategory, taskId, newStatus);
      if (response.success) {
        setEditingTaskId(null);
        loadTasks(selectedCategory);
        loadQueueStats(selectedCategory);
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedCategory) return;
    if (!confirm(t.tasks.delete_task_confirm)) return;

    try {
      const response = await api.mcpV1.deleteTask(selectedCategory, taskId);
      if (!response.success) {
        throw new Error((response as any).error || t.tasks.delete_task_failed);
      }
      toast.success(t.tasks.task_deleted);
      loadTasks(selectedCategory);
      loadQueueStats(selectedCategory);
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      toast.error(error.message || t.tasks.delete_task_failed);
    }
  };

  const handleViewCategoryFiles = (categoryId: string) => {
    setViewingFilesForCategory(categoryId);
    loadCategoryFiles(categoryId);
  };

  const loadPromptMapping = async (categoryId: string) => {
    setPromptMapping(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getPromptMappings();
      if (response.success && response.data) {
        // Backend (GET /task-dispatch/mappings) returns
        // { mappings: { [categoryId]: {...} }, total }. BaseAPI unwraps the
        // envelope, so response.data is that object — NOT an array. Reading it
        // with .find() threw a TypeError that the catch swallowed, so the panel
        // silently showed nothing. Resolve the per-category entry from whichever
        // shape arrives (keyed object, wrapped object, or a plain array).
        const raw: any = response.data;
        const bag = raw.mappings ?? raw;
        let mapping: any = null;
        if (Array.isArray(bag)) {
          mapping = bag.find((m: any) => m.category_id === categoryId) ?? null;
        } else if (bag && typeof bag === 'object') {
          mapping = bag[categoryId] ?? null;
        }
        if (mapping) {
          setPromptMapping({
            data: mapping,
            loading: false,
            error: null,
            status: 'success'
          });
          setPromptFilePath(mapping.prompt_file_path || '');
          setPromptContent(mapping.prompt_content || '');
        } else {
          setPromptMapping({
            data: null,
            loading: false,
            error: null,
            status: 'success'
          });
        }
      }
    } catch (error) {
      setPromptMapping({
        data: null,
        loading: false,
        error: null,
        status: 'success'
      });
    }
  };

  const handleSavePromptMapping = async () => {
    if (!selectedCategory || !promptFilePath.trim()) return;

    try {
      const response = await api.mcpV1.updatePromptMapping(
        selectedCategory,
        promptFilePath,
        promptContent
      );
      if (response.success) {
        loadPromptMapping(selectedCategory);
      }
    } catch (error) {
      console.error('Failed to save prompt mapping:', error);
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Categories Sidebar */}
      <div className={`w-64 ${commonClasses.card} p-4 overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t.tasks.categories}</h3>
          <button
            onClick={() => setIsCreatingCategory(!isCreatingCategory)}
            className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${
              isCreatingCategory ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : ''
            }`}
            title={t.tasks.create_category}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Create Category Form */}
        {isCreatingCategory && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t.tasks.category_name_placeholder}
              className={`${commonClasses.input} w-full mb-2`}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 text-sm`}
              >
                {t.common.create}
              </button>
              <button
                onClick={() => {
                  setIsCreatingCategory(false);
                  setNewCategoryName('');
                }}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex-1 text-sm`}
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}

        {categories.loading && (
          <LoadingBlock label="" className="py-8" />
        )}
        {!categories.loading && categories.error && (
          <AlertBox variant="error" className="mb-4">
            <p className="text-xs font-medium break-words">{categories.error}</p>
            <button
              onClick={loadCategories}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {t.common.retry}
            </button>
          </AlertBox>
        )}
        {categories.data && categories.data.length > 0 && (
          <div className="space-y-1.5">
            {categories.data.map((category) => (
              <div
                key={category.id}
                className={`group p-3 rounded-xl transition-all ${
                  selectedCategory === category.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/25 ring-1 ring-indigo-300 dark:ring-indigo-700 shadow-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <div
                  className="w-full text-left cursor-pointer flex items-center justify-between gap-2"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className={`font-medium text-sm truncate ${
                    selectedCategory === category.id
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    {category.name}
                  </div>
                  <span className={`${commonClasses.badge} flex-shrink-0 ${
                    selectedCategory === category.id ? commonClasses.badgeInfo : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    {category.file_count}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewCategoryFiles(category.id);
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  title={t.tasks.view_files_title}
                >
                  <HardDrive className="w-3 h-3" />
                  {t.tasks.view_files}
                </button>
              </div>
            ))}
          </div>
        )}
        {categories.data && categories.data.length === 0 && !categories.loading && !categories.error && (
          <EmptyState message={t.tasks.no_categories} />
        )}
      </div>

      {/* Tasks Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedCategory && (
          <>
            {/* Stats Cards */}
            {queueStats.data && (
              <div className="grid grid-cols-5 gap-3 mb-4">
                {[
                  { label: t.common.total, value: queueStats.data.total_tasks, accent: 'border-slate-300 dark:border-slate-600', text: 'text-slate-800 dark:text-slate-100' },
                  { label: t.common.pending, value: queueStats.data.pending_tasks, accent: 'border-amber-400', text: 'text-amber-600 dark:text-amber-400' },
                  { label: t.common.processing, value: queueStats.data.processing_tasks, accent: 'border-blue-400', text: 'text-blue-600 dark:text-blue-400' },
                  { label: t.common.completed, value: queueStats.data.completed_tasks, accent: 'border-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
                  { label: t.common.failed, value: queueStats.data.failed_tasks, accent: 'border-red-400', text: 'text-red-600 dark:text-red-400' },
                ].map((s) => (
                  <div key={s.label} className={`${commonClasses.card} p-3 border-l-4 ${s.accent}`}>
                    <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                    <div className={`text-xl font-bold tabular-nums ${s.text}`}>{s.value || 0}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Task Form */}
            <div className={`${commonClasses.card} p-4 mb-4`}>
              <h3 className="font-semibold mb-3">{t.tasks.add_new_task}</h3>
              <div className="space-y-3">
                <Field label={t.tasks.task_content}>
                  <textarea
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    placeholder={t.tasks.task_content_placeholder}
                    rows={4}
                    className={`${commonClasses.input} w-full`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.tasks.file_name_optional}>
                    <input
                      type="text"
                      value={newTaskFileName}
                      onChange={(e) => setNewTaskFileName(e.target.value)}
                      placeholder="task_001.md"
                      className={commonClasses.input}
                    />
                  </Field>
                  <Field label={t.tasks.priority}>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(parseInt(e.target.value))}
                      className={commonClasses.input}
                    >
                      <option value={1}>{t.tasks.priority_low}</option>
                      <option value={2}>{t.tasks.priority_normal}</option>
                      <option value={3}>{t.tasks.priority_high}</option>
                      <option value={4}>{t.tasks.priority_urgent}</option>
                    </select>
                  </Field>
                </div>
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskContent.trim()}
                  className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  {t.tasks.add_task}
                </button>
              </div>
            </div>

            {/* Task Queue Header with Search */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-3">{t.tasks.queue_title} ({tasks.data?.length || 0})</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder={t.tasks.search_tasks_placeholder}
                  className={`${commonClasses.input} pl-10 pr-10 w-full`}
                />
                {taskSearchQuery && (
                  <button
                    onClick={() => setTaskSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
            {tasks.loading && (
              <LoadingBlock label="" className="py-8" />
            )}
            {!tasks.loading && tasks.error && (
              <AlertBox variant="error" className="mb-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm break-words">{tasks.error}</p>
                  <button
                    onClick={() => selectedCategory && loadTasks(selectedCategory)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t.common.retry}
                  </button>
                </div>
              </AlertBox>
            )}
            {!tasks.loading && !tasks.error && tasks.data && tasks.data.length === 0 && (
              <EmptyState icon={ListTodo} className="flex-1" title={t.tasks.no_tasks} message={t.tasks.no_tasks_hint} />
            )}
            {tasks.data && (
              <div className="flex-1 overflow-y-auto space-y-2">
                {tasks.data.map((task) => (
                  <div
                    key={task.id}
                    className={`${commonClasses.card} p-4`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {editingTaskId === task.id ? (
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                            className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                            autoFocus
                          >
                            <option value="pending">{t.common.pending}</option>
                            <option value="in_progress">{t.common.in_progress}</option>
                            <option value="completed">{t.common.completed}</option>
                            <option value="failed">{t.common.failed}</option>
                          </select>
                        ) : (
                          <>
                            <StatusBadge status={task.status} withDot={false} />
                            <button
                              onClick={() => setEditingTaskId(task.id)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                              title={t.tasks.edit_status}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        <span className="font-medium">{task.original_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingTaskId === task.id && (
                          <button
                            onClick={() => setEditingTaskId(null)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                            title={t.common.cancel}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${
                            expandedTaskId === task.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : ''
                          }`}
                          title={expandedTaskId === task.id ? t.tasks.hide_content : t.tasks.view_content}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                          title={t.tasks.delete_task}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {expandedTaskId === task.id && (
                      <pre className="mt-2 mb-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                        {task.content || t.tasks.no_content}
                      </pre>
                    )}
                    <p className="text-sm text-slate-500">
                      {t.tasks.created_label} {new Date(task.created_at).toLocaleString()}
                    </p>
                    {task.completed_at && (
                      <p className="text-sm text-slate-500">
                        {t.tasks.completed_label} {new Date(task.completed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Mapping Section */}
            <div className={`${commonClasses.card} p-4 mt-4`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{t.tasks.prompt_mapping}</h3>
                <button
                  onClick={() => loadPromptMapping(selectedCategory)}
                  className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
                >
                  <RefreshCw className="w-4 h-4" />
                  {t.common.refresh}
                </button>
              </div>

              {promptMapping.loading && (
                <LoadingBlock label="" className="py-4" />
              )}

              <div className="space-y-3">
                <Field label={t.tasks.prompt_file_path}>
                  <input
                    type="text"
                    value={promptFilePath}
                    onChange={(e) => setPromptFilePath(e.target.value)}
                    placeholder="/prompts/category_prompt.md"
                    className={commonClasses.input}
                  />
                </Field>
                <Field label={t.tasks.prompt_content}>
                  <textarea
                    value={promptContent}
                    onChange={(e) => setPromptContent(e.target.value)}
                    placeholder={t.tasks.prompt_content_placeholder}
                    rows={8}
                    className={`${commonClasses.input} w-full font-mono text-sm`}
                  />
                </Field>
                {promptMapping.data?.variables && promptMapping.data.variables.length > 0 && (
                  <Field label={t.tasks.variables}>
                    <div className="flex flex-wrap gap-2">
                      {promptMapping.data.variables.map((variable: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs"
                        >
                          {`{{${variable.name}}}`}
                        </span>
                      ))}
                    </div>
                  </Field>
                )}
                <button
                  onClick={handleSavePromptMapping}
                  disabled={!promptFilePath.trim()}
                  className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  {t.tasks.save_prompt_mapping}
                </button>
              </div>
            </div>
          </>
        )}
        {!selectedCategory && (
          <EmptyState className="h-full" message={t.tasks.select_category_hint} />
        )}
      </div>

      {/* Category Files Modal */}
      {viewingFilesForCategory && (
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`} onClick={() => setViewingFilesForCategory(null)}>
          <div className={`${commonClasses.card} w-full max-w-2xl max-h-[80vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold">{t.tasks.category_files}</h3>
              <button
                onClick={() => setViewingFilesForCategory(null)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {categoryFiles.loading && (
                <LoadingBlock label="" className="py-8" />
              )}
              {categoryFiles.data && categoryFiles.data.files && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {t.tasks.files_total_prefix} {categoryFiles.data.total} {t.tasks.files_total_suffix}
                  </p>
                  {categoryFiles.data.files.map((file: any, index: number) => (
                    <div
                      key={index}
                      className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{file.name || file}</p>
                          {file.path && (
                            <p className="text-xs text-slate-500 mt-1">{file.path}</p>
                          )}
                          {file.size && (
                            <p className="text-xs text-slate-500 mt-1">
                              {t.common.size} {(file.size / 1024).toFixed(2)} KB
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {categoryFiles.data && categoryFiles.data.files && categoryFiles.data.files.length === 0 && (
                <EmptyState message={t.tasks.no_files} />
              )}
              {categoryFiles.error && (
                <AlertBox variant="error">{t.common.error_label} {categoryFiles.error}</AlertBox>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};

export default TasksTab;
