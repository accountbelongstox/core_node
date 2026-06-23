
import React, { useState, useEffect, useRef } from 'react';
import {
  Language,
  AsyncState,
  Screenshot,
  TaskCategory,
  DispatchTask,
  PlaceholderResponse,
  PlaceholderGenerateRequest,
  VoiceQueueItem
} from '../../types';
import { api } from '../../core/api';
import { useTranslation } from 'react-i18next';
import { TRANSLATIONS } from '../../constants';
import { useToast } from '../admin/Toast';
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
  X,
  HardDrive,
  Calendar,
  Clock,
  Edit2,
  Check,
  XCircle
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';

interface MCPManagerProps {
  lang?: Language;
}

type MCPTab = 'screenshots' | 'tasks' | 'placeholder' | 'voice' | 'ocr' | 'settings';

const MCPManager: React.FC<MCPManagerProps> = ({ lang = 'en' }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<MCPTab>('screenshots');
  const [screenshots, setScreenshots] = useState<AsyncState<Screenshot[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [screenshotStats, setScreenshotStats] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadMode, setUploadMode] = useState<'single' | 'batch' | 'merge'>('single');
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadModeDialog, setShowUploadModeDialog] = useState(false);
  const [showMultiFileUploadPanel, setShowMultiFileUploadPanel] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

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
  const [placeholderStats, setPlaceholderStats] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  // Voice Subtitle State
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
  const [voiceSettings, setVoiceSettings] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [voiceBackgroundTasks, setVoiceBackgroundTasks] = useState<AsyncState<any[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });

  // OCR State
  const [ocrEngines, setOcrEngines] = useState<AsyncState<any[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedEngine, setSelectedEngine] = useState<string>('paddleocr');
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrBatchImages, setOcrBatchImages] = useState<File[]>([]);
  const [ocrBatchResults, setOcrBatchResults] = useState<AsyncState<any[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [ocrBatchPreviewUrls, setOcrBatchPreviewUrls] = useState<string[]>([]);
  const [ocrEngineInfo, setOcrEngineInfo] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  const t = TRANSLATIONS[lang].mcp;
  const { t: tCommon } = useTranslation();

  // Copy to clipboard helper function
  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Modern async clipboard API
        await navigator.clipboard.writeText(text);
        toast.success(t.screenshots.toast.copied);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          toast.success(t.screenshots.toast.copied);
        } catch (err) {
          console.error('Failed to copy:', err);
          toast.error(t.screenshots.toast.copy_failed_manual);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      toast.error(t.screenshots.toast.copy_failed);
    }
  };

  useEffect(() => {
    if (activeTab === 'screenshots') {
      loadScreenshots();
      loadScreenshotStats();
    } else if (activeTab === 'tasks') {
      loadCategories();
    } else if (activeTab === 'placeholder') {
      loadPlaceholderHistory();
      loadPlaceholderStats();
    } else if (activeTab === 'voice') {
      loadVoiceQueue();
      loadCurrentVoiceTrack();
      loadVoiceStats();
      loadVoiceGroups();
      loadSupportedLanguages();
      loadVoiceCategories();
      loadVoiceBackgroundTasks();
    } else if (activeTab === 'ocr') {
      loadOcrEngines();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCategory && activeTab === 'tasks') {
      loadTasks(selectedCategory);
      loadQueueStats(selectedCategory);
      loadPromptMapping(selectedCategory);
    }
  }, [selectedCategory, activeTab]);

  // Debounced search for screenshots
  useEffect(() => {
    if (activeTab !== 'screenshots') return;

    const timeoutId = setTimeout(() => {
      searchScreenshots(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab]);

  // Voice queue filter effect
  useEffect(() => {
    if (activeTab === 'voice') {
      loadVoiceQueue();
    }
  }, [voiceQueueFilter, selectedVoiceGroup, selectedVoiceCategory, activeTab]);

  // Task search effect
  useEffect(() => {
    if (activeTab === 'tasks' && selectedCategory) {
      const timeoutId = setTimeout(() => {
        if (taskSearchQuery.trim()) {
          searchTasksInCategory(selectedCategory, taskSearchQuery);
        } else {
          loadTasks(selectedCategory);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [taskSearchQuery, selectedCategory, activeTab]);

  // OCR engine info effect
  useEffect(() => {
    if (activeTab === 'ocr' && selectedEngine) {
      loadOcrEngineInfo(selectedEngine);
    }
  }, [selectedEngine, activeTab]);

  const loadScreenshots = async () => {
    setScreenshots(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getScreenshots(1, 20);
      if (response.success && response.data) {
        // Ensure data is an array - handle multiple response formats
        const screenshotsData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).screenshots || (response.data as any).items || []);

        setScreenshots({
          data: screenshotsData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.screenshots.load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load screenshots:', error);
      setScreenshots({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadScreenshotStats = async () => {
    setScreenshotStats(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getScreenshotStats();
      if (response.success && response.data) {
        setScreenshotStats({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.screenshots.stats_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load screenshot stats:', error);
      setScreenshotStats({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const searchScreenshots = async (query: string) => {
    if (!query.trim()) {
      loadScreenshots();
      return;
    }

    setScreenshots(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.searchScreenshots({ query, page: 1, limit: 20 });
      if (response.success && response.data) {
        const screenshotsData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).screenshots || (response.data as any).items || []);

        setScreenshots({
          data: screenshotsData,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.screenshots.search_failed);
      }
    } catch (error: any) {
      console.error('Screenshot search failed:', error);
      setScreenshots({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

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

  const handleScreenshotUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      let response;

      if (uploadMode === 'single') {
        // Single upload - only upload first file
        const file = files[0];
        response = await api.mcpV1.uploadScreenshot({
          image: file,
          description: ''
        });
      } else if (uploadMode === 'batch') {
        // Batch upload - upload each file separately
        const filesArray = Array.from(files);
        response = await api.mcpV1.uploadBatch({
          images: filesArray,
          keyword: ''
        });
      } else if (uploadMode === 'merge') {
        // Merge upload - merge all files into one
        const filesArray = Array.from(files);
        response = await api.mcpV1.uploadMerge({
          images: filesArray,
          keyword: ''
        });
      }

      if (response && response.success) {
        loadScreenshots();
        loadScreenshotStats();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Filter only image files
      const imageFiles = (Array.from(files) as File[]).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        const dataTransfer = new DataTransfer();
        imageFiles.forEach(file => dataTransfer.items.add(file));
        handleScreenshotUpload(dataTransfer.files);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];

    // Extract image files from clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Create a new file with a meaningful name
          const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 14);
          const ext = file.type.split('/')[1] || 'png';
          const newFile = new File([file], `pasted-screenshot-${timestamp}.${ext}`, { type: file.type });
          imageFiles.push(newFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(file => dataTransfer.items.add(file));
      handleScreenshotUpload(dataTransfer.files);

      // Show success feedback
      console.log(`📋 Pasted ${imageFiles.length} image(s) from clipboard`);
    }
  };

  // Build image URL from screenshot ID using Laravel MCP API
  const getImageUrl = (screenshot: Screenshot): string => {
    // Get the base URL from the API config
    const baseUrl = api.mcpV1['baseURL'] || '';

    // Extract file extension from mime_type or original_name
    let ext = 'png'; // default
    if (screenshot.mime_type) {
      const mimeMap: { [key: string]: string } = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp'
      };
      ext = mimeMap[screenshot.mime_type] || ext;
    } else if (screenshot.original_name) {
      const match = screenshot.original_name.match(/\.([a-z0-9]+)$/i);
      if (match) {
        ext = match[1].toLowerCase();
      }
    }

    // Use MCP API route with extension for better AI compatibility
    // GET /api/mcp/v1/screenshots/{id}.{ext}
    return `${baseUrl}/api/mcp/v1/screenshots/${screenshot.id}.${ext}`;
  };

  const handleViewScreenshot = (screenshot: Screenshot) => {
    setSelectedScreenshot(screenshot);
    setShowImageModal(true);
  };

  const handleDownloadScreenshot = (screenshot: Screenshot) => {
    const url = getImageUrl(screenshot);
    const link = document.createElement('a');
    link.href = url;
    link.download = screenshot.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteScreenshot = async (screenshot: Screenshot) => {
    if (!confirm(t.screenshots.delete_confirm)) return;

    try {
      const response = await api.mcpV1.deleteScreenshot(screenshot.id);
      if (response.success) {
        loadScreenshots();
        loadScreenshotStats();
      }
    } catch (error) {
      console.error('Failed to delete screenshot:', error);
    }
  };

  const handleLoadLatestScreenshot = async () => {
    try {
      const response = await api.mcpV1.getLatestScreenshot();
      if (response.success && response.data) {
        // Show only latest screenshot
        setScreenshots({
          data: [response.data],
          loading: false,
          error: null,
          status: 'success'
        });
      }
    } catch (error) {
      console.error('Failed to load latest screenshot:', error);
    }
  };

  const handleClearAllScreenshots = async () => {
    if (!confirm(t.screenshots.clear_all_confirm)) {
      return;
    }

    // Second confirmation
    if (!confirm(t.screenshots.clear_all_final)) {
      return;
    }

    try {
      const response = await api.mcpV1.clearAllScreenshots();
      if (response.success) {
        loadScreenshots();
        loadScreenshotStats();
      }
    } catch (error) {
      console.error('Failed to clear all screenshots:', error);
    }
  };

  const tabs = [
    { id: 'screenshots' as MCPTab, label: t.tabs.screenshots, icon: Image },
    { id: 'tasks' as MCPTab, label: t.tabs.tasks, icon: ListTodo },
    { id: 'placeholder' as MCPTab, label: t.tabs.placeholder, icon: ImagePlus },
    { id: 'voice' as MCPTab, label: t.tabs.voice, icon: Settings },
    { id: 'ocr' as MCPTab, label: t.tabs.ocr, icon: Eye },
    { id: 'settings' as MCPTab, label: t.tabs.settings, icon: Settings },
  ];

  const renderScreenshotsTab = () => (
    <div
      className="flex flex-col h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} bg-indigo-500/20 backdrop-blur-sm pointer-events-none`}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl border-4 border-dashed border-indigo-500">
            <Upload className="w-16 h-16 mx-auto mb-4 text-indigo-500" />
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
              {t.screenshots.drop_here}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t.screenshots.upload_mode}: {uploadMode === 'single' ? t.screenshots.single_upload : uploadMode === 'batch' ? t.screenshots.batch_upload : t.screenshots.merge_upload}
            </p>
          </div>
        </div>
        </Portal>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              handleScreenshotUpload(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
            id="screenshot-upload-single"
          />
          <button
            onClick={() => setShowUploadModeDialog(true)}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
            title={`${t.screenshots.upload} ${t.screenshots.paste_hint}`}
          >
            <Upload className="w-4 h-4" />
            {t.screenshots.upload}
          </button>
          <button
            onClick={loadScreenshots}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            {t.screenshots.refresh}
          </button>
          <button
            onClick={handleLoadLatestScreenshot}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            title={t.screenshots.latest}
          >
            <Clock className="w-4 h-4" />
            {t.screenshots.latest}
          </button>
          <button
            onClick={handleClearAllScreenshots}
            className={`${commonClasses.button} text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-2`}
            title={t.screenshots.clear_all_confirm}
          >
            <Trash2 className="w-4 h-4" />
            {t.screenshots.clear_all}
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

      {/* Statistics */}
      {screenshotStats.data && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Image className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.screenshots.stats_total}</span>
            </div>
            <p className="text-2xl font-bold">{screenshotStats.data.total_count || 0}</p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-green-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.storage_used}</span>
            </div>
            <p className="text-2xl font-bold">
              {screenshotStats.data.total_size
                ? `${(screenshotStats.data.total_size / 1024 / 1024).toFixed(2)} MB`
                : '0 MB'}
            </p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.this_week}</span>
            </div>
            <p className="text-2xl font-bold">{screenshotStats.data.weekly_count || 0}</p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.today}</span>
            </div>
            <p className="text-2xl font-bold">{screenshotStats.data.daily_count || 0}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.screenshots.search_by_filename}
            className={`${commonClasses.input} pl-10 pr-10 w-full`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
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
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6'
            : 'space-y-4 p-6'
        }`}>
          {screenshots.data.map((screenshot) => (
              <div
                key={screenshot.id}
                className={`group relative ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-5'
                    : 'bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-200 dark:border-slate-700'
                }`}
              >
                {viewMode === 'grid' ? (
                  <>
                    {/* Image Container with Overlay */}
                    <div
                      className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 overflow-hidden cursor-pointer rounded-t-xl"
                      onClick={() => handleViewScreenshot(screenshot)}
                    >
                      <img
                        src={getImageUrl(screenshot)}
                        alt={screenshot.original_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          // Fallback to icon on error
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                          const icon = document.createElement('div');
                          icon.innerHTML = '<svg class="w-12 h-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                          e.currentTarget.parentElement!.appendChild(icon);
                        }}
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewScreenshot(screenshot); }}
                            className="p-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all transform hover:scale-110 shadow-xl"
                            title={t.screenshots.view}
                          >
                            <Eye className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadScreenshot(screenshot); }}
                            className="p-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all transform hover:scale-110 shadow-xl"
                            title={t.screenshots.download}
                          >
                            <Download className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteScreenshot(screenshot); }}
                            className="p-4 bg-red-500/95 backdrop-blur-sm rounded-xl hover:bg-red-600 transition-all transform hover:scale-110 shadow-xl"
                            title={t.screenshots.delete}
                          >
                            <Trash2 className="w-6 h-6 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Info Section */}
                    <div className="p-4">
                      <p className="text-sm font-medium truncate text-slate-800 dark:text-slate-200 mb-3" title={screenshot.original_name}>
                        {screenshot.original_name}
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(screenshot.created_at).toLocaleDateString()} {new Date(screenshot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Thumbnail */}
                    <div
                      className="relative w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all shadow-sm"
                      onClick={() => handleViewScreenshot(screenshot)}
                    >
                      <img
                        src={getImageUrl(screenshot)}
                        alt={screenshot.original_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to icon on error
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                          const icon = document.createElement('div');
                          icon.innerHTML = '<svg class="w-10 h-10 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                          e.currentTarget.parentElement!.appendChild(icon);
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-base" title={screenshot.original_name}>
                        {screenshot.original_name}
                      </p>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {new Date(screenshot.created_at).toLocaleDateString()} • {new Date(screenshot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewScreenshot(screenshot)}
                        className="p-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors"
                        title={t.screenshots.view}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDownloadScreenshot(screenshot)}
                        className="p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                        title={t.screenshots.download}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteScreenshot(screenshot)}
                        className="p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                        title={t.screenshots.delete}
                      >
                        <Trash2 className="w-5 h-5" />
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
          <Upload className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">{t.screenshots.no_screenshots}</p>
          <p className="text-sm mb-2">{t.screenshots.upload_hint}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">{t.screenshots.drop_here}</span>
            <span>•</span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Ctrl + V</span>
            <span>•</span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">{t.screenshots.upload}</span>
          </div>
        </div>
      )}

      {/* Upload Mode Selection Dialog */}
      {showUploadModeDialog && (
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`} onClick={() => setShowUploadModeDialog(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{t.screenshots.upload_dialog_title}</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setUploadMode('single');
                  setShowUploadModeDialog(false);
                  document.getElementById('screenshot-upload-single')?.click();
                }}
                className="w-full p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50">
                  <Image className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{t.screenshots.single_file_upload}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{t.screenshots.single_file_desc}</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setUploadMode('batch'); // Set default to batch mode
                  setShowUploadModeDialog(false);
                  setShowMultiFileUploadPanel(true);
                }}
                className="w-full p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50">
                  <Grid className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{t.screenshots.multi_file_upload}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{t.screenshots.multi_file_desc}</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowUploadModeDialog(false)}
              className="mt-4 w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
        </Portal>
      )}

      {/* Multi-File Upload Panel */}
      {showMultiFileUploadPanel && (
        <Portal>
        <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`} onClick={() => setShowMultiFileUploadPanel(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl w-[600px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t.screenshots.multi_file_upload}</h3>
              <button
                onClick={() => setShowMultiFileUploadPanel(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Mode Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">{t.screenshots.upload_mode}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setUploadMode('batch')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    uploadMode === 'batch'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t.screenshots.batch_upload}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.screenshots.batch_desc}</div>
                </button>
                <button
                  onClick={() => setUploadMode('merge')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    uploadMode === 'merge'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t.screenshots.merge_upload}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.screenshots.merge_desc}</div>
                </button>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  const imageFiles = (Array.from(files) as File[]).filter(file => file.type.startsWith('image/'));
                  if (imageFiles.length > 0) {
                    const dataTransfer = new DataTransfer();
                    imageFiles.forEach(file => dataTransfer.items.add(file));
                    handleScreenshotUpload(dataTransfer.files);
                    setShowMultiFileUploadPanel(false);
                  }
                }
              }}
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-12 text-center hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all cursor-pointer"
              onClick={() => document.getElementById('screenshot-upload-multi')?.click()}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  handleScreenshotUpload(e.target.files);
                  setShowMultiFileUploadPanel(false);
                  e.target.value = '';
                }}
                className="hidden"
                id="screenshot-upload-multi"
              />
              <Upload className="w-16 h-16 mx-auto mb-4 text-indigo-500" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t.screenshots.drop_or_click}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t.screenshots.supported_formats}
              </p>
              <div className="inline-block px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium">
                {uploadMode === 'batch' ? t.screenshots.batch_mode : t.screenshots.merge_mode}
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );

  const renderTasksTab = () => (
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
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        )}
        {!categories.loading && categories.error && (
          <div className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 break-words">
              {categories.error}
            </p>
            <button
              onClick={loadCategories}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {t.common.retry}
            </button>
          </div>
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
          <div className="text-center text-slate-400 py-8">
            <p className="text-sm">{t.tasks.no_categories}</p>
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
                <div>
                  <label className="block text-sm font-medium mb-1">{t.tasks.task_content}</label>
                  <textarea
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    placeholder={t.tasks.task_content_placeholder}
                    rows={4}
                    className={`${commonClasses.input} w-full`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t.tasks.file_name_optional}</label>
                    <input
                      type="text"
                      value={newTaskFileName}
                      onChange={(e) => setNewTaskFileName(e.target.value)}
                      placeholder="task_001.md"
                      className={commonClasses.input}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t.tasks.priority}</label>
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
                  </div>
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
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            )}
            {!tasks.loading && tasks.error && (
              <div className={`${commonClasses.card} p-4 mb-4 border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-red-600 dark:text-red-400 break-words">{tasks.error}</p>
                  <button
                    onClick={() => selectedCategory && loadTasks(selectedCategory)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t.common.retry}
                  </button>
                </div>
              </div>
            )}
            {!tasks.loading && !tasks.error && tasks.data && tasks.data.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center py-10">
                  <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">{t.tasks.no_tasks}</p>
                  <p className="text-xs mt-1">{t.tasks.no_tasks_hint}</p>
                </div>
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
                            <span className={`px-2 py-1 rounded text-xs ${
                              task.status === 'completed' ? commonClasses.badgeSuccess :
                              task.status === 'failed' ? commonClasses.badgeError :
                              task.status === 'processing' || task.status === 'in_progress' ? commonClasses.badgeInfo :
                              commonClasses.badgeWarning
                            }`}>
                              {task.status}
                            </span>
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
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t.tasks.prompt_file_path}</label>
                  <input
                    type="text"
                    value={promptFilePath}
                    onChange={(e) => setPromptFilePath(e.target.value)}
                    placeholder="/prompts/category_prompt.md"
                    className={commonClasses.input}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.tasks.prompt_content}</label>
                  <textarea
                    value={promptContent}
                    onChange={(e) => setPromptContent(e.target.value)}
                    placeholder={t.tasks.prompt_content_placeholder}
                    rows={8}
                    className={`${commonClasses.input} w-full font-mono text-sm`}
                  />
                </div>
                {promptMapping.data?.variables && promptMapping.data.variables.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.tasks.variables}</label>
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
                  {t.tasks.save_prompt_mapping}
                </button>
              </div>
            </div>
          </>
        )}
        {!selectedCategory && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>{t.tasks.select_category_hint}</p>
          </div>
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
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
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
                <div className="text-center text-slate-400 py-8">
                  <p>{t.tasks.no_files}</p>
                </div>
              )}
              {categoryFiles.error && (
                <div className="text-center text-red-500 py-8">
                  <p>{t.common.error_label} {categoryFiles.error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );

  const loadPlaceholderHistory = async () => {
    try {
      const response = await api.mcpV1.getPlaceholders();
      if (response.success && response.data) {
        setPlaceholderHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to load placeholder history:', error);
    }
  };

  const handleCleanupPlaceholders = async () => {
    if (!confirm(t.placeholder.cleanup_confirm)) {
      return;
    }

    try {
      const response = await api.mcpV1.cleanupPlaceholders();
      if (response.success) {
        loadPlaceholderHistory();
        loadPlaceholderStats();
      }
    } catch (error) {
      console.error('Failed to cleanup placeholders:', error);
    }
  };

  const loadPlaceholderStats = async () => {
    setPlaceholderStats(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getPlaceholderStats();
      if (response.success && response.data) {
        setPlaceholderStats({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.placeholder.stats_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load placeholder stats:', error);
      setPlaceholderStats({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleDeletePlaceholder = async (uuid: string) => {
    try {
      const response = await api.mcpV1.deletePlaceholder(uuid);
      if (response.success) {
        loadPlaceholderHistory();
        loadPlaceholderStats();
      }
    } catch (error) {
      console.error('Failed to delete placeholder:', error);
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
      const response = await api.mcpV1.generatePlaceholder(request);
      if (response.success && response.data) {
        setGeneratedPlaceholder({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        loadPlaceholderHistory();
      } else {
        throw new Error(response.error || t.placeholder.generate_failed);
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

  const loadVoiceSettings = async () => {
    setVoiceSettings(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.vsGetUserSettings();
      if (response.success && response.data) {
        setVoiceSettings({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.voice.settings_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load voice settings:', error);
      setVoiceSettings({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleUpdateVoiceSettings = async (settings: any) => {
    try {
      const response = await api.mcpV1.vsUpdateUserSettings(settings);
      if (response.success) {
        loadVoiceSettings();
      }
    } catch (error) {
      console.error('Failed to update voice settings:', error);
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

  // OCR Functions
  const loadOcrEngines = async () => {
    setOcrEngines(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getOcrEngines();
      if (response.success && response.data) {
        setOcrEngines({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.engines_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load OCR engines:', error);
      setOcrEngines({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadOcrEngineInfo = async (engine: string) => {
    setOcrEngineInfo(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getOcrEngineInfo(engine);
      if (response.success && response.data) {
        setOcrEngineInfo({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.engine_info_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load OCR engine info:', error);
      setOcrEngineInfo({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleOcrImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setOcrImage(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setOcrPreviewUrl(url);

    // Clear previous result
    setOcrResult({
      data: null,
      loading: false,
      error: null,
      status: 'idle'
    });
  };

  const handleOcrRecognize = async () => {
    if (!ocrImage) return;

    setOcrResult(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.ocrRecognize({
        image: ocrImage,
        engine: selectedEngine
      });

      if (response.success && response.data) {
        setOcrResult({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.recognize_failed);
      }
    } catch (error: any) {
      console.error('OCR recognition failed:', error);
      setOcrResult({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleOcrSmartRecognize = async () => {
    if (!ocrImage) return;

    setOcrResult(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.ocrSmartRecognize({ image: ocrImage });

      if (response.success && response.data) {
        setOcrResult({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.smart_recognize_failed);
      }
    } catch (error: any) {
      console.error('Smart OCR recognition failed:', error);
      setOcrResult({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleOcrBatchImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    setOcrBatchImages(filesArray);

    // Create preview URLs
    const urls = filesArray.map(file => URL.createObjectURL(file));
    setOcrBatchPreviewUrls(urls);

    // Clear previous results
    setOcrBatchResults({
      data: [],
      loading: false,
      error: null,
      status: 'idle'
    });
  };

  const handleOcrBatchRecognize = async () => {
    if (ocrBatchImages.length === 0) return;

    setOcrBatchResults(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.ocrBatch({ images: ocrBatchImages });

      if (response.success && response.data) {
        setOcrBatchResults({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.batch_recognize_failed);
      }
    } catch (error: any) {
      console.error('Batch OCR recognition failed:', error);
      setOcrBatchResults({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const renderPlaceholderTab = () => (
    <div className="flex flex-col h-full gap-4">
      {/* Statistics */}
      {placeholderStats.data && (
        <div className="grid grid-cols-4 gap-4">
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <ImagePlus className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.placeholder.stats_total}</span>
            </div>
            <p className="text-2xl font-bold">{placeholderStats.data.total_count || 0}</p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-green-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.storage_used}</span>
            </div>
            <p className="text-2xl font-bold">
              {placeholderStats.data.total_size
                ? `${(placeholderStats.data.total_size / 1024 / 1024).toFixed(2)} MB`
                : '0 MB'}
            </p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.this_week}</span>
            </div>
            <p className="text-2xl font-bold">{placeholderStats.data.weekly_count || 0}</p>
          </div>
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.common.today}</span>
            </div>
            <p className="text-2xl font-bold">{placeholderStats.data.daily_count || 0}</p>
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* Generator Panel */}
        <div className={`w-96 ${commonClasses.card} p-4 overflow-y-auto`}>
        <h3 className="font-semibold mb-4">{t.placeholder.generate_title}</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">{t.placeholder.width}</label>
              <input
                type="number"
                value={placeholderWidth}
                onChange={(e) => setPlaceholderWidth(parseInt(e.target.value) || 800)}
                className={commonClasses.input}
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.placeholder.height}</label>
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
            <label className="block text-sm font-medium mb-1">{t.placeholder.text_optional}</label>
            <input
              type="text"
              value={placeholderText}
              onChange={(e) => setPlaceholderText(e.target.value)}
              placeholder={t.placeholder.text_placeholder}
              className={commonClasses.input}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">{t.placeholder.bg_color}</label>
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
              <label className="block text-sm font-medium mb-1">{t.placeholder.text_color}</label>
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
              <label className="block text-sm font-medium mb-1">{t.placeholder.format}</label>
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
              <label className="block text-sm font-medium mb-1">{t.placeholder.mode}</label>
              <select
                value={placeholderMode}
                onChange={(e) => setPlaceholderMode(e.target.value as any)}
                className={commonClasses.input}
              >
                <option value="simple">{t.placeholder.mode_simple}</option>
                <option value="real">{t.placeholder.mode_real}</option>
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
              {t.placeholder.generate}
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
              {t.common.reset}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className={`flex-1 ${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
        <h3 className="font-semibold mb-4">{t.placeholder.preview}</h3>

        {generatedPlaceholder.data ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg mb-4">
              <img
                src={generatedPlaceholder.data.url}
                alt={t.placeholder.generated_alt}
                className="max-w-full max-h-full"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t.placeholder.dimensions_label}</span>
                <span className="font-medium">{generatedPlaceholder.data.width}x{generatedPlaceholder.data.height}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t.placeholder.format_label}</span>
                <span className="font-medium">{generatedPlaceholder.data.format.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t.placeholder.file_size_label}</span>
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
              <p>{t.placeholder.no_placeholder}</p>
              <p className="text-sm mt-1">{t.placeholder.no_placeholder_hint}</p>
            </div>
          </div>
        )}
      </div>

      {/* History Panel */}
      <div className={`w-64 ${commonClasses.card} p-4 overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t.placeholder.recent}</h3>
          <div className="flex items-center gap-1">
            <button
              className="text-xs text-slate-500 hover:text-indigo-500"
              onClick={loadPlaceholderHistory}
              title={t.placeholder.refresh_history}
            >
              <RefreshCw className="w-3 h-3 inline" />
            </button>
            <button
              className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 rounded"
              onClick={handleCleanupPlaceholders}
              title={t.placeholder.cleanup_title}
            >
              {t.placeholder.cleanup}
            </button>
          </div>
        </div>
        {placeholderHistory.length > 0 ? (
          <div className="space-y-2">
            {placeholderHistory.slice(0, 10).map((item: any) => (
              <div
                key={item.uuid}
                className="p-3 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div
                  className="cursor-pointer mb-2"
                  onClick={() => {
                    setPlaceholderWidth(item.width);
                    setPlaceholderHeight(item.height);
                    setPlaceholderText(item.text || '');
                    setPlaceholderFormat(item.format);
                  }}
                >
                  <div className="text-xs font-medium">{item.width}x{item.height}</div>
                  <div className="text-xs text-slate-500">{item.format.toUpperCase()}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/api/mcp/v1/placeholders/${item.uuid}/download`}
                    download
                    className="flex-1 p-1.5 rounded text-center text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-3 h-3 inline" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t.placeholder.delete_confirm)) {
                        handleDeletePlaceholder(item.uuid);
                      }
                    }}
                    className="flex-1 p-1.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                  >
                    <Trash2 className="w-3 h-3 inline" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">{t.placeholder.no_history}</p>
        )}
      </div>
      </div>
    </div>
  );

  const renderVoiceTab = () => (
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
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
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
          <div className="flex items-center justify-center py-12 text-slate-400">
            <div className="text-center">
              <Volume2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t.voice.queue_empty}</p>
            </div>
          </div>
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
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        )}

        {voiceBackgroundTasks.error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
            {voiceBackgroundTasks.error}
          </div>
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
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        task.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                        task.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                        task.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {task.status}
                      </span>
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
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">{t.voice.no_background_tasks}</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderOcrTab = () => (
    <div className="flex gap-4 h-full">
      {/* Upload Panel */}
      <div className={`w-96 ${commonClasses.card} p-4 overflow-y-auto`}>
        <h3 className="font-semibold mb-4">{t.ocr.title}</h3>

        <div className="space-y-4">
          {/* Engine Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">{t.ocr.engine}</label>
            {ocrEngines.loading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
              </div>
            ) : (
              <select
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value)}
                className={commonClasses.input}
              >
                <option value="paddleocr">PaddleOCR</option>
                <option value="tesseract">Tesseract</option>
                <option value="easyocr">EasyOCR</option>
              </select>
            )}

            {/* Engine Info */}
            {ocrEngineInfo.loading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t.ocr.loading_engine_info}
              </div>
            )}
            {ocrEngineInfo.data && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-sm space-y-1">
                  {ocrEngineInfo.data.description && (
                    <p className="text-slate-700 dark:text-slate-300">{ocrEngineInfo.data.description}</p>
                  )}
                  {ocrEngineInfo.data.accuracy && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t.ocr.accuracy_label}</span> {ocrEngineInfo.data.accuracy}
                    </p>
                  )}
                  {ocrEngineInfo.data.supported_languages && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t.ocr.languages_label}</span> {
                        Array.isArray(ocrEngineInfo.data.supported_languages)
                          ? ocrEngineInfo.data.supported_languages.join(', ')
                          : ocrEngineInfo.data.supported_languages
                      }
                    </p>
                  )}
                  {ocrEngineInfo.data.speed && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t.ocr.speed_label}</span> {ocrEngineInfo.data.speed}
                    </p>
                  )}
                </div>
              </div>
            )}
            {ocrEngineInfo.error && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {ocrEngineInfo.error}
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">{t.ocr.upload_image}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleOcrImageSelect(e.target.files)}
              className="hidden"
              id="ocr-image-upload"
            />
            <label
              htmlFor="ocr-image-upload"
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} w-full flex items-center justify-center gap-2 cursor-pointer`}
            >
              <Upload className="w-4 h-4" />
              {t.ocr.choose_image}
            </label>
          </div>

          {/* Preview */}
          {ocrPreviewUrl && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">{t.ocr.preview}</label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <img
                  src={ocrPreviewUrl}
                  alt={t.ocr.preview_alt}
                  className="w-full h-auto max-h-64 object-contain bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleOcrRecognize}
              disabled={!ocrImage || ocrResult.loading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {ocrResult.loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {t.ocr.recognize}
            </button>
            <button
              onClick={handleOcrSmartRecognize}
              disabled={!ocrImage || ocrResult.loading}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
              title={t.ocr.smart_recognize_title}
            >
              <Wand2 className="w-4 h-4" />
            </button>
          </div>

          {/* Batch Upload */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
            <h4 className="text-sm font-semibold mb-3">{t.ocr.batch_recognition}</h4>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleOcrBatchImageSelect(e.target.files)}
              className="hidden"
              id="ocr-batch-upload"
            />
            <label
              htmlFor="ocr-batch-upload"
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} w-full flex items-center justify-center gap-2 cursor-pointer mb-3`}
            >
              <Upload className="w-4 h-4" />
              {t.ocr.choose_multiple_images}
            </label>

            {ocrBatchImages.length > 0 && (
              <>
                <div className="text-xs text-slate-500 mb-2">
                  {t.ocr.selected_prefix} {ocrBatchImages.length} {t.ocr.selected_suffix}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {ocrBatchPreviewUrls.slice(0, 6).map((url, index) => (
                    <div key={index} className="aspect-square border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
                      <img
                        src={url}
                        alt={`${t.ocr.image_label} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  {ocrBatchImages.length > 6 && (
                    <div className="aspect-square border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                      <span className="text-xs text-slate-500">+{ocrBatchImages.length - 6}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleOcrBatchRecognize}
                  disabled={ocrBatchResults.loading}
                  className={`${commonClasses.button} ${commonClasses.buttonPrimary} w-full flex items-center justify-center gap-2`}
                >
                  {ocrBatchResults.loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {t.ocr.batch_recognize}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Result Panel */}
      <div className={`flex-1 ${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
        <h3 className="font-semibold mb-4">
          {ocrBatchResults.data && ocrBatchResults.data.length > 0 ? t.ocr.batch_results : t.ocr.recognition_result}
        </h3>

        {/* Batch Results */}
        {ocrBatchResults.data && ocrBatchResults.data.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {ocrBatchResults.data.map((result: any, index: number) => (
              <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium">{t.ocr.image_label} {index + 1}</span>
                  {result.engine && (
                    <span className="text-xs text-slate-500">({result.engine})</span>
                  )}
                </div>
                {result.text ? (
                  <div className="space-y-2">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded text-sm">
                      {result.text}
                    </div>
                    {result.confidence && (
                      <div className="text-xs text-slate-500">
                        {t.ocr.confidence_label} {(result.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                    <button
                      onClick={() => copyToClipboard(result.text)}
                      className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-xs flex items-center gap-1`}
                    >
                      <Copy className="w-3 h-3" />
                      {t.common.copy}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {result.error || t.ocr.no_text_detected}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Single Result (keep existing) */}
        {(!ocrBatchResults.data || ocrBatchResults.data.length === 0) && ocrResult.data && (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-4">
              <div className="text-sm whitespace-pre-wrap">{ocrResult.data.text || t.ocr.no_text_detected}</div>
            </div>
            {ocrResult.data.confidence && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">{t.ocr.confidence_label}</span>
                  <span className="font-medium">{(ocrResult.data.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${ocrResult.data.confidence * 100}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={() => copyToClipboard(ocrResult.data?.text || '')}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <Copy className="w-4 h-4" />
              {t.ocr.copy_text}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!ocrResult.data && (!ocrBatchResults.data || ocrBatchResults.data.length === 0) && (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>{t.ocr.no_result}</p>
              <p className="text-sm mt-1">{t.ocr.no_result_hint}</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {(ocrResult.error || ocrBatchResults.error) && (
          <div className={`${commonClasses.card} p-6 text-center`}>
            <p className="text-red-600 dark:text-red-400">{ocrResult.error || ocrBatchResults.error}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className={`${commonClasses.card} p-6`}>
      <h3 className="text-lg font-semibold mb-4">{t.settings.title}</h3>
      <p className="text-slate-500">{t.settings.coming_soon}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tabs — segmented pill control */}
      <div className="mb-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'screenshots' && renderScreenshotsTab()}
        {activeTab === 'tasks' && renderTasksTab()}
        {activeTab === 'placeholder' && renderPlaceholderTab()}
        {activeTab === 'voice' && renderVoiceTab()}
        {activeTab === 'ocr' && renderOcrTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>

      {/* Image Detail Modal - Enhanced */}
      {showImageModal && selectedScreenshot && (
        <Portal>
        <div
          className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} bg-black/90 backdrop-blur-sm animate-in fade-in duration-200`}
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Enhanced */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-2">
                  <Image className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  {selectedScreenshot.original_name}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium">
                    {selectedScreenshot.mime_type.split('/')[1]?.toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedScreenshot.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {new Date(selectedScreenshot.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadScreenshot(selectedScreenshot)}
                  className="p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-all hover:scale-110 active:scale-95"
                  title={t.screenshots.download}
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => copyToClipboard(getImageUrl(selectedScreenshot))}
                  className="p-3 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-all hover:scale-110 active:scale-95"
                  title={t.screenshots.copy_url}
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all hover:scale-110 active:scale-95"
                  title={tCommon('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image - Enhanced */}
            <div className="flex-1 overflow-auto p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
              <img
                src={getImageUrl(selectedScreenshot)}
                alt={selectedScreenshot.original_name}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700"
                onError={(e) => {
                  e.currentTarget.src = '';
                  e.currentTarget.alt = t.screenshots.load_image_failed;
                  e.currentTarget.className = 'text-red-500';
                }}
              />
            </div>

            {/* Footer - Enhanced */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
              <div className="space-y-4">
                {/* URL Section */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2 block">
                    {t.screenshots.image_url}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative group">
                      <input
                        type="text"
                        value={getImageUrl(selectedScreenshot)}
                        readOnly
                        onClick={(e) => e.currentTarget.select()}
                        className="block w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-text"
                      />
                    </div>
                    <button
                      onClick={() => copyToClipboard(getImageUrl(selectedScreenshot))}
                      className="p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                      title={t.screenshots.copy_url}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Description Section */}
                {selectedScreenshot.description && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2 block">
                      {t.screenshots.description}
                    </label>
                    <p className="px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      {selectedScreenshot.description}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    ID: <code className="font-mono">{selectedScreenshot.id}</code>
                  </span>
                  {selectedScreenshot.size && (
                    <span className="flex items-center gap-1">
                      {t.common.size} {(selectedScreenshot.size / 1024).toFixed(2)} KB
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};

export default MCPManager;
