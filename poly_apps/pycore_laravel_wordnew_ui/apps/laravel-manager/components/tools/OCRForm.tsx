import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileImage,
  Upload,
  RefreshCw,
  Copy,
  Check,
  Download,
  Eye,
  Languages,
  Image as ImageIcon,
  Eraser
} from 'lucide-react';
import { useToolModel, useClipboard } from '@/apps/laravel-manager/hooks';
import { AI_TOOLS } from '@/apps/laravel-manager/config/tools.config';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import HistoryList from '../universal/HistoryList';
import { commonClasses } from '@/shared/styles/theme';
import { api } from '@/apps/laravel-manager/api';
import { offerBlobFile } from '@/core/browser/FileDownload';
import {
  AI_BODY,
  AI_GRID_2,
  AiBentoCard,
  AiToolActions,
  AiToolAlert,
  AiToolSegment,
  AiToolTips,
} from '@/shared/ui/AiToolUi';

const OCRForm: React.FC = () => {
  const { t } = useTranslation();
  const config = AI_TOOLS.ocr;
  const {
    execute,
    loading,
    error,
    history,
    isFavorite,
    toggleFavorite,
    clearError
  } = useToolModel(config);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageUrl, setImageUrl] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [ocrNotice, setOcrNotice] = useState('');
  const { copy } = useClipboard();
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  // Recognition model hint forwarded to the backend `model_type` field
  // (general|scene|doc|number|english|chinese_traditional); defaults to general.
  const [modelType, setModelType] = useState('general');
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      setExtractedText('');
      setOcrNotice('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      setExtractedText('');
      setOcrNotice('');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleExtract = async () => {
    if (uploadMode === 'file' && !selectedImage) return;
    if (uploadMode === 'url' && !imageUrl.trim()) return;

    clearError();
    setExtractedText('');
    setOcrNotice('');

    try {
      // The OCR backend (/api/mcp/v1/ocr/recognize) requires a multipart file
      // upload — a raw URL string in the `image` field fails its file
      // validation. For URL mode, fetch the remote image into a File first so a
      // real binary reaches the endpoint.
      let imageFile: File | null = selectedImage;
      if (uploadMode === 'url') {
        const response = await api.http.rawRequest(imageUrl.trim(), { method: 'GET' }, false);
        if (!response.ok) {
          setOcrNotice(t('uiTools.ocr.error_url_load'));
          return;
        }
        const blob = await response.blob();
        const inferredName = imageUrl.split('/').pop()?.split('?')[0] || 'image';
        imageFile = new File([blob], inferredName, {
          type: blob.type || 'image/png',
        });
      }

      if (!imageFile) return;

      const result = await execute({ image: imageFile, model_type: modelType });

      const recognized =
        result?.text ?? result?.result ?? result?.data?.text ?? '';
      if (recognized) {
        setExtractedText(recognized);
      } else {
        setOcrNotice(t('uiTools.ocr.error_no_text'));
      }
    } catch (err) {
      console.error('OCR extraction failed:', err);
      setOcrNotice(t('uiTools.ocr.error_extraction_failed'));
    }
  };

  const handleCopy = async () => {
    if (extractedText && await copy(extractedText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (extractedText) {
      offerBlobFile(`ocr_result_${Date.now()}.txt`, new Blob([extractedText], { type: 'text/plain' }));
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setImagePreview('');
    setImageUrl('');
    setExtractedText('');
    setOcrNotice('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <ToolWrapper
      title={config.name}
      icon={FileImage}
      gradient="orange-red"
      description={config.description}
      favorites={config.favorites}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      showHistory={showHistory}
      onToggleHistory={() => setShowHistory(!showHistory)}
      history={<HistoryList items={history} />}
    >
      <div className={AI_BODY}>
        <AiToolSegment
          value={uploadMode}
          onChange={(id) => setUploadMode(id as 'file' | 'url')}
          options={[
            { id: 'file', label: t('uiTools.ocr.upload_file'), icon: Upload },
            { id: 'url', label: t('uiTools.ocr.image_url'), icon: ImageIcon },
          ]}
        />

        <AiBentoCard title={t('uiTools.ocr.recognition_model')}>
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
            className={`${commonClasses.input} w-full`}
          >
            <option value="general">{t('uiTools.ocr.model_general')}</option>
            <option value="scene">{t('uiTools.ocr.model_scene')}</option>
            <option value="doc">{t('uiTools.ocr.model_doc')}</option>
            <option value="number">{t('uiTools.ocr.model_number')}</option>
            <option value="english">{t('uiTools.ocr.model_english')}</option>
            <option value="chinese_traditional">{t('uiTools.ocr.model_chinese_traditional')}</option>
          </select>
        </AiBentoCard>

        <div className={`${AI_GRID_2} lg:grid-cols-2`}>
          <AiBentoCard title={t('uiTools.ocr.image_source')}>
            {uploadMode === 'file' ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-200 dark:border-slate-600/80 rounded-xl p-8 text-center
                  hover:border-amber-400/70 dark:hover:border-amber-400/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/10
                  transition-all duration-200 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={imagePreview}
                      alt={t('uiTools.ocr.preview')}
                      className="max-h-64 mx-auto rounded-lg shadow-sm"
                    />
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                      {selectedImage?.name}
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                    <p className="text-slate-600 dark:text-slate-400 mb-2">
                      {t('uiTools.ocr.drop_hint')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('uiTools.ocr.supported_formats')}
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className={`${commonClasses.input} w-full`}
                />
                {imageUrl && (
                  <div className="border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <img
                      src={imageUrl}
                      alt={t('uiTools.ocr.preview')}
                      className="max-h-64 mx-auto rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = '';
                        e.currentTarget.alt = t('uiTools.ocr.image_load_failed');
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </AiBentoCard>

          <AiBentoCard
            title={t('uiTools.ocr.extracted_text')}
            headerControls={
              extractedText ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        {t('uiTools.common.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        {t('uiTools.common.copy')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    {t('uiTools.common.download')}
                  </button>
                </div>
              ) : undefined
            }
          >
            <div className={`${commonClasses.input} min-h-[280px] overflow-auto bg-slate-50/80 dark:bg-slate-800/50`}>
              {loading ? (
                <div className="flex items-center justify-center h-full min-h-[240px]">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t('uiTools.ocr.extracting_progress')}
                    </p>
                  </div>
                </div>
              ) : extractedText ? (
                <p className="whitespace-pre-wrap">{extractedText}</p>
              ) : ocrNotice ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">{ocrNotice}</p>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[240px]">
                  <p className="text-slate-400 text-center">
                    {t('uiTools.ocr.output_placeholder')}
                  </p>
                </div>
              )}
            </div>
          </AiBentoCard>
        </div>

        <AiToolActions>
          <button
            onClick={handleClear}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <Eraser className="w-4 h-4" />
            {t('uiTools.common.clear')}
          </button>
          <button
            onClick={handleExtract}
            disabled={
              loading ||
              (uploadMode === 'file' && !selectedImage) ||
              (uploadMode === 'url' && !imageUrl.trim())
            }
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} px-8 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t('uiTools.ocr.extracting')}
              </>
            ) : (
              <>
                <FileImage className="w-4 h-4" />
                {t('uiTools.ocr.extract_text')}
              </>
            )}
          </button>
        </AiToolActions>

        {error && <AiToolAlert>{error}</AiToolAlert>}

        <AiToolTips
          accent="amber"
          items={[
            { icon: Eye, text: t('uiTools.ocr.tip_clear_images') },
            { icon: Languages, text: t('uiTools.ocr.tip_languages') },
            { icon: ImageIcon, text: t('uiTools.ocr.tip_sources') },
          ]}
        />
      </div>
    </ToolWrapper>
  );
};

export default OCRForm;
