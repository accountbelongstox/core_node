
import React, { useState, useEffect } from 'react';
import { Language, AsyncState, Screenshot, TaskCategory, DispatchTask } from '../../types';
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
  RefreshCw
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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const t = TRANSLATIONS[lang].mcp;

  useEffect(() => {
    if (activeTab === 'screenshots') {
      loadScreenshots();
    } else if (activeTab === 'tasks') {
      loadCategories();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCategory && activeTab === 'tasks') {
      loadTasks(selectedCategory);
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
      <div className="flex-1 flex flex-col">
        {selectedCategory && (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Task Queue</h3>
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
        {activeTab === 'placeholder' && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Placeholder Generator - Coming Soon</p>
          </div>
        )}
        {activeTab === 'voice' && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Voice Subtitle - Coming Soon</p>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>MCP Settings - Coming Soon</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MCPManager;
