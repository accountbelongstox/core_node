import React, { useState, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../core/api';
import { commonClasses } from '../../styles/theme';

interface DocUploadPanelProps {
  onUploadComplete?: (result: any) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  error?: string;
  result?: any;
}

const DocUploadPanel: React.FC<DocUploadPanelProps> = ({ onUploadComplete }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [extractMode, setExtractMode] = useState<'sentences' | 'words'>('sentences');

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

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
    }
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

      try {
        setFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, progress: 50 } : f
        ));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('extract_mode', extractMode);

        const result = await api.appQyV1.uploadDocument(formData);

        setFiles(prev => prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'processing', progress: 75 }
            : f
        ));

        if (extractMode === 'sentences') {
          await api.appQyV1.extractSentences(result.data?.documentId || result.documentId);
        } else {
          await api.appQyV1.extractWords(result.data?.documentId || result.documentId);
        }

        setFiles(prev => prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'success', progress: 100, result }
            : f
        ));

        if (onUploadComplete) {
          onUploadComplete(result);
        }

      } catch (error: any) {
        setFiles(prev => prev.map(f =>
          f.id === fileId
            ? {
                ...f,
                status: 'error',
                progress: 0,
                error: error.message || 'Upload failed'
              }
            : f
        ));
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
      <div className="flex gap-4">
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="extractMode"
            value="sentences"
            checked={extractMode === 'sentences'}
            onChange={(e) => setExtractMode(e.target.value as any)}
            className="text-blue-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Extract Sentences
          </span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="extractMode"
            value="words"
            checked={extractMode === 'words'}
            onChange={(e) => setExtractMode(e.target.value as any)}
            className="text-blue-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Extract Words
          </span>
        </label>
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
          accept=".txt,.pdf,.doc,.docx"
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
            Supported formats: TXT, PDF, DOC, DOCX
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
                {file.status === 'uploading' || file.status === 'processing' ? (
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
                {(file.status === 'uploading' || file.status === 'processing') && (
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
                  {file.status === 'processing' && 'Processing...'}
                  {file.status === 'success' && 'Upload complete'}
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
