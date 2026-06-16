/* [v4.1-Iris] Documents Upload — ported from qy_capacitor/pages/Documents/Upload.tsx.
 * Self-contained: react-router useNavigate + wfPath() for nav. Drag-and-drop /
 * click upload of PDF/DOC/DOCX/TXT, validated client-side, posted to the backend
 * via wordflowApi.request() (multipart). The original used ApiCenter.documents
 * with an onProgress callback; fetch has no native upload-progress, so we show an
 * indeterminate-style processing bar. Every call is try/caught; never crashes.
 * Format filter uses the shared ds-pill-nav. Faithful Iris look. */
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Camera, Link2 } from 'lucide-react';
import { Card, Button, BackButton, ProgressBar, Badge } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

const FORMAT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pdf', label: 'PDF' },
  { id: 'doc', label: 'DOC' },
  { id: 'txt', label: 'TXT' },
];

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_SIZE = 10 * 1024 * 1024;

const WfDocumentsUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const { learningLanguage } = useWfApp();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formatFilter, setFormatFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(15);
    setError('');
    setNotice('');

    // fetch() has no native upload-progress event; nudge the bar so the user has
    // feedback while the request is in flight.
    const ticker = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 8 : p));
    }, 400);

    try {
      // Bugfix: the old '/documents/upload' endpoint does not exist. The real
      // route is POST /learning/upload (AppQyV1VocabularyUploadController::
      // uploadDocument), which validates `document` (the text content, a
      // string — not a file part), `collection_name` and a 2-letter
      // `lang_code` (+ optional `description`).
      const text = await file.text();
      const form = new FormData();
      form.append('document', text);
      form.append('collection_name', file.name.replace(/\.[^.]+$/, '') || file.name);
      form.append('lang_code', (learningLanguage || 'en').slice(0, 2));
      const result = await wordflowApi.uploadDocument(form);
      clearInterval(ticker);
      setProgress(100);

      const wordCount = result?.word_count ?? result?.words?.length ?? 0;
      setNotice(
        result?.message ||
          `${t('upload.success') || 'Document processed successfully'}! ${wordCount} ${t('upload.wordsExtracted') || 'words extracted'}.`
      );
      setTimeout(() => {
        setUploading(false);
        navigate(wfPath('courses'));
      }, 700);
    } catch (err: any) {
      clearInterval(ticker);
      console.error('[WfDocumentsUpload] Upload error:', err);
      setError(err?.message || t('upload.error') || 'An error occurred during upload');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('upload.invalidFileType') || 'Invalid file type. Please upload PDF, DOC, DOCX, or TXT files.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t('upload.fileTooLarge') || 'File is too large. Maximum size is 10MB.');
      return;
    }
    setSelectedFile(file);
    setError('');
    handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const acceptAttr =
    formatFilter === 'all'
      ? '.pdf,.doc,.docx,.txt'
      : formatFilter === 'pdf'
        ? '.pdf'
        : formatFilter === 'doc'
          ? '.doc,.docx'
          : '.txt';

  return (
    <div
      className="ds-page h-full flex flex-col animate-slide-up"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* App header */}
      <div className="flex items-center gap-3 mb-5 pt-1">
        <BackButton onClick={() => navigate(wfPath('courses'))} />
        <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
          {t('upload.title') || 'Upload Document'}
        </h1>
      </div>

      {/* Format filter pill nav */}
      <div className="ds-pill-nav mb-5" role="tablist" aria-label={t('upload.formatFilter') || 'Format filter'}>
        {FORMAT_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={formatFilter === f.id}
            onClick={() => setFormatFilter(f.id)}
            className={`ds-pill-chip ${formatFilter === f.id ? 'is-active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-4 rounded-[var(--radius-card)] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Success / notice banner */}
      {notice && !error && (
        <div className="mb-5 p-4 rounded-[var(--radius-card)] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          {notice}
        </div>
      )}

      {/* Drop zone — main upload target */}
      <div className="flex-1 flex flex-col justify-center ds-section-gap">
        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label={t('upload.dropAria') || 'Upload a document'}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
          className={[
            'ds-card !rounded-[28px] border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer',
            isDragging
              ? 'border-[var(--klein-blue)] bg-[var(--klein-blue-soft)] scale-[1.02]'
              : 'border-[var(--border-highlight)]',
            uploading ? 'opacity-60 pointer-events-none' : 'hover:border-[var(--klein-blue)]',
          ].join(' ')}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {/* Gradient icon tile */}
          <div
            className="w-20 h-20 rounded-[24px] flex items-center justify-center mb-5 text-white"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <FileText className="w-9 h-9" aria-hidden />
          </div>

          <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            {uploading ? t('upload.processing') || 'Processing…' : t('upload.dropHere') || 'Drop your file here'}
          </h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-xs mx-auto leading-relaxed">
            {t('upload.description') || 'Upload a PDF, Word, or text document to extract vocabulary.'}
          </p>
          {!uploading && (
            <p className="text-[var(--color-text-tertiary)] text-xs mt-4">
              {t('upload.clickToSelect') || 'or click to browse your files'}
            </p>
          )}
          {selectedFile && !uploading && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
              <FileText className="w-4 h-4" aria-hidden /> {selectedFile.name}
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="ds-card !p-5">
            <div className="flex justify-between text-xs font-bold mb-2" style={{ color: 'var(--klein-blue)' }}>
              <span>{t('upload.extracting') || 'Extracting'}...</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} />
            {selectedFile && (
              <div className="mt-2 text-xs text-[var(--color-text-secondary)] text-center truncate">
                {t('upload.uploadingFile') || 'Uploading'}: {selectedFile.name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Secondary method cards */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Card className="flex flex-col items-center gap-2 !p-5 opacity-60 cursor-not-allowed select-none">
          <span className="w-12 h-12 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
            <Camera className="w-6 h-6" aria-hidden />
          </span>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('upload.cameraScan') || 'Camera Scan'}
          </span>
          <Badge tone="neutral">{t('common.comingSoon') || 'Coming soon'}</Badge>
        </Card>
        <Card className="flex flex-col items-center gap-2 !p-5 opacity-60 cursor-not-allowed select-none">
          <span className="w-12 h-12 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
            <Link2 className="w-6 h-6" aria-hidden />
          </span>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('upload.pasteLink') || 'Paste Link'}
          </span>
          <Badge tone="neutral">{t('common.comingSoon') || 'Coming soon'}</Badge>
        </Card>
      </div>

      {/* Primary action — thumb zone */}
      <div className="mt-6">
        <Button variant="grad" onClick={handleClick} disabled={uploading}>
          {uploading ? t('upload.processing') || 'Processing…' : t('upload.selectFile') || 'Select File'}
        </Button>
      </div>
    </div>
  );
};

export default WfDocumentsUploadPage;
