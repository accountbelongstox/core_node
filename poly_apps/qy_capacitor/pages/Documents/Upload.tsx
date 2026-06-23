/* [v4.1-Iris] App-style redesign + full i18n: gradient icon tile, rounded app
   drop card, ProgressBar/Badge primitives, app method cards. Format-filter
   labels + aria-labels moved to upload.* i18n keys (no hardcoded strings).
   Upload logic untouched. Verified vs public/design-reference-{light,dark}.webp. */
import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Button, BackButton, ProgressBar, Badge } from '../../components/UI';
import { FileText, Camera, Link2 } from 'lucide-react';
import { PillNav } from '../../components/PillNav';
import { ApiCenter } from '../../services/ApiCenter';
import { LanguageCenter } from '../../i18n/LanguageCenter';

const FORMAT_FILTERS = [
  { id: 'all',  labelKey: 'upload.formatAll' },
  { id: 'pdf',  labelKey: 'upload.formatPdf' },
  { id: 'doc',  labelKey: 'upload.formatDoc' },
  { id: 'txt',  labelKey: 'upload.formatTxt' },
];

const ALLOWED_TYPES: Record<string, string[]> = {
  all:  ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  pdf:  ['application/pdf'],
  doc:  ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt:  ['text/plain'],
};

const UploadPage = () => {
  const { navigate } = useContext(AppContext);
  const [isDragging, setIsDragging]       = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [progress, setProgress]           = useState(0);
  const [error, setError]                 = useState('');
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [formatFilter, setFormatFilter]   = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: string) => LanguageCenter.t(key);

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(t('upload.invalidFileType') || 'Invalid file type. Please upload PDF, DOC, DOCX, or TXT files.');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(t('upload.fileTooLarge') || 'File is too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setError('');
    handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const response = await ApiCenter.documents.upload(file, (progressPercent) => {
        setProgress(Math.round(progressPercent));
      });

      if (response.success && response.data) {
        console.log('[Upload] Upload successful:', response.data);

        setTimeout(() => {
          setUploading(false);
          alert(
            response.data.message ||
            `${t('upload.success') || 'Document processed successfully'}! ${response.data.word_count || 0} ${t('upload.wordsExtracted') || 'words extracted'}.`
          );
          navigate('courses');
        }, 500);
      } else {
        throw new Error(response.error?.message || t('upload.failed') || 'Upload failed');
      }
    } catch (err: any) {
      console.error('[Upload] Upload error:', err);
      setError(err.message || t('upload.error') || 'An error occurred during upload');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files: File[] = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /* Derive the accept attribute from the active format filter */
  const acceptAttr = formatFilter === 'all'
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
        <BackButton onClick={() => navigate('courses')} />
        <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
          {t('upload.title')}
        </h1>
      </div>

      {/* Format filter pill nav */}
      <PillNav
        items={FORMAT_FILTERS.map((f) => ({ id: f.id, label: t(f.labelKey) }))}
        activeId={formatFilter}
        onChange={setFormatFilter}
        aria-label={t('upload.formatFilter')}
        className="mb-5"
      />

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-4 rounded-[var(--radius-card)] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Drop zone — main upload target */}
      <div className="flex-1 flex flex-col justify-center ds-section-gap">
        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label={t('upload.dropAria')}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
          className={[
            'ds-card !rounded-[28px] border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer',
            isDragging
              ? 'border-[var(--klein-blue)] bg-[var(--klein-blue-soft)] scale-[1.02]'
              : 'border-[var(--border-highlight)]',
            uploading
              ? 'opacity-60 pointer-events-none'
              : 'hover:border-[var(--klein-blue)]',
          ].join(' ')}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
            {uploading ? t('upload.processing') : t('upload.dropHere')}
          </h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-xs mx-auto leading-relaxed">
            {t('upload.description')}
          </p>
          {!uploading && (
            <p className="text-[var(--color-text-tertiary,var(--color-text-secondary))] text-xs mt-4">
              {t('upload.clickToSelect')}
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
            <div
              className="flex justify-between text-xs font-bold mb-2"
              style={{ color: 'var(--klein-blue)' }}
            >
              <span>{t('upload.extracting')}...</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} />
            {selectedFile && (
              <div className="mt-2 text-xs text-[var(--color-text-secondary)] text-center truncate">
                {t('upload.uploadingFile')}: {selectedFile.name}
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
            {t('upload.cameraScan')}
          </span>
          <Badge tone="neutral">{t('common.comingSoon')}</Badge>
        </Card>
        <Card className="flex flex-col items-center gap-2 !p-5 opacity-60 cursor-not-allowed select-none">
          <span className="w-12 h-12 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
            <Link2 className="w-6 h-6" aria-hidden />
          </span>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('upload.pasteLink')}
          </span>
          <Badge tone="neutral">{t('common.comingSoon')}</Badge>
        </Card>
      </div>

      {/* Primary action — thumb zone */}
      <div className="mt-6">
        <Button
          variant="grad"
          onClick={handleClick}
          disabled={uploading}
        >
          {uploading ? t('upload.processing') : t('upload.selectFile')}
        </Button>
      </div>
    </div>
  );
};

export default UploadPage;
