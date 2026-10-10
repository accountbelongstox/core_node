import { offerBlobFile } from '@/core/browser/FileDownload';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronUp,
  Download,
  Edit,
  File,
  Folder,
  Lock,
  RefreshCw,
  Save,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import type { FilePreview, Language, ServerFileNode } from '@/apps/laravel-manager/uiTypes';
import { LoadingBlock, AlertBox } from '../../common';
import { commonClasses } from '@/shared/styles/theme';
import { Modal } from '../../admin';
import i18n, { useTranslation } from '@/apps/laravel-manager/i18n';

const ELEVATED_STORAGE_KEY = 'server_manager_elevated_token';
const ELEVATED_EXPIRY_KEY = 'server_manager_elevated_expires';

interface ServerFileManagerPanelProps {
  lang: Language;
}

type BrowseItem = ServerFileNode & {
  is_directory?: boolean;
  writable?: boolean;
  modified?: number | string;
  size?: number;
};

const loadStoredElevatedToken = (): string | null => {
  const token = sessionStorage.getItem(ELEVATED_STORAGE_KEY);
  const expiresAt = Number(sessionStorage.getItem(ELEVATED_EXPIRY_KEY) || 0);
  if (!token || !expiresAt || Date.now() >= expiresAt) {
    sessionStorage.removeItem(ELEVATED_STORAGE_KEY);
    sessionStorage.removeItem(ELEVATED_EXPIRY_KEY);
    return null;
  }
  return token;
};

