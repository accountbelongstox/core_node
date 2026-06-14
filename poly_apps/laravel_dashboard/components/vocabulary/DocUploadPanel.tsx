import React, { useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../core/api';
import { commonClasses } from '../../styles/theme';
import { TRANSLATIONS } from '../../constants';
import { useAppState } from '../../contexts/AppStateContext';
import { useToast } from '../admin';
import { logError, logInfo, logSuccess, logWarn } from '../../core/logs/logStore';

interface DocUploadPanelProps {
  onUploadComplete?: (result: any) => void;
}

type ExtractMode = 'none' | 'words' | 'sentences';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'extracting' | 'success' | 'error';
  progress: number;
  error?: string;
  /** Human-readable outcome shown under the file name (e.g. extraction counts). */
  summary?: string;
  result?: any;
}

/** File extensions whose content can safely be read as plain text in-browser. */
const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'text'];

const isTextFile = (file: File): boolean => {
  if (file.type && file.type.startsWith('text/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return TEXT_EXTENSIONS.includes(ext);
};

const DocUploadPanel: React.FC<DocUploadPanelProps> = ({ onUploadComplete }) => {
  const { lang } = useAppState();
  const toast = useToast();
  const t = TRANSLATIONS[lang].vocabulary;
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [extractMode, setExtractMode] = useState<ExtractMode>('none');

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from<File>(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from<File>(e.target.files);
      processFiles(selectedFiles);
    }
  };

  const updateFile = (fileId: string, patch: Partial<UploadedFile>) => {
    setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, ...patch } : f)));
  };

  /** "+{n} added, {m} skipped" via the i18n template. */
  const formatCounts = (added: number, skipped: number): string =>
    t.extract_done.replace('{added}', String(added)).replace('{skipped}', String(skipped));

  /**
   * Run the post-upload extraction step for one document. Returns the summary
   * line to show on the file row, or throws on failure (401/403 handled here
   * with the login-required toast).
   */
  const runExtraction = async (
    mode: Exclude<ExtractMode, 'none'>,
    documentId: string | number,
    fileName: string
  ): Promise<string> => {
    logInfo('vocab', `Extraction started (${mode}) for document ${documentId} (${fileName})`);

    const response = mode === 'words'
      ? await api.appQyV1.extractWords(documentId)
      : await api.appQyV1.extractSentences(documentId);

    if (!response.success || !response.data) {
      if (response.status === 401 || response.status === 403) {
        toast.error(t.login_required);
      }
      throw new Error(response.error || t.extract_failed);
    }

    const data: any = response.data;
    const added = Number(mode === 'words' ? data.added : data.stored) || 0;
    const skipped = Number(data.skipped) || 0;
    const total = Number(mode === 'words' ? data.words_total : data.sentences_total) || 0;

    const summary = `${mode === 'words' ? 'Words' : 'Sentences'}: ${formatCounts(added, skipped)} (total ${total})`;
    logSuccess('vocab', `Extraction complete (${mode}) for ${fileName}: +${added} added, ${skipped} skipped, ${total} total`);
    return summary;
  };

  const processFiles = async (filesToProcess: File[]) => {
    const newFiles: UploadedFile[] = filesToProcess.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const fileId = newFiles[i].id;

      logInfo('vocab', `Upload started: ${file.name} (${formatFileSize(file.size)})`);

      try {
        updateFile(fileId, { progress: 40 });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('extract_mode', extractMode);
        // The current /learning/upload validator expects the document TEXT
        // plus collection metadata (`document`, `collection_name`,
        // `lang_code`). For text-readable files we provide them alongside the
        // raw file so both the current and the multipart-aware backend accept
        // the request. Binary formats (pdf/doc/docx) rely on server-side
        // parsing of `file`.
        formData.append('collection_name', file.name.replace(/\.[^.]+$/, '') || file.name);
        formData.append('lang_code', 'en');
        if (isTextFile(file)) {
          formData.append('document', await file.text());
        }

        const result = await api.appQyV1.uploadDocument(formData);

        // BaseAPI resolves (never throws) on HTTP errors — surface them
        // instead of silently marking the row as a success.
        if (!result || result.success === false) {
          if (result && (result.status === 401 || result.status === 403)) {
            toast.error(t.login_required);
          }
          throw new Error((result && result.error) || 'Upload failed');
        }

        const data: any = result.data || {};
        const documentId = data.document_id;

        if (extractMode === 'none') {
          updateFile(fileId, { status: 'success', progress: 100, result });
          toast.success(`${t.upload_success}: ${file.name}`);
          logSuccess('vocab', `Upload complete: ${file.name}`);
        } else if (documentId === undefined || documentId === null) {
          // Older backend without the document_id in the upload response —
          // the file is saved, but extraction cannot be triggered.
          updateFile(fileId, {
            status: 'success',
            progress: 100,
            result,
            summary: t.extract_requires_update
          });
          toast.warning(t.extract_requires_update);
          logWarn('vocab', `Upload OK but no document_id returned for ${file.name} — extraction skipped`);
        } else {
          updateFile(fileId, { status: 'extracting', progress: 70 });
          try {
            const summary = await runExtraction(extractMode, documentId, file.name);
            updateFile(fileId, { status: 'success', progress: 100, result, summary });
            toast.success(`${t.upload_success}: ${file.name} — ${summary}`);
          } catch (extractError: any) {
            // The upload itself succeeded; only the extraction step failed.
            const message = extractError?.message || t.extract_failed;
            updateFile(fileId, {
              status: 'error',
              progress: 100,
              result,
              error: `${t.extract_failed}: ${message}`
            });
            toast.error(`${t.extract_failed}: ${file.name} — ${message}`);
            logError('vocab', `Extraction failed (${extractMode}) for ${file.name} — ${message}`);
            continue;
          }
        }

        if (onUploadComplete) {
          onUploadComplete(result);
        }

      } catch (error: any) {
        updateFile(fileId, {
          status: 'error',
          progress: 0,
          error: error.message || 'Upload failed'
        });
        toast.error(`${t.upload_failed}: ${file.name} — ${error.message || 'Upload failed'}`);
        logError('vocab', `Upload failed: ${file.name} — ${error.message || 'unknown error'}`);
      }
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const extractModeOptions: Array<{ value: ExtractMode; label: string }> = [
    { value: 'none', label: 'Upload Only' },
    { value: 'words', label: 'Extract Words' },
    { value: 'sentences', label: 'Extract Sentences' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Document Upload
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Upload documents to extract vocabulary for learning
          </p>
        </div>
      </div>

      {/* Extract Mode Selection */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-4">
          {extractModeOptions.map(option => (
            <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="extractMode"
                value={option.value}
                checked={extractMode === option.value}
                onChange={() => setExtractMode(option.value)}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        {extractMode !== 'none' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            After upload, the server extracts {extractMode} from the document and
            adds them to your collection automatically.
          </p>
        )}
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-12
          transition-colors duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
          }
        `}
      >
        <input
          type="file"
          multiple
          accept=".txt,.md,.csv,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center justify-center text-center">
          <Upload
            className={`w-12 h-12 mb-4 ${
              isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
            }`}
          />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Supported formats: TXT, MD, CSV, PDF, DOC, DOCX
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload Queue ({files.length})
          </h4>
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {file.status === 'uploading' || file.status === 'extracting' ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : file.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : file.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <FileText className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {formatFileSize(file.size)}
                  </span>
                </div>

                {/* Progress Bar */}
                {(file.status === 'uploading' || file.status === 'extracting') && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-1">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}

                {/* Status Text */}
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {file.status === 'uploading' && 'Uploading...'}
                  {file.status === 'extracting' && t.extracting}
                  {file.status === 'success' && (file.summary || 'Upload complete')}
                  {file.status === 'error' && (file.error || 'Upload failed')}
                </p>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => removeFile(file.id)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocUploadPanel;
