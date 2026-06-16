import React, { useEffect, useState } from 'react';
import {
  Download,
  FileText,
  FileJson,
  File,
  CheckCircle,
  Loader2,
  Settings,
  Filter
} from 'lucide-react';
import { api } from '../../core/api';
import type { VocabExportFormat, VocabExportOptions } from '../../core/api/modules/AppQyV1';
import { commonClasses } from '../../styles/theme';
import { TRANSLATIONS } from '../../constants';
import { useAppState } from '../../contexts/AppStateContext';
import { useToast } from '../admin';
import { logError, logInfo, logSuccess, logWarn } from '../../core/logstore/logStore';

interface ExportPanelProps {
  userId?: string;
}

type ExportFormat = 'csv' | 'json' | 'anki' | 'pdf' | 'txt';
type ExportScope = 'all' | 'learned' | 'review' | 'library';

interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  language: string;
  limit: number;
  includeExamples: boolean;
  includePhonetics: boolean;
  includeDefinitions: boolean;
  libraryId?: string;
}

interface LanguageOption {
  code: string;
  name: string;
  native_name?: string;
}

interface LibraryOption {
  id: string | number;
  name: string;
}

interface RecentExport {
  format: ExportFormat;
  filename: string;
  date: string;
  source: 'server' | 'client';
}

/** Server route segment for each UI format ('txt' is exposed as /export/text). */
const SERVER_FORMAT: Record<ExportFormat, VocabExportFormat> = {
  csv: 'csv',
  json: 'json',
  anki: 'anki',
  pdf: 'pdf',
  txt: 'text'
};

const MAX_EXPORT_LIMIT = 20000;