const storeElevatedToken = (token: string, expiresIn: number) => {
  sessionStorage.setItem(ELEVATED_STORAGE_KEY, token);
  sessionStorage.setItem(ELEVATED_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
};

const ServerFileManagerPanel: React.FC<ServerFileManagerPanelProps> = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathFallback, setPathFallback] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<BrowseItem | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [fileEncoding, setFileEncoding] = useState<'utf-8' | 'base64'>('utf-8');
  const [isBinaryFile, setIsBinaryFile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const openSeqRef = useRef(0);
  const loadSeqRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [elevatedToken, setElevatedToken] = useState<string | null>(() => loadStoredElevatedToken());
  const [authOpen, setAuthOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const labels = useMemo(() => ({
    browse: t('uiServer.file_manager.browse'),
    parent: t('uiServer.file_manager.parent'),
    search: t('uiServer.file_manager.search'),
    download: t('uiServer.file_manager.download'),
    edit: t('uiServer.file_manager.edit'),
    save: t('uiServer.file_manager.save'),
    cancel: t('uiServer.file_manager.cancel'),
    allowedPaths: t('uiServer.file_manager.allowed_paths'),
    pathFallback: t('uiServer.file_manager.path_fallback'),
    previewTitle: t('uiServer.file_manager.preview_title'),
    elevated: t('uiServer.file_manager.elevated'),
    elevatedHint: t('uiServer.file_manager.elevated_hint'),
    rootPassword: t('uiServer.file_manager.root_password'),
    authenticate: t('uiServer.file_manager.authenticate'),
    elevatedActive: t('uiServer.file_manager.elevated_active'),
    revoke: t('uiServer.file_manager.revoke'),
    noSelection: t('uiServer.file_manager.no_selection'),
    writable: t('uiServer.file_manager.writable'),
    binaryHint: t('uiServer.file_manager.binary_hint'),
    readOnly: t('uiServer.file_manager.read_only'),
  }), [t]);

  const loadDirectory = useCallback(async (path?: string) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await api.serverManagerV1.browseFiles(path ? { path } : undefined);
      if (seq !== loadSeqRef.current) return;
      if (!response.success || !response.data) {
        throw new Error(response.error || i18n.t('uiServer.file_manager.browse_failed'));
      }

      const data = response.data as {
        path?: string;
        items?: BrowseItem[];
        allowed_paths?: string[];
        path_fallback?: boolean;
      };

      const nextItems = Array.isArray(data.items) ? data.items : [];
      const nextPath = data.path || path || '';
      setItems(nextItems);
      setCurrentPath(nextPath);
      setPathInput(nextPath);
      setPathFallback(Boolean(data.path_fallback));
      if (Array.isArray(data.allowed_paths) && data.allowed_paths.length > 0) {
        setAllowedPaths(data.allowed_paths);
      }
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e.message);
      setItems([]);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const parentPath = useMemo(() => {
    if (!currentPath) return null;
    const parts = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length <= 1) return '/';
    parts.pop();
    return '/' + parts.join('/');
  }, [currentPath]);

  const openFile = async (file: BrowseItem) => {
    const seq = ++openSeqRef.current;
    setSelectedFile(file);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setIsEditing(false);
    setIsTruncated(false);
    setSaveStatus('idle');
    try {
      const response = await api.serverManagerV1.previewFile(file.path, { forEdit: true, maxLines: 10000 });
      if (seq !== openSeqRef.current) return;
      if (!response.success || !response.data) {
        throw new Error(response.error || i18n.t('uiServer.file_manager.load_failed'));
      }
      const data = response.data as FilePreview & {
        content?: string;
        truncated?: boolean;
        is_binary?: boolean;
        encoding?: string;
      };
      const binary = Boolean(data.is_binary) || data.encoding === 'base64';
      setIsBinaryFile(binary);
      setFileEncoding(binary ? 'base64' : 'utf-8');
      setPreview(data);
      setEditedContent(data.content || '');
      setIsTruncated(Boolean(data.truncated));
      if (data.truncated) {
        setPreviewError(i18n.t('uiServer.file_manager.truncated_notice'));
      }
    } catch (e: any) {
      if (seq !== openSeqRef.current) return;
      setPreviewError(e.message);
      setPreview(null);
    } finally {
      if (seq === openSeqRef.current) setPreviewLoading(false);
    }
  };

  const handleItemClick = (item: BrowseItem) => {
    if (item.type === 'directory' || item.is_directory) {
      openSeqRef.current += 1;
      setPreviewLoading(false);
      loadDirectory(item.path);
      setSelectedFile(null);
      setPreview(null);
      setIsEditing(false);
      return;
    }
    openFile(item);
  };

  const handleDownload = async (filePath: string) => {
    try {
      const blob = await api.serverManagerV1.downloadFileBlob(filePath);
      offerBlobFile(filePath.split(/[/\\]/).pop() || 'download', blob);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const performSave = async (token?: string | null) => {
    if (!selectedFile || isTruncated || previewLoading) return;
    const saveSeq = openSeqRef.current;
    const savedPath = selectedFile.path;
    const savedContent = editedContent;
    setSaveStatus('saving');
    setError(null);
    try {
      const response = await api.serverManagerV1.writeFile(
        savedPath,
        savedContent,
        token ?? elevatedToken,
        fileEncoding
      );
      if (saveSeq !== openSeqRef.current) {
        if (response.success) {
          setSaveStatus('idle');
          loadDirectory(currentPath);
        } else {
          setSaveStatus('error');
          setError(response.error || i18n.t('uiServer.file_manager.save_failed'));
        }
        return;
      }
      if (!response.success) {
        const needsElevation = Boolean(
          (response.debugInfo as { data?: { needs_elevation?: boolean } } | undefined)?.data?.needs_elevation
        ) || /elevated access required/i.test(response.error || '');
        if (needsElevation) {
          setPendingSave(true);
          setAuthOpen(true);
          setSaveStatus('idle');
          return;
        }
        throw new Error(response.error || i18n.t('uiServer.file_manager.save_failed'));
      }
      setIsEditing(false);
      setSaveStatus('saved');
      setPreview((prev) => (prev ? { ...prev, content: savedContent } : prev));
      setTimeout(() => setSaveStatus('idle'), 2000);
      loadDirectory(currentPath);
    } catch (e: any) {
      setSaveStatus('error');
      setError(e.message);
    }
  };

  const handleSave = async () => {
    await performSave();
  };

  const handleAuthenticate = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await api.serverManagerV1.elevatedAuth(authPassword);
      if (!response.success || !response.data) {
        throw new Error(response.error || i18n.t('uiServer.file_manager.auth_failed'));
      }
      const data = response.data as { token?: string; expires_in?: number };
      if (!data.token) {
        throw new Error(i18n.t('uiServer.file_manager.no_token'));
      }
      storeElevatedToken(data.token, data.expires_in || 900);
      setElevatedToken(data.token);
      setAuthPassword('');
      setAuthOpen(false);
      if (pendingSave) {
        setPendingSave(false);
        await performSave(data.token);
      }
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRevokeElevated = async () => {
    if (elevatedToken) {
      await api.serverManagerV1.revokeElevatedAuth(elevatedToken);
    }
    sessionStorage.removeItem(ELEVATED_STORAGE_KEY);
    sessionStorage.removeItem(ELEVATED_EXPIRY_KEY);
    setElevatedToken(null);
  };

  return (
    <div className="space-y-4">
      {allowedPaths.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">{labels.allowedPaths}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowedPaths.map((allowedPath) => (
              <button
                key={allowedPath}
                onClick={() => loadDirectory(allowedPath)}
                className="px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 transition-colors"
              >
                {allowedPath}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          placeholder={t('uiServer.file_manager.enter_path')}
          className="flex-1 min-w-[240px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
        />
        <button
          onClick={() => loadDirectory(pathInput || undefined)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
        >
          {labels.browse}
        </button>
        <button
          onClick={() => loadDirectory(currentPath || undefined)}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        {parentPath && (
          <button
            onClick={() => loadDirectory(parentPath)}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <ChevronUp className="w-4 h-4" />
            {labels.parent}
          </button>
        )}
        {elevatedToken ? (
          <button
            onClick={handleRevokeElevated}
            className="px-3 py-2 text-xs rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300"
          >
            {labels.elevatedActive} · {labels.revoke}
          </button>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" />
            {labels.elevated}
          </button>
        )}
      </div>

      {pathFallback && (
        <AlertBox variant="warning">{labels.pathFallback}</AlertBox>
      )}

      {error && <AlertBox variant="error">{error}</AlertBox>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[520px]">
        <div className={`${commonClasses.card} p-4 flex flex-col`}>
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={labels.search}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <div className="text-xs text-slate-500 mb-2 truncate">{currentPath}</div>
          {loading ? (
            <LoadingBlock />
          ) : (
            <div className="overflow-auto flex-1 space-y-1">
              {filteredItems.map((item) => {
                const isDir = item.type === 'directory' || item.is_directory;
                const active = selectedFile?.path === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      active ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' : ''
                    }`}
                  >
                    {isDir ? (
                      <Folder className="w-4 h-4 text-blue-500 shrink-0" />
                    ) : (
                      <File className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="truncate flex-1">{item.name}</span>
                    {!isDir && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {item.writable ? labels.writable : labels.readOnly}
                      </span>
                    )}
                  </button>
                );
              })}
              {!loading && filteredItems.length === 0 && (
                <div className="text-sm text-slate-500 py-8 text-center">
                  {t('uiServer.file_manager.directory_empty')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`${commonClasses.card} p-4 flex flex-col`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold">{labels.previewTitle}</h3>
            {selectedFile && (
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      disabled={isTruncated || previewLoading || !preview}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      {labels.edit}
                    </button>
                    <button
                      onClick={() => handleDownload(selectedFile.path)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {labels.download}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saveStatus === 'saving'}
                      className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white flex items-center gap-1 disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saveStatus === 'saving' ? '...' : labels.save}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedContent(preview?.content || '');
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      {labels.cancel}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {!selectedFile && (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              {labels.noSelection}
            </div>
          )}

          {selectedFile && previewLoading && <LoadingBlock />}
          {selectedFile && previewError && !previewLoading && (
            <AlertBox variant="warning">{previewError}</AlertBox>
          )}

          {selectedFile && !previewLoading && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="text-xs text-slate-500 mb-2 truncate">{selectedFile.path}</div>
              {isBinaryFile && (
                <div className="text-xs text-amber-600 mb-2">{labels.binaryHint}</div>
              )}
              {saveStatus === 'saved' && (
                <div className="text-xs text-green-600 mb-2">{t('uiServer.file_manager.saved')}</div>
              )}
              {isEditing ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="flex-1 min-h-[360px] font-mono text-xs p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 resize-none"
                />
              ) : (
                <pre className="flex-1 min-h-[360px] overflow-auto font-mono text-xs p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 whitespace-pre-wrap">
                  {preview?.content || ''}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setAuthPassword('');
          setAuthError(null);
          setPendingSave(false);
        }}
        title={labels.elevated}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{labels.elevatedHint}</p>
          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder={labels.rootPassword}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
            autoComplete="current-password"
          />
          {authError && <AlertBox variant="error">{authError}</AlertBox>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAuthOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
            >
              {labels.cancel}
            </button>
            <button
              onClick={handleAuthenticate}
              disabled={authLoading || !authPassword}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60"
            >
              {authLoading ? '...' : labels.authenticate}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ServerFileManagerPanel;
