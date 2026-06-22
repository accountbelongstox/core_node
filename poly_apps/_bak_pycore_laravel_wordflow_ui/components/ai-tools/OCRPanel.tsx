import React, { useState, useRef, useEffect } from 'react';
import {
  FileImage,
  Upload,
  RefreshCw,
  Copy,
  Check,
  Download,
  Trash2,
  Image as ImageIcon,
  FileText,
  Languages,
  Eye
} from 'lucide-react';
import { api } from '../../core/api';
import { commonClasses } from '../../styles/theme';
import BentoCard from '../BentoCard';

interface OCRPanelProps {
  onExtractionComplete?: (result: any) => void;
}

interface OCRResult {
  id: string;
  imageUrl: string;
  extractedText: string;
  language?: string;
  confidence?: number;
  timestamp: number;
  fileName?: string;
}

const OCRPanel: React.FC<OCRPanelProps> = ({ onExtractionComplete }) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageUrl, setImageUrl] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [language, setLanguage] = useState('auto');
  const [history, setHistory] = useState<OCRResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const saved = localStorage.getItem('ocr_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    }
  };

  const saveToHistory = (item: Omit<OCRResult, 'id' | 'timestamp'>) => {
    const newItem: OCRResult = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now()
    };
    const newHistory = [newItem, ...history.slice(0, 19)]; // Keep last 20
    setHistory(newHistory);
    localStorage.setItem('ocr_history', JSON.stringify(newHistory));
  };

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

    setLoading(true);
    setExtractedText('');

    try {
      let response;

      if (uploadMode === 'file' && selectedImage) {
        // Upload screenshot first
        const uploadResponse = await api.mcpV1.uploadScreenshot({
          image: selectedImage,
          description: 'OCR extraction'
        });

        if (uploadResponse.success && uploadResponse.data) {
          // Simulate OCR extraction
          // In a real implementation, this would call an OCR API endpoint
          const mockExtractedText = `Extracted text from ${selectedImage.name}

This is a placeholder for OCR functionality.
The actual OCR extraction would happen on the backend using services like:
- Tesseract OCR
- Google Cloud Vision API
- AWS Textract
- Azure Computer Vision

The extracted text would appear here with high accuracy.`;

          setExtractedText(mockExtractedText);

          saveToHistory({
            imageUrl: imagePreview,
            extractedText: mockExtractedText,
            language: language === 'auto' ? 'en' : language,
            fileName: selectedImage.name,
            confidence: 0.95
          });

          onExtractionComplete?.({
            text: mockExtractedText,
            language: language
          });
        }
      } else if (uploadMode === 'url') {
        // Simulate URL-based OCR
        const mockExtractedText = `Extracted text from image URL

This is a placeholder for URL-based OCR functionality.
The actual implementation would:
1. Download the image from the URL
2. Process it through an OCR engine
3. Return the extracted text

Image URL: ${imageUrl}`;

        setExtractedText(mockExtractedText);

        saveToHistory({
          imageUrl: imageUrl,
          extractedText: mockExtractedText,
          language: language === 'auto' ? 'en' : language,
          confidence: 0.92
        });

        onExtractionComplete?.({
          text: mockExtractedText,
          language: language
        });
      }
    } catch (error) {
      console.error('OCR extraction failed:', error);
      setExtractedText('Extraction failed. Please try again.');
    } finally {
      setLoading(false);
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

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('ocr_history');
  };

  const loadFromHistory = (item: OCRResult) => {
    setImagePreview(item.imageUrl);
    setExtractedText(item.extractedText);
    setUploadMode('url');
    setImageUrl(item.imageUrl);
    setShowHistory(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
            <FileImage className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold truncate">OCR - Optical Character Recognition</h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
              Extract text from images using AI
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 flex-shrink-0`}
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">History</span> ({history.length})
        </button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <BentoCard title="Extraction History">
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No history yet</p>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                </div>
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors flex items-start gap-3"
                  >
                    <img
                      src={item.imageUrl}
                      alt="OCR"
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 mb-1">
                        {item.fileName || 'Image'} • {new Date(item.timestamp).toLocaleString()}
                        {item.confidence && ` • ${Math.round(item.confidence * 100)}% confidence`}
                      </p>
                      <p className="text-sm truncate">{item.extractedText}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </BentoCard>
      )}

      {/* Upload Mode Selection */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setUploadMode('file')}
          className={`${commonClasses.button} ${
            uploadMode === 'file' ? commonClasses.buttonPrimary : commonClasses.buttonSecondary
          }`}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload File
        </button>
        <button
          onClick={() => setUploadMode('url')}
          className={`${commonClasses.button} ${
            uploadMode === 'url' ? commonClasses.buttonPrimary : commonClasses.buttonSecondary
          }`}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          Image URL
        </button>
      </div>

      {/* Upload Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Image Input */}
        <BentoCard title="Image Source">
          {uploadMode === 'file' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="space-y-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded"
                  />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
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
                className={commonClasses.input}
              />
              {imageUrl && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded"
                    onError={(e) => {
                      e.currentTarget.src = '';
                      e.currentTarget.alt = 'Failed to load image';
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </BentoCard>

        {/* Extracted Text */}
        <BentoCard
          title="Extracted Text"
          headerControls={
            extractedText && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
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
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            )
          }
        >
          <div className={`${commonClasses.textarea} h-80 overflow-auto bg-slate-50 dark:bg-slate-800`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Extracting text from image...
                  </p>
                </div>
              </div>
            ) : extractedText ? (
              <p className="whitespace-pre-wrap">{extractedText}</p>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 text-center">
                  Extracted text will appear here
                </p>
              </div>
            )}
          </div>
        </BentoCard>
      </div>

      {/* Settings */}
      <BentoCard title="OCR Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={commonClasses.select}
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
          </div>
        </div>
      </BentoCard>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleExtract}
          disabled={
            loading ||
            (uploadMode === 'file' && !selectedImage) ||
            (uploadMode === 'url' && !imageUrl.trim())
          }
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} px-8 flex items-center gap-2`}
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
        <button
          onClick={handleClear}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
        >
          Clear
        </button>
      </div>

      {/* Tips */}
      <BentoCard title="Tips" className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
        <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <Eye className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600" />
            <span>Best results with clear, high-contrast images</span>
          </li>
          <li className="flex items-start gap-2">
            <Languages className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600" />
            <span>Supports multiple languages - select the appropriate one for better accuracy</span>
          </li>
          <li className="flex items-start gap-2">
            <ImageIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600" />
            <span>Works with screenshots, scanned documents, photos of text, and more</span>
          </li>
        </ul>
      </BentoCard>
    </div>
  );
};

export default OCRPanel;
