import React, { useState, useEffect } from 'react';
import { Upload, Play, Wand2, Image, Copy, Eye } from 'lucide-react';
import { Language, AsyncState } from '../../../types';
import { api } from '@/apps/laravel-manager/api';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, InlineSpinner, AlertBox, Field, EmptyState } from '../../common';
import { useClipboard } from '../../../hooks/useClipboard';

/**
 * MCP OCR tab — self-contained: owns its own engine/image/result state, loads
 * engines on mount and engine-info on selection, single + batch recognition.
 * Extracted from MCPManager so the manager is a thin tab-switcher.
 */
const OcrTab: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].mcp;
  const { copy } = useClipboard();
  const copyToClipboard = (text: string): void => {
    void copy(text, t.screenshots.toast.copied);
  };

  // OCR State
  const [ocrEngines, setOcrEngines] = useState<AsyncState<any[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedEngine, setSelectedEngine] = useState<string>('paddleocr');
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrBatchImages, setOcrBatchImages] = useState<File[]>([]);
  const [ocrBatchResults, setOcrBatchResults] = useState<AsyncState<any[]>>({
    data: [],
    loading: false,
    error: null,
    status: 'idle'
  });
  const [ocrBatchPreviewUrls, setOcrBatchPreviewUrls] = useState<string[]>([]);
  const [ocrEngineInfo, setOcrEngineInfo] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });

  useEffect(() => {
    loadOcrEngines();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedEngine) {
      loadOcrEngineInfo(selectedEngine);
    }
  }, [selectedEngine]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOcrEngines = async () => {
    setOcrEngines(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getOcrEngines();
      if (response.success && response.data) {
        setOcrEngines({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.engines_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load OCR engines:', error);
      setOcrEngines({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadOcrEngineInfo = async (engine: string) => {
    setOcrEngineInfo(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.getOcrEngineInfo(engine);
      if (response.success && response.data) {
        setOcrEngineInfo({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.engine_info_load_failed);
      }
    } catch (error: any) {
      console.error('Failed to load OCR engine info:', error);
      setOcrEngineInfo({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleOcrImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setOcrImage(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setOcrPreviewUrl(url);

    // Clear previous result
    setOcrResult({
      data: null,
      loading: false,
      error: null,
      status: 'idle'
    });
  };

  const handleOcrRecognize = async () => {
    if (!ocrImage) return;

    setOcrResult(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.ocrRecognize({
        image: ocrImage,
        engine: selectedEngine
      });

      if (response.success && response.data) {
        setOcrResult({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.recognize_failed);
      }
    } catch (error: any) {
      console.error('OCR recognition failed:', error);
      setOcrResult({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleOcrSmartRecognize = async () => {
    if (!ocrImage) return;

    setOcrResult(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.ocrSmartRecognize({ image: ocrImage });

      if (response.success && response.data) {
        setOcrResult({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.smart_recognize_failed);
      }
    } catch (error: any) {
      console.error('Smart OCR recognition failed:', error);
      setOcrResult({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleOcrBatchImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    setOcrBatchImages(filesArray);

    // Create preview URLs
    const urls = filesArray.map(file => URL.createObjectURL(file));
    setOcrBatchPreviewUrls(urls);

    // Clear previous results
    setOcrBatchResults({
      data: [],
      loading: false,
      error: null,
      status: 'idle'
    });
  };

  const handleOcrBatchRecognize = async () => {
    if (ocrBatchImages.length === 0) return;

    setOcrBatchResults(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.mcpV1.ocrBatch({ images: ocrBatchImages });

      if (response.success && response.data) {
        setOcrBatchResults({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || t.ocr.batch_recognize_failed);
      }
    } catch (error: any) {
      console.error('Batch OCR recognition failed:', error);
      setOcrBatchResults({
        data: [],
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Upload Panel */}
      <div className={`w-96 ${commonClasses.card} p-4 overflow-y-auto`}>
        <h3 className="font-semibold mb-4">{t.ocr.title}</h3>

        <div className="space-y-4">
          {/* Engine Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">{t.ocr.engine}</label>
            {ocrEngines.loading ? (
              <LoadingBlock label="" className="py-4" />
            ) : (
              <select
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value)}
                className={commonClasses.input}
              >
                <option value="paddleocr">PaddleOCR</option>
                <option value="tesseract">Tesseract</option>
                <option value="easyocr">EasyOCR</option>
              </select>
            )}

            {/* Engine Info */}
            {ocrEngineInfo.loading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <InlineSpinner />
                {t.ocr.loading_engine_info}
              </div>
            )}
            {ocrEngineInfo.data && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-sm space-y-1">
                  {ocrEngineInfo.data.description && (
                    <p className="text-slate-700 dark:text-slate-300">{ocrEngineInfo.data.description}</p>
                  )}
                  {ocrEngineInfo.data.accuracy && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t.ocr.accuracy_label}</span> {ocrEngineInfo.data.accuracy}
                    </p>
                  )}
                  {ocrEngineInfo.data.supported_languages && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t.ocr.languages_label}</span> {
                        Array.isArray(ocrEngineInfo.data.supported_languages)
                          ? ocrEngineInfo.data.supported_languages.join(', ')
                          : ocrEngineInfo.data.supported_languages
                      }
                    </p>
                  )}
                  {ocrEngineInfo.data.speed && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t.ocr.speed_label}</span> {ocrEngineInfo.data.speed}
                    </p>
                  )}
                </div>
              </div>
            )}
            {ocrEngineInfo.error && (
              <AlertBox variant="error" className="mt-2">{ocrEngineInfo.error}</AlertBox>
            )}
          </div>

          {/* Image Upload */}
          <Field label={t.ocr.upload_image}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleOcrImageSelect(e.target.files)}
              className="hidden"
              id="ocr-image-upload"
            />
            <label
              htmlFor="ocr-image-upload"
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} w-full flex items-center justify-center gap-2 cursor-pointer`}
            >
              <Upload className="w-4 h-4" />
              {t.ocr.choose_image}
            </label>
          </Field>

          {/* Preview */}
          {ocrPreviewUrl && (
            <Field label={t.ocr.preview}>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <img
                  src={ocrPreviewUrl}
                  alt={t.ocr.preview_alt}
                  className="w-full h-auto max-h-64 object-contain bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </Field>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleOcrRecognize}
              disabled={!ocrImage || ocrResult.loading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {ocrResult.loading ? (
                <InlineSpinner />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {t.ocr.recognize}
            </button>
            <button
              onClick={handleOcrSmartRecognize}
              disabled={!ocrImage || ocrResult.loading}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
              title={t.ocr.smart_recognize_title}
            >
              <Wand2 className="w-4 h-4" />
            </button>
          </div>

          {/* Batch Upload */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
            <h4 className="text-sm font-semibold mb-3">{t.ocr.batch_recognition}</h4>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleOcrBatchImageSelect(e.target.files)}
              className="hidden"
              id="ocr-batch-upload"
            />
            <label
              htmlFor="ocr-batch-upload"
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} w-full flex items-center justify-center gap-2 cursor-pointer mb-3`}
            >
              <Upload className="w-4 h-4" />
              {t.ocr.choose_multiple_images}
            </label>

            {ocrBatchImages.length > 0 && (
              <>
                <div className="text-xs text-slate-500 mb-2">
                  {t.ocr.selected_prefix} {ocrBatchImages.length} {t.ocr.selected_suffix}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {ocrBatchPreviewUrls.slice(0, 6).map((url, index) => (
                    <div key={index} className="aspect-square border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
                      <img
                        src={url}
                        alt={`${t.ocr.image_label} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  {ocrBatchImages.length > 6 && (
                    <div className="aspect-square border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                      <span className="text-xs text-slate-500">+{ocrBatchImages.length - 6}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleOcrBatchRecognize}
                  disabled={ocrBatchResults.loading}
                  className={`${commonClasses.button} ${commonClasses.buttonPrimary} w-full flex items-center justify-center gap-2`}
                >
                  {ocrBatchResults.loading ? (
                    <InlineSpinner />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {t.ocr.batch_recognize}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Result Panel */}
      <div className={`flex-1 ${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
        <h3 className="font-semibold mb-4">
          {ocrBatchResults.data && ocrBatchResults.data.length > 0 ? t.ocr.batch_results : t.ocr.recognition_result}
        </h3>

        {/* Batch Results */}
        {ocrBatchResults.data && ocrBatchResults.data.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {ocrBatchResults.data.map((result: any, index: number) => (
              <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium">{t.ocr.image_label} {index + 1}</span>
                  {result.engine && (
                    <span className="text-xs text-slate-500">({result.engine})</span>
                  )}
                </div>
                {result.text ? (
                  <div className="space-y-2">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded text-sm">
                      {result.text}
                    </div>
                    {result.confidence && (
                      <div className="text-xs text-slate-500">
                        {t.ocr.confidence_label} {(result.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                    <button
                      onClick={() => copyToClipboard(result.text)}
                      className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-xs flex items-center gap-1`}
                    >
                      <Copy className="w-3 h-3" />
                      {t.common.copy}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {result.error || t.ocr.no_text_detected}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Single Result (keep existing) */}
        {(!ocrBatchResults.data || ocrBatchResults.data.length === 0) && ocrResult.data && (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-4">
              <div className="text-sm whitespace-pre-wrap">{ocrResult.data.text || t.ocr.no_text_detected}</div>
            </div>
            {ocrResult.data.confidence && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">{t.ocr.confidence_label}</span>
                  <span className="font-medium">{(ocrResult.data.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${ocrResult.data.confidence * 100}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={() => copyToClipboard(ocrResult.data?.text || '')}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <Copy className="w-4 h-4" />
              {t.ocr.copy_text}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!ocrResult.data && (!ocrBatchResults.data || ocrBatchResults.data.length === 0) && (
          <EmptyState icon={Eye} className="flex-1" title={t.ocr.no_result} message={t.ocr.no_result_hint} />
        )}

        {/* Error State */}
        {(ocrResult.error || ocrBatchResults.error) && (
          <AlertBox variant="error">{ocrResult.error || ocrBatchResults.error}</AlertBox>
        )}
      </div>
    </div>
  );
};

export default OcrTab;
