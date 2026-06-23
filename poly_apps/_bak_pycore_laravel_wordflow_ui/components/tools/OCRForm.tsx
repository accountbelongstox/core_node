import React, { useState, useRef } from 'react';
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
import { useToolModel } from '../../hooks';
import { AI_TOOLS } from '../../config/tools.config';
import ToolWrapper from '../universal/ToolWrapper';
import HistoryList from '../universal/HistoryList';
import { commonClasses } from '../../styles/theme';
import {
  AI_BODY,
  AI_GRID_2,
  AiBentoCard,
  AiToolActions,
  AiToolAlert,
  AiToolField,
  AiToolSegment,
  AiToolTips,
} from '../ai-tools/ui';

const OCRForm: React.FC = () => {
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
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [language, setLanguage] = useState('auto');
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

    try {
      const input = uploadMode === 'file'
        ? { image: selectedImage, description: 'OCR extraction' }
        : { image: imageUrl, description: 'OCR extraction' };

      const result = await execute(input);

      const recognized =
        result?.text ?? result?.result ?? result?.data?.text ?? '';
      if (recognized) {
        setExtractedText(recognized);
      } else {
        setExtractedText('No text was recognized in this image.');
      }
    } catch (err) {
      console.error('OCR extraction failed:', err);
      setExtractedText('Extraction failed. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (extractedText) {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (extractedText) {
      const blob = new Blob([extractedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ocr_result_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setImagePreview('');
    setImageUrl('');
    setExtractedText('');
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
            { id: 'file', label: 'Upload File', icon: Upload },
            { id: 'url', label: 'Image URL', icon: ImageIcon },
          ]}
        />

        <div className={`${AI_GRID_2} lg:grid-cols-2`}>
          <AiBentoCard title="Image Source">
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
                      alt="Preview"
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
                      Drop an image here or click to browse
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports JPG, PNG, GIF, WebP
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
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = '';
                        e.currentTarget.alt = 'Failed to load image';
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </AiBentoCard>

          <AiBentoCard
            title="Extracted Text"
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
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Download
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
                      Extracting text from image...
                    </p>
                  </div>
                </div>
              ) : extractedText ? (
                <p className="whitespace-pre-wrap">{extractedText}</p>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[240px]">
                  <p className="text-slate-400 text-center">
                    Extracted text will appear here
                  </p>
                </div>
              )}
            </div>
          </AiBentoCard>
        </div>

        <AiBentoCard title="OCR Settings">
          <AiToolField label="Language">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`${commonClasses.input} w-full max-w-md`}
            >
              <option value="auto">Auto Detect</option>
              <option value="en">English</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ar">Arabic</option>
            </select>
          </AiToolField>
        </AiBentoCard>

        <AiToolActions>
          <button
            onClick={handleClear}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <Eraser className="w-4 h-4" />
            Clear
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
                Extracting...
              </>
            ) : (
              <>
                <FileImage className="w-4 h-4" />
                Extract Text
              </>
            )}
          </button>
        </AiToolActions>

        {error && <AiToolAlert>{error}</AiToolAlert>}

        <AiToolTips
          accent="amber"
          items={[
            { icon: Eye, text: 'Best results with clear, high-contrast images' },
            { icon: Languages, text: 'Supports multiple languages - select the appropriate one for better accuracy' },
            { icon: ImageIcon, text: 'Works with screenshots, scanned documents, photos of text, and more' },
          ]}
        />
      </div>
    </ToolWrapper>
  );
};

export default OCRForm;
