
import React, { useState, useEffect, useRef } from 'react';
import { 
  Language, 
  AsyncState, 
  Screenshot, 
  TaskCategory, 
  DispatchTask,
  PlaceholderResponse,
  PlaceholderGenerateRequest,
  VoiceQueueItem,
  AddVoiceQueueRequest
} from '../../types';
import { apiService } from '../../services/apiService';
import { TRANSLATIONS } from '../../constants';
import { 
  Image, 
  ListTodo, 
  ImagePlus, 
  Settings,
  Upload,
  Search,
  Filter,
  Grid,
  List as ListIcon,
  Trash2,
  Download,
  Eye,
  RefreshCw,
  Wand2,
  Copy,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Plus,
  X
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface MCPManagerProps {
  lang?: Language;
}

type MCPTab = 'screenshots' | 'tasks' | 'placeholder' | 'voice' | 'settings';

const MCPManager: React.FC<MCPManagerProps> = ({ lang = 'en' }) => {
  const [activeTab, setActiveTab] = useState<MCPTab>('screenshots');
  const [screenshots, setScreenshots] = useState<AsyncState<Screenshot[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [categories, setCategories] = useState<AsyncState<TaskCategory[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AsyncState<DispatchTask[]>>({
    data: null,
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
  const [promptMapping, setPromptMapping] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [promptFilePath, setPromptFilePath] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Placeholder Generator State
  const [placeholderWidth, setPlaceholderWidth] = useState(800);
  const [placeholderHeight, setPlaceholderHeight] = useState(600);
  const [placeholderText, setPlaceholderText] = useState('');
  const [placeholderBgColor, setPlaceholderBgColor] = useState('#cccccc');
  const [placeholderTextColor, setPlaceholderTextColor] = useState('#333333');
  const [placeholderFormat, setPlaceholderFormat] = useState<'png' | 'jpg' | 'svg' | 'webp'>('png');
  const [placeholderMode, setPlaceholderMode] = useState<'simple' | 'real'>('simple');
  const [generatedPlaceholder, setGeneratedPlaceholder] = useState<AsyncState<PlaceholderResponse>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [placeholderHistory, setPlaceholderHistory] = useState<any[]>([]);
  
  // Voice Subtitle State
  const [voiceQueue, setVoiceQueue] = useState<AsyncState<VoiceQueueItem[]>>({
    data: null,
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
  const [newVoiceType, setNewVoiceType] = useState<'text' | 'url' | 'voice'>('text');
  const [newVoiceLanguage, setNewVoiceLanguage] = useState('en');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const t = TRANSLATIONS[lang].mcp;

  useEffect(() => {
    if (activeTab === 'screenshots') {
      loadScreenshots();
    } else if (activeTab === 'tasks') {
      loadCategories();
    } else if (activeTab === 'placeholder') {
      loadPlaceholderHistory();
    } else if (activeTab === 'voice') {
      loadVoiceQueue();
      loadCurrentVoiceTrack();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCategory && activeTab === 'tasks') {
      loadTasks(selectedCategory);
      loadQueueStats(selectedCategory);
      loadPromptMapping(selectedCategory);
    }
  }, [selectedCategory, activeTab]);

  const loadScreenshots = async () => {
    setScreenshots(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getScreenshots(1, 20);
      if (response.success && response.data) {
        setScreenshots({
          data: Array.isArray(response.data) ? response.data : response.data.screenshots || [],
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load screenshots');
      }
    } catch (error: any) {
      setScreenshots({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadCategories = async () => {
    setCategories(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getTaskCategories();
      if (response.success && response.data) {
        setCategories({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        if (response.data.length > 0 && !selectedCategory) {
          setSelectedCategory(response.data[0].id);
        }
      } else {
        throw new Error(response.error || 'Failed to load categories');
      }
    } catch (error: any) {
      setCategories({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadTasks = async (categoryId: string) => {
    setTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getTaskQueue(categoryId);
      if (response.success && response.data) {
        setTasks({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load tasks');
      }
    } catch (error: any) {
      setTasks({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadQueueStats = async (categoryId: string) => {
    setQueueStats(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getQueueStats(categoryId);
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
      const response = await apiService.addTask({
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

  const loadPromptMapping = async (categoryId: string) => {
    setPromptMapping(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getPromptMappings();
      if (response.success && response.data) {
        const mapping = response.data.find((m: any) => m.category_id === categoryId);
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
      const response = await apiService.updatePromptMapping(
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

  const handleScreenshotUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const file = files[0];
      const response = await apiService.uploadScreenshot({
        image: file,
        description: ''
      });

      if (response.success) {
        loadScreenshots();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const tabs = [
    { id: 'screenshots' as MCPTab, label: t.tabs.screenshots, icon: Image },
    { id: 'tasks' as MCPTab, label: t.tabs.tasks, icon: ListTodo },
    { id: 'placeholder' as MCPTab, label: t.tabs.placeholder, icon: ImagePlus },
    { id: 'voice' as MCPTab, label: t.tabs.voice, icon: Settings },
    { id: 'settings' as MCPTab, label: t.tabs.settings, icon: Settings },
  ];

  const renderScreenshotsTab = () => (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleScreenshotUpload(e.target.files)}
            className="hidden"
            id="screenshot-upload"
          />
          <label
            htmlFor="screenshot-upload"
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 cursor-pointer`}
          >
            <Upload className="w-4 h-4" />
            Upload
          </label>
          <button
            onClick={loadScreenshots}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : ''}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search screenshots..."
            className={`${commonClasses.input} pl-10 w-full`}
          />
        </div>
      </div>

      {/* Screenshots Grid/List */}
      {screenshots.loading && (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {screenshots.error && (
        <div className={`${commonClasses.card} p-6 text-center`}>
          <p className="text-red-600 dark:text-red-400">{screenshots.error}</p>
        </div>
      )}

      {screenshots.data && screenshots.data.length > 0 && (
        <div className={`flex-1 overflow-auto ${
          viewMode === 'grid' 
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' 
            : 'space-y-2'
        }`}>
          {screenshots.data
            .filter(s => !searchQuery || s.original_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((screenshot) => (
              <div
                key={screenshot.id}
                className={`${commonClasses.card} ${commonClasses.cardHover} ${
                  viewMode === 'list' ? 'flex items-center gap-4 p-4' : 'p-2'
                }`}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded mb-2 flex items-center justify-center">
                      <Image className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-xs truncate mb-1">{screenshot.original_name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(screenshot.created_at).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center flex-shrink-0">
                      <Image className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{screenshot.original_name}</p>
                      <p className="text-sm text-slate-500">
                        {screenshot.mime_type} • {new Date(screenshot.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
        </div>
      )}

      {screenshots.data && screenshots.data.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Image className="w-16 h-16 mb-4 opacity-50" />
          <p>No screenshots found</p>
        </div>
      )}
    </div>
  );

  const renderTasksTab = () => (
    <div className="flex h-full gap-4">
      {/* Categories Sidebar */}
      <div className={`w-64 ${commonClasses.card} p-4 overflow-y-auto`}>
        <h3 className="font-semibold mb-4">Categories</h3>
        {categories.loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        )}
        {categories.data && (
          <div className="space-y-2">
            {categories.data.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="font-medium">{category.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {category.file_count} tasks
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tasks Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedCategory && (
          <>
            {/* Stats Cards */}
            {queueStats.data && (
              <div className="grid grid-cols-5 gap-3 mb-4">
                <div className={`${commonClasses.card} p-3`}>
                  <div className="text-xs text-slate-500 mb-1">Total</div>
                  <div className="text-lg font-bold">{queueStats.data.total_tasks || 0}</div>
                </div>
                <div className={`${commonClasses.card} p-3 border-l-4 border-yellow-500`}>
                  <div className="text-xs text-slate-500 mb-1">Pending</div>
                  <div className="text-lg font-bold">{queueStats.data.pending_tasks || 0}</div>
                </div>
                <div className={`${commonClasses.card} p-3 border-l-4 border-blue-500`}>
                  <div className="text-xs text-slate-500 mb-1">Processing</div>
                  <div className="text-lg font-bold">{queueStats.data.processing_tasks || 0}</div>
                </div>
                <div className={`${commonClasses.card} p-3 border-l-4 border-emerald-500`}>
                  <div className="text-xs text-slate-500 mb-1">Completed</div>
                  <div className="text-lg font-bold">{queueStats.data.completed_tasks || 0}</div>
                </div>
                <div className={`${commonClasses.card} p-3 border-l-4 border-red-500`}>
                  <div className="text-xs text-slate-500 mb-1">Failed</div>
                  <div className="text-lg font-bold">{queueStats.data.failed_tasks || 0}</div>
                </div>
              </div>
            )}

            {/* Add Task Form */}
            <div className={`${commonClasses.card} p-4 mb-4`}>
              <h3 className="font-semibold mb-3">Add New Task</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Task Content</label>
                  <textarea
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    placeholder="Enter task content or paste markdown..."
                    rows={4}
                    className={`${commonClasses.input} w-full`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">File Name (optional)</label>
                    <input
                      type="text"
                      value={newTaskFileName}
                      onChange={(e) => setNewTaskFileName(e.target.value)}
                      placeholder="task_001.md"
                      className={commonClasses.input}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(parseInt(e.target.value))}
                      className={commonClasses.input}
                    >
                      <option value={1}>Low</option>
                      <option value={2}>Normal</option>
                      <option value={3}>High</option>
                      <option value={4}>Urgent</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskContent.trim()}
                  className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Task Queue ({tasks.data?.length || 0})</h3>
            </div>
            {tasks.loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
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
                        <span className={`px-2 py-1 rounded text-xs ${
                          task.status === 'completed' ? commonClasses.badgeSuccess :
                          task.status === 'failed' ? commonClasses.badgeError :
                          task.status === 'processing' ? commonClasses.badgeInfo :
                          commonClasses.badgeWarning
                        }`}>
                          {task.status}
                        </span>
                        <span className="font-medium">{task.original_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">
                      Created: {new Date(task.created_at).toLocaleString()}
                    </p>
                    {task.completed_at && (
                      <p className="text-sm text-slate-500">
                        Completed: {new Date(task.completed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Mapping Section */}
            <div className={`${commonClasses.card} p-4 mt-4`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Prompt Mapping</h3>
                <button
                  onClick={() => loadPromptMapping(selectedCategory)}
                  className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {promptMapping.loading && (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Prompt File Path</label>
                  <input
                    type="text"
                    value={promptFilePath}
                    onChange={(e) => setPromptFilePath(e.target.value)}
                    placeholder="/prompts/category_prompt.md"
                    className={commonClasses.input}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Prompt Content</label>
                  <textarea
                    value={promptContent}
                    onChange={(e) => setPromptContent(e.target.value)}
                    placeholder="Enter prompt content..."
                    rows={8}
                    className={`${commonClasses.input} w-full font-mono text-sm`}
                  />
                </div>
                {promptMapping.data?.variables && promptMapping.data.variables.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Variables</label>
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
                  </div>
                )}
                <button
                  onClick={handleSavePromptMapping}
                  disabled={!promptFilePath.trim()}
                  className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  Save Prompt Mapping
                </button>
              </div>
            </div>
          </>
        )}
        {!selectedCategory && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Select a category to view tasks</p>
          </div>
        )}
      </div>
    </div>
  );

  const loadPlaceholderHistory = async () => {
    try {
      const response = await apiService.getPlaceholders();
      if (response.success && response.data) {
        setPlaceholderHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to load placeholder history:', error);
    }
  };

  const handleGeneratePlaceholder = async () => {
    setGeneratedPlaceholder(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const request: PlaceholderGenerateRequest = {
        width: placeholderWidth,
        height: placeholderHeight,
        text: placeholderText || undefined,
        bg_color: placeholderBgColor,
        text_color: placeholderTextColor,
        format: placeholderFormat,
        mode: placeholderMode
      };
      const response = await apiService.generatePlaceholder(request);
      if (response.success && response.data) {
        setGeneratedPlaceholder({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        loadPlaceholderHistory();
      } else {
        throw new Error(response.error || 'Failed to generate placeholder');
      }
    } catch (error: any) {
      setGeneratedPlaceholder({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadVoiceQueue = async () => {
    setVoiceQueue(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getVoiceQueue();
      if (response.success && response.data) {
        setVoiceQueue({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load voice queue');
      }
    } catch (error: any) {
      setVoiceQueue({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadCurrentVoiceTrack = async () => {
    try {
      const response = await apiService.getCurrentVoiceTrack();
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

  const handleAddToVoiceQueue = async () => {
    if (!newVoiceContent.trim()) return;

    try {
      const request: AddVoiceQueueRequest = {
        type: newVoiceType,
        content: newVoiceContent,
        language: newVoiceLanguage,
        auto_play: false
      };
      const response = await apiService.addToVoiceQueue(request);
      if (response.success) {
        setNewVoiceContent('');
        loadVoiceQueue();
      }
    } catch (error) {
      console.error('Failed to add to voice queue:', error);
    }
  };

  const renderPlaceholderTab = () => (
    <div className="flex gap-4 h-full">
      {/* Generator Panel */}
      <div className={`w-96 ${commonClasses.card} p-4 overflow-y-auto`}>
        <h3 className="font-semibold mb-4">Generate Placeholder</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Width (px)</label>
              <input
                type="number"
                value={placeholderWidth}
                onChange={(e) => setPlaceholderWidth(parseInt(e.target.value) || 800)}
                className={commonClasses.input}
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (px)</label>
              <input
                type="number"
                value={placeholderHeight}
                onChange={(e) => setPlaceholderHeight(parseInt(e.target.value) || 600)}
                className={commonClasses.input}
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Text (optional)</label>
            <input
              type="text"
              value={placeholderText}
              onChange={(e) => setPlaceholderText(e.target.value)}
              placeholder="Placeholder Image"
              className={commonClasses.input}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Background Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={placeholderBgColor}
                  onChange={(e) => setPlaceholderBgColor(e.target.value)}
                  className="w-12 h-10 rounded border border-slate-300 dark:border-slate-600"
                />
                <input
                  type="text"
                  value={placeholderBgColor}
                  onChange={(e) => setPlaceholderBgColor(e.target.value)}
                  className={`${commonClasses.input} flex-1`}
                  placeholder="#cccccc"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Text Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={placeholderTextColor}
                  onChange={(e) => setPlaceholderTextColor(e.target.value)}
                  className="w-12 h-10 rounded border border-slate-300 dark:border-slate-600"
                />
                <input
                  type="text"
                  value={placeholderTextColor}
                  onChange={(e) => setPlaceholderTextColor(e.target.value)}
                  className={`${commonClasses.input} flex-1`}
                  placeholder="#333333"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Format</label>
              <select
                value={placeholderFormat}
                onChange={(e) => setPlaceholderFormat(e.target.value as any)}
                className={commonClasses.input}
              >
                <option value="png">PNG</option>
                <option value="jpg">JPEG</option>
                <option value="svg">SVG</option>
                <option value="webp">WebP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mode</label>
              <select
                value={placeholderMode}
                onChange={(e) => setPlaceholderMode(e.target.value as any)}
                className={commonClasses.input}
              >
                <option value="simple">Simple</option>
                <option value="real">Realistic</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGeneratePlaceholder}
              disabled={generatedPlaceholder.loading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {generatedPlaceholder.loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              Generate
            </button>
            <button
              onClick={() => {
                setPlaceholderWidth(800);
                setPlaceholderHeight(600);
                setPlaceholderText('');
                setPlaceholderBgColor('#cccccc');
                setPlaceholderTextColor('#333333');
                setPlaceholderFormat('png');
                setPlaceholderMode('simple');
              }}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className={`flex-1 ${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
        <h3 className="font-semibold mb-4">Preview</h3>
        
        {generatedPlaceholder.data ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg mb-4">
              <img
                src={generatedPlaceholder.data.url}
                alt="Generated placeholder"
                className="max-w-full max-h-full"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Dimensions:</span>
                <span className="font-medium">{generatedPlaceholder.data.width}x{generatedPlaceholder.data.height}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Format:</span>
                <span className="font-medium">{generatedPlaceholder.data.format.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">File Size:</span>
                <span className="font-medium">{(generatedPlaceholder.data.file_size / 1024).toFixed(2)} KB</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedPlaceholder.data.url}
                  readOnly
                  className={`${commonClasses.input} flex-1 text-xs`}
                />
                <button
                  onClick={() => copyToClipboard(generatedPlaceholder.data!.url)}
                  className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a
                  href={generatedPlaceholder.data.download_url || generatedPlaceholder.data.url}
                  download
                  className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <ImagePlus className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No placeholder generated</p>
              <p className="text-sm mt-1">Fill the form and click Generate</p>
            </div>
          </div>
        )}
      </div>

      {/* History Panel */}
      <div className={`w-64 ${commonClasses.card} p-4 overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent</h3>
          <button
            className="text-xs text-slate-500 hover:text-red-500"
            onClick={loadPlaceholderHistory}
          >
            Refresh
          </button>
        </div>
        {placeholderHistory.length > 0 ? (
          <div className="space-y-2">
            {placeholderHistory.slice(0, 10).map((item: any) => (
              <div
                key={item.uuid}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  setPlaceholderWidth(item.width);
                  setPlaceholderHeight(item.height);
                  setPlaceholderText(item.text || '');
                  setPlaceholderFormat(item.format);
                }}
              >
                <div className="text-xs font-medium">{item.width}x{item.height}</div>
                <div className="text-xs text-slate-500">{item.format.toUpperCase()}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">No history</p>
        )}
      </div>
    </div>
  );

  const renderVoiceTab = () => (
    <div className="flex flex-col h-full gap-4">
      {/* Add to Queue */}
      <div className={`${commonClasses.card} p-4`}>
        <h3 className="font-semibold mb-4">Add to Voice Queue</h3>
        <div className="flex gap-2">
          <select
            value={newVoiceType}
            onChange={(e) => setNewVoiceType(e.target.value as any)}
            className={commonClasses.input}
          >
            <option value="text">Text</option>
            <option value="url">URL</option>
            <option value="voice">Voice</option>
          </select>
          <input
            type="text"
            value={newVoiceLanguage}
            onChange={(e) => setNewVoiceLanguage(e.target.value)}
            placeholder="Language (e.g., en)"
            className={`${commonClasses.input} w-32`}
          />
          <input
            type="text"
            value={newVoiceContent}
            onChange={(e) => setNewVoiceContent(e.target.value)}
            placeholder="Enter text or URL..."
            className={`${commonClasses.input} flex-1`}
          />
          <button
            onClick={handleAddToVoiceQueue}
            disabled={!newVoiceContent.trim()}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Current Track */}
      {currentVoiceTrack.data && (
        <div className={`${commonClasses.card} p-4`}>
          <h3 className="font-semibold mb-4">Now Playing</h3>
          <div className="flex items-center gap-4">
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Queue</h3>
          <button
            onClick={loadVoiceQueue}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        {voiceQueue.loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        )}
        {voiceQueue.data && voiceQueue.data.length > 0 ? (
          <div className="space-y-2">
            {voiceQueue.data.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border ${
                  item.status === 'playing' 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.status === 'playing' ? commonClasses.badgeInfo :
                      item.status === 'completed' ? commonClasses.badgeSuccess :
                      item.status === 'error' ? commonClasses.badgeError :
                      commonClasses.badgeWarning
                    }`}>
                      {item.status}
                    </span>
                    <span className="text-sm font-medium">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => apiService.playPreviousVoice()}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => apiService.playNextVoice()}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{item.content}</p>
                <p className="text-xs text-slate-500">
                  {item.language} • {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <div className="text-center">
              <Volume2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Queue is empty</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className={`${commonClasses.card} p-6`}>
      <h3 className="text-lg font-semibold mb-4">MCP Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Screenshot Storage Path</label>
          <input
            type="text"
            defaultValue="/storage/screenshots"
            className={commonClasses.input}
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Task Dispatch Path</label>
          <input
            type="text"
            defaultValue="/tasks"
            className={commonClasses.input}
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Placeholder Storage Path</label>
          <input
            type="text"
            defaultValue="/storage/placeholders"
            className={commonClasses.input}
            readOnly
          />
        </div>
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">
            Settings configuration will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage screenshots, tasks, and MCP resources</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'screenshots' && renderScreenshotsTab()}
        {activeTab === 'tasks' && renderTasksTab()}
        {activeTab === 'placeholder' && renderPlaceholderTab()}
        {activeTab === 'voice' && renderVoiceTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>
    </div>
  );
};

export default MCPManager;
