import React, { useState, useRef } from 'react';
import { Upload, ScanEye, Loader2, X, FileText } from 'lucide-react';
import { ProcessingState, VisionAnalysis } from '../types';
import { analyzeImage } from '../services/geminiService';
import { VISION_PROMPT_DEFAULT } from '../constants';

const VisionMode: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState(VISION_PROMPT_DEFAULT);
  const [result, setResult] = useState<VisionAnalysis | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, error: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setProcessing({ isProcessing: false, error: null });
      } else {
        alert("Please select a valid image file.");
      }
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleAnalyze = async () => {
    if (!selectedFile || processing.isProcessing) return;

    setProcessing({ isProcessing: true, error: null });

    try {
      const base64Data = await blobToBase64(selectedFile);
      const analysisText = await analyzeImage(base64Data, selectedFile.type, customPrompt);

      setResult({
        id: Date.now().toString(),
        imageUrl: previewUrl!,
        analysis: analysisText,
        timestamp: Date.now()
      });
    } catch (err: any) {
      setProcessing(prev => ({ ...prev, error: err.message }));
    } finally {
      setProcessing(prev => ({ ...prev, isProcessing: false }));
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full overflow-hidden">
      {/* Left Panel: Input */}
      <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-700 flex flex-col gap-6">
        <div>
           <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <ScanEye className="w-6 h-6 text-cyan-400" />
            Vision Analyst
           </h2>
           <p className="text-slate-400 text-sm">Upload an image to get insights using Multimodal Gemini.</p>
        </div>

        <div className={`
          border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all min-h-[300px] relative overflow-hidden
          ${previewUrl ? 'border-slate-600 bg-slate-900' : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-800/50 cursor-pointer'}
        `}>
          {previewUrl ? (
             <div className="relative w-full h-full flex items-center justify-center bg-black/50 p-4">
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[400px] object-contain rounded shadow-lg" />
                <button 
                  onClick={clearSelection}
                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors backdrop-blur-sm"
                >
                  <X className="w-5 h-5" />
                </button>
             </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
              <div className="bg-slate-800 p-4 rounded-full mb-4">
                <Upload className="w-8 h-8 text-cyan-400" />
              </div>
              <span className="text-slate-300 font-medium">Click to upload image</span>
              <span className="text-slate-500 text-sm mt-2">JPG, PNG, WebP supported</span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                onChange={handleFileSelect} 
                className="hidden" 
              />
            </label>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">Analysis Prompt</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full h-24 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm resize-none"
          />
          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || processing.isProcessing}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {processing.isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <ScanEye className="w-5 h-5" />
                Analyze Image
              </>
            )}
          </button>
        </div>
        
        {processing.error && (
           <div className="p-4 bg-red-900/20 border border-red-500/30 text-red-300 rounded-lg text-sm">
             {processing.error}
           </div>
        )}
      </div>

      {/* Right Panel: Results */}
      <div className="w-full md:w-1/2 bg-slate-900 p-6 overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-400" />
          Analysis Results
        </h3>
        
        {result ? (
          <div className="prose prose-invert prose-slate max-w-none">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 whitespace-pre-wrap leading-relaxed text-slate-200">
              {result.analysis}
            </div>
            <div className="mt-4 text-xs text-slate-500 text-right">
              Analyzed at {new Date(result.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-600 border border-slate-800 rounded-2xl bg-slate-900/50">
             <ScanEye className="w-12 h-12 mb-3 opacity-30" />
             <p>No analysis results yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisionMode;