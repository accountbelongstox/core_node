import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload, RefreshCw, Clock, Trash2, Grid, List as ListIcon, Image, HardDrive,
  Calendar, Search, X, Eye, Download, Copy
} from 'lucide-react';
import { Language, AsyncState, Screenshot } from '../../../types';
import { api } from '../../../core/api';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, AlertBox, EmptyState, FileDropzone } from '../../common';
import { useClipboard } from '../../../hooks/useClipboard';
import Portal from '../../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';

/**
 * MCP Screenshots tab — self-contained: upload (single/batch/merge) via drag /
 * paste / file dialog, grid+list views, search, and the image-detail modal.
 * Extracted from MCPManager (the modal previously lived in the container root).
 */
const ScreenshotsTab: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].mcp;
  const { t: tCommon } = useTranslation();
  const { copy } = useClipboard();
  const copyToClipboard = (text: string): void => {
    void copy(text, t.screenshots.toast.copied);
  };

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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadMode, setUploadMode] = useState<'single' | 'batch' | 'merge'>('single');
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadModeDialog, setShowUploadModeDialog] = useState(false);
  const [showMultiFileUploadPanel, setShowMultiFileUploadPanel] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    loadScreenshots();
    loadScreenshotStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search for screenshots
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchScreenshots(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <>
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
        <LoadingBlock label="" className="h-64" />
      )}

      {screenshots.error && (
        <AlertBox variant="error">{screenshots.error}</AlertBox>
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
        <EmptyState
          icon={Upload}
          className="h-64"
          title={t.screenshots.no_screenshots}
          message={t.screenshots.upload_hint}
          action={
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">{t.screenshots.drop_here}</span>
              <span>•</span>
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Ctrl + V</span>
              <span>•</span>
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">{t.screenshots.upload}</span>
            </div>
          }
        />
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
            <FileDropzone
              accept="image/*"
              multiple
              className="p-12"
              onFiles={(files) => {
                const imageFiles = files.filter(file => file.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                  const dataTransfer = new DataTransfer();
                  imageFiles.forEach(file => dataTransfer.items.add(file));
                  handleScreenshotUpload(dataTransfer.files);
                  setShowMultiFileUploadPanel(false);
                }
              }}
            >
              {() => (
                <>
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
                </>
              )}
            </FileDropzone>
          </div>
        </div>
        </Portal>
      )}
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
    </>
  );
};

export default ScreenshotsTab;
