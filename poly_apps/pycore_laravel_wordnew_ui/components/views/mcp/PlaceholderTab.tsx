import React, { useState, useEffect } from 'react';
import { ImagePlus, HardDrive, Calendar, Clock, Wand2, Copy, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Language, AsyncState, PlaceholderResponse, PlaceholderGenerateRequest } from '../../../types';
import { api } from '@/apps/laravel-manager/api';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { Field, InlineSpinner, EmptyState } from '../../common';
import { useClipboard } from '../../../hooks/useClipboard';

/**
 * MCP Placeholder-image generator tab — self-contained: form state + generate /
 * history / stats / cleanup / delete. Extracted from MCPManager.
 */
const PlaceholderTab: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].mcp;
  const { copy } = useClipboard();
  const copyToClipboard = (text: string): void => {
    void copy(text, t.screenshots.toast.copied);
  };

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

  useEffect(() => {
    loadPlaceholderHistory();
    loadPlaceholderStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
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
            <Field label={t.placeholder.width}>
              <input
                type="number"
                value={placeholderWidth}
                onChange={(e) => setPlaceholderWidth(parseInt(e.target.value) || 800)}
                className={commonClasses.input}
                min="1"
              />
            </Field>
            <Field label={t.placeholder.height}>
              <input
                type="number"
                value={placeholderHeight}
                onChange={(e) => setPlaceholderHeight(parseInt(e.target.value) || 600)}
                className={commonClasses.input}
                min="1"
              />
            </Field>
          </div>

          <Field label={t.placeholder.text_optional}>
            <input
              type="text"
              value={placeholderText}
              onChange={(e) => setPlaceholderText(e.target.value)}
              placeholder={t.placeholder.text_placeholder}
              className={commonClasses.input}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t.placeholder.bg_color}>
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
            </Field>
            <Field label={t.placeholder.text_color}>
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
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t.placeholder.format}>
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
            </Field>
            <Field label={t.placeholder.mode}>
              <select
                value={placeholderMode}
                onChange={(e) => setPlaceholderMode(e.target.value as any)}
                className={commonClasses.input}
              >
                <option value="simple">{t.placeholder.mode_simple}</option>
                <option value="real">{t.placeholder.mode_real}</option>
              </select>
            </Field>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGeneratePlaceholder}
              disabled={generatedPlaceholder.loading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {generatedPlaceholder.loading ? (
                <InlineSpinner />
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
          <EmptyState icon={ImagePlus} className="flex-1" title={t.placeholder.no_placeholder} message={t.placeholder.no_placeholder_hint} />
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
          <EmptyState message={t.placeholder.no_history} />
        )}
      </div>
      </div>
    </div>
  );
};

export default PlaceholderTab;