const ExportPanel: React.FC<ExportPanelProps> = ({ userId }) => {
  const { lang } = useAppState();
  const toast = useToast();
  const t = TRANSLATIONS[lang].vocabulary;
  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    scope: 'all',
    language: 'en',
    limit: 5000,
    includeExamples: true,
    includePhonetics: true,
    includeDefinitions: true
  });
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [libraries, setLibraries] = useState<LibraryOption[]>([]);
  const [recentExports, setRecentExports] = useState<RecentExport[]>([]);

  // Load the supported-language list (cached server-side, 1h client cache) and
  // the real library list so the scope selector offers actual libraries.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.appQyV1.getSupportedLanguages();
        if (cancelled || !res.success || !res.data) return;
        const raw: any = res.data;
        const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw.languages) ? raw.languages : [];
        const mapped = list
          .filter((l) => l && typeof l.code === 'string')
          .map((l) => ({ code: l.code, name: l.name || l.code, native_name: l.native_name }));
        if (mapped.length > 0) setLanguages(mapped);
      } catch (error: any) {
        logWarn('vocab', `Export panel: failed to load languages — ${error?.message || 'unknown error'}`);
      }
    })();

    (async () => {
      try {
        const res = await api.appQyV1.getLibraries({ per_page: 100 });
        if (cancelled || !res.success || !res.data) return;
        const raw: any = res.data;
        const list: any[] = Array.isArray(raw.libraries)
          ? raw.libraries
          : Array.isArray(raw.data?.libraries)
            ? raw.data.libraries
            : Array.isArray(raw)
              ? raw
              : [];
        setLibraries(
          list
            .filter((l) => l && l.id !== undefined && l.id !== null)
            .map((l) => ({ id: l.id, name: l.name || `Library ${l.id}` }))
        );
      } catch (error: any) {
        logWarn('vocab', `Export panel: failed to load libraries — ${error?.message || 'unknown error'}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const formatInfo = {
    csv: {
      icon: FileText,
      name: 'CSV (Comma-Separated Values)',
      description: 'Spreadsheet format compatible with Excel, Google Sheets',
      color: 'text-green-600'
    },
    json: {
      icon: FileJson,
      name: 'JSON',
      description: 'Machine-readable format for developers and data processing',
      color: 'text-blue-600'
    },
    anki: {
      icon: File,
      name: 'Anki Deck',
      description: 'Import directly into Anki flashcard application',
      color: 'text-purple-600'
    },
    pdf: {
      icon: FileText,
      name: 'PDF Document',
      description: 'Generated on the server (may arrive as printable HTML)',
      color: 'text-red-600'
    },
    txt: {
      icon: FileText,
      name: 'Plain Text',
      description: 'Simple text format for basic vocabulary list',
      color: 'text-gray-600'
    }
  };

  const scopeInfo = {
    all: 'All vocabulary words in your collection',
    learned: 'Only words marked as learned',
    review: 'Only words due for review',
    library: 'Words from a specific library'
  };

  // ----- Client-side export (fallback only) -----
  // Used ONLY when the server export endpoint is missing (HTTP 404); the
  // primary path is the server-side POST /vocabulary/export/{format}.

  interface ExportWord {
    word: string;
    translation: string;
    phonetic: string;
    definition: string;
    example: string;
  }

  const fetchWords = async (): Promise<ExportWord[]> => {
    const response = await api.appQyV1.getVocabularyStatistics({
      include_words: 1,
      per_page: 1000,
      language: options.language || undefined,
      ...(options.scope === 'library' && options.libraryId
        ? { library_id: options.libraryId }
        : {})
    } as any);

    const data: any = (response && (response as any).success && (response as any).data) || {};
    const rows: any[] = Array.isArray(data.words)
      ? data.words
      : Array.isArray(data)
        ? data
        : [];

    const toWord = (r: any): ExportWord => ({
      word: r.word ?? '',
      translation: Array.isArray(r.translations)
        ? r.translations.filter(Boolean).join('; ')
        : (r.translation ?? r.meaning ?? ''),
      phonetic: r.us_phonetic ?? r.uk_phonetic ?? r.phonetic ?? '',
      definition: r.definition ?? r.def ?? '',
      example: Array.isArray(r.examples)
        ? r.examples.filter(Boolean).join(' | ')
        : (r.example ?? r.example_sentence ?? '')
    });

    let filtered = rows;
    if (options.scope === 'learned') {
      filtered = rows.filter(r => r.learned === true || r.status === 'learned');
    } else if (options.scope === 'review') {
      filtered = rows.filter(r => r.status === 'reviewing' || r.due_for_review === true);
    }

    return filtered.map(toWord);
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const csvEscape = (value: string): string => {
    const v = value ?? '';
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };

  const buildColumns = (): Array<{ key: keyof ExportWord; label: string }> => {
    const cols: Array<{ key: keyof ExportWord; label: string }> = [
      { key: 'word', label: 'Word' },
      { key: 'translation', label: 'Translation' }
    ];
    if (options.includePhonetics) cols.push({ key: 'phonetic', label: 'Phonetic' });
    if (options.includeDefinitions) cols.push({ key: 'definition', label: 'Definition' });
    if (options.includeExamples) cols.push({ key: 'example', label: 'Example' });
    return cols;
  };

  const exportCSV = (words: ExportWord[]) => {
    const cols = buildColumns();
    const header = cols.map(c => csvEscape(c.label)).join(',');
    const lines = words.map(w => cols.map(c => csvEscape(w[c.key])).join(','));
    triggerDownload([header, ...lines].join('\n'), 'vocabulary_export.csv', 'text/csv');
  };

  const exportJSON = (words: ExportWord[]) => {
    const cols = buildColumns();
    const payload = words.map(w => {
      const obj: Record<string, string> = {};
      cols.forEach(c => { obj[c.key] = w[c.key]; });
      return obj;
    });
    triggerDownload(JSON.stringify(payload, null, 2), 'vocabulary_export.json', 'application/json');
  };

  const exportText = (words: ExportWord[]) => {
    const cols = buildColumns();
    const body = words
      .map(w => cols.map(c => `${c.label}: ${w[c.key]}`).filter(s => !s.endsWith(': ')).join('\n'))
      .join('\n\n');
    triggerDownload(body, 'vocabulary_export.txt', 'text/plain');
  };

  const exportAnki = (words: ExportWord[]) => {
    // Anki imports tab-separated values; front = word, back = the rest joined.
    const cols = buildColumns().filter(c => c.key !== 'word');
    const lines = words.map(w => {
      const back = cols.map(c => w[c.key]).filter(Boolean).join('<br>');
      return `${w.word}\t${back}`;
    });
    triggerDownload(lines.join('\n'), 'vocabulary_anki.txt', 'text/plain');
  };

  const exportPDF = (words: ExportWord[]): boolean => {
    const cols = buildColumns();
    const esc = (s: string) =>
      (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const head = cols.map(c => `<th>${esc(c.label)}</th>`).join('');
    const body = words
      .map(w => `<tr>${cols.map(c => `<td>${esc(w[c.key])}</td>`).join('')}</tr>`)
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vocabulary Export</title>`
      + `<style>`
      + `body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}`
      + `h1{font-size:20px;margin-bottom:16px}`
      + `table{border-collapse:collapse;width:100%;font-size:13px}`
      + `th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;vertical-align:top}`
      + `th{background:#f3f4f6}`
      + `</style></head><body>`
      + `<h1>Vocabulary Export (${words.length} words)</h1>`
      + `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
      + `<script>window.onload=function(){window.print();}<\/script>`
      + `</body></html>`;
    const win = window.open('', '_blank');
    if (!win) {
      toast.error(t.export_popup_blocked);
      logError('vocab', 'PDF export blocked: pop-up window not allowed');
      return false;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  };

  /** Fallback path: build the file in the browser (server endpoint missing). */
  const runClientExport = async (): Promise<string | null> => {
    const words = await fetchWords();

    if (words.length === 0) {
      toast.warning(t.export_no_words);
      logWarn('vocab', `Export aborted: no words for scope "${options.scope}"`);
      return null;
    }

    let filename = `vocabulary_export.${options.format === 'anki' ? 'txt' : options.format}`;
    switch (options.format) {
      case 'csv':
        exportCSV(words);
        break;
      case 'json':
        exportJSON(words);
        break;
      case 'anki':
        exportAnki(words);
        filename = 'vocabulary_anki.txt';
        break;
      case 'pdf':
        // exportPDF reports the pop-up-blocked failure itself.
        if (!exportPDF(words)) return null;
        filename = 'vocabulary_export.pdf (print)';
        break;
      case 'txt':
        exportText(words);
        break;
    }

    logSuccess('vocab', `Client export complete: ${words.length} words as ${options.format.toUpperCase()}`);
    return filename;
  };

  const recordExport = (filename: string, source: 'server' | 'client') => {
    setRecentExports(prev =>
      [{ format: options.format, filename, date: new Date().toLocaleString(), source }, ...prev].slice(0, 5)
    );
    setExportComplete(true);
    setTimeout(() => setExportComplete(false), 3000);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportComplete(false);
    logInfo('vocab', `Export started (format=${options.format}, scope=${options.scope}, lang=${options.language})`);

    const serverOptions: VocabExportOptions = {
      language: options.language || undefined,
      limit: Math.min(Math.max(1, options.limit || 1), MAX_EXPORT_LIMIT),
      include_phonetics: options.includePhonetics,
      include_translations: true,
      scope: options.scope,
      ...(options.scope === 'library' && options.libraryId
        ? { library_id: options.libraryId }
        : {})
    };

    try {
      const result = await api.appQyV1.exportVocabulary(SERVER_FORMAT[options.format], serverOptions);

      if (result.htmlFallback) {
        toast.info(t.export_fallback_html);
        logInfo('vocab', `PDF export delivered as printable HTML: ${result.filename}`);
      }

      recordExport(result.filename, 'server');
      toast.success(t.export_server.replace('{filename}', result.filename));
      logSuccess('vocab', `Server export complete: ${result.filename} (${options.format.toUpperCase()})`);
    } catch (error: any) {
      if (error?.status === 404) {
        // Endpoint not deployed yet — fall back to the in-browser exporter.
        logWarn('vocab', 'Server export endpoint missing (404) — falling back to client-side export');
        toast.warning(t.export_fallback_client);
        try {
          const filename = await runClientExport();
          if (filename) {
            recordExport(filename, 'client');
            toast.success(t.export_success);
          }
        } catch (fallbackError: any) {
          console.error('Export failed:', fallbackError);
          toast.error(t.export_failed);
          logError('vocab', `Client export failed: ${fallbackError?.message || 'unknown error'}`);
        }
      } else {
        console.error('Export failed:', error);
        toast.error(error?.message || t.export_failed);
        logError('vocab', `Export failed: ${error?.message || 'unknown error'}`);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Export Vocabulary
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Download your vocabulary data in various formats
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* Format Selection */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Format
            </h3>
            <div className="space-y-3">
              {Object.entries(formatInfo).map(([format, info]) => {
                const Icon = info.icon;
                const isSelected = options.format === format;

                return (
                  <button
                    key={format}
                    onClick={() => setOptions(prev => ({ ...prev, format: format as ExportFormat }))}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-6 h-6 flex-shrink-0 ${info.color}`} />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {info.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {info.description}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope Selection */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Export Scope
            </h3>
            <div className="space-y-3">
              {Object.entries(scopeInfo).map(([scope, description]) => {
                const isSelected = options.scope === scope;

                return (
                  <label
                    key={scope}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={scope}
                      checked={isSelected}
                      onChange={(e) => setOptions(prev => ({ ...prev, scope: e.target.value as ExportScope }))}
                      className="mt-1"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
                        {scope.replace('_', ' ')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {options.scope === 'library' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Library
                </label>
                <select
                  value={options.libraryId || ''}
                  onChange={(e) => setOptions(prev => ({ ...prev, libraryId: e.target.value }))}
                  className={commonClasses.input}
                >
                  <option value="">Choose a library...</option>
                  {libraries.map(lib => (
                    <option key={String(lib.id)} value={String(lib.id)}>
                      {lib.name}
                    </option>
                  ))}
                </select>
                {libraries.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    No libraries available.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Additional Options
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Language
                  </label>
                  <select
                    value={options.language}
                    onChange={(e) => setOptions(prev => ({ ...prev, language: e.target.value }))}
                    className={commonClasses.input}
                  >
                    {languages.length === 0 && <option value="en">English (en)</option>}
                    {languages.map(l => (
                      <option key={l.code} value={l.code}>
                        {l.name}{l.native_name ? ` (${l.native_name})` : ''} — {l.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Words (≤ {MAX_EXPORT_LIMIT})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_EXPORT_LIMIT}
                    value={options.limit}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      setOptions(prev => ({
                        ...prev,
                        limit: Number.isFinite(parsed)
                          ? Math.min(Math.max(1, parsed), MAX_EXPORT_LIMIT)
                          : prev.limit
                      }));
                    }}
                    className={commonClasses.input}
                  />
                </div>
              </div>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Example Sentences
                </span>
                <input
                  type="checkbox"
                  checked={options.includeExamples}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeExamples: e.target.checked }))}
                  className="w-5 h-5"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Phonetic Transcriptions
                </span>
                <input
                  type="checkbox"
                  checked={options.includePhonetics}
                  onChange={(e) => setOptions(prev => ({ ...prev, includePhonetics: e.target.checked }))}
                  className="w-5 h-5"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Definitions
                </span>
                <input
                  type="checkbox"
                  checked={options.includeDefinitions}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeDefinitions: e.target.checked }))}
                  className="w-5 h-5"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Export Summary & Action */}
        <div className="space-y-6">
          <div className={`${commonClasses.card} p-6 sticky top-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Export Summary
            </h3>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Format:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatInfo[options.format].name.split(' ')[0]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Scope:</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {options.scope.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Language:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.language}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Max Words:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.limit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Examples:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.includeExamples ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Phonetics:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.includePhonetics ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Definitions:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.includeDefinitions ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting || (options.scope === 'library' && !options.libraryId)}
              className={`w-full ${commonClasses.button} ${
                exportComplete
                  ? 'bg-green-600 hover:bg-green-700'
                  : commonClasses.buttonPrimary
              } text-white flex items-center justify-center gap-2 py-3`}
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Exporting...
                </>
              ) : exportComplete ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Export Complete!
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Export Now
                </>
              )}
            </button>

            {options.scope === 'library' && !options.libraryId && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center">
                Please select a library to export
              </p>
            )}
          </div>

          {/* Export History (this session) */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Exports
            </h3>
            {recentExports.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No exports yet in this session.
              </p>
            ) : (
              <div className="space-y-3">
                {recentExports.map((item, index) => (
                  <div
                    key={`${item.filename}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.filename}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {item.format.toUpperCase()} • {item.date} • {item.source}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
