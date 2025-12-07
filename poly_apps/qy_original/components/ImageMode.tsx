import React, { useState } from 'react';
import { Sparkles, Download, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { GeneratedImage, ProcessingState } from '../types';
import { generateImage } from '../services/geminiService';

const ImageMode: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, error: null });

  const handleGenerate = async () => {
    if (!prompt.trim() || processing.isProcessing) return;

    setProcessing({ isProcessing: true, error: null });
    setGeneratedImage(null);

    try {
      const base64Image = await generateImage(prompt);
      
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: base64Image,
        prompt: prompt,
        timestamp: Date.now()
      };
      
      setGeneratedImage(newImage);
    } catch (err: any) {
      setProcessing(prev => ({ ...prev, error: err.message }));
    } finally {
      setProcessing(prev => ({ ...prev, isProcessing: false }));
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 md:p-8 space-y-6 overflow-y-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-400" />
          Imaginarium
        </h2>
        <p className="text-slate-400">Generate stunning visuals with Gemini Flash Image</p>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <div className="relative group">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to create... (e.g., 'A cyberpunk city with neon lights in the rain')"
            className="w-full h-32 bg-slate-800/50 border border-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-2xl p-4 text-lg text-white resize-none transition-all"
          />
          <div className="absolute bottom-4 right-4">
             <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || processing.isProcessing}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold py-2 px-6 rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing.isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>

        {processing.error && (
          <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-500/30 text-red-300 rounded-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{processing.error}</p>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[400px] flex items-center justify-center bg-slate-900/50 rounded-3xl border border-slate-800/50 relative overflow-hidden backdrop-blur-sm">
        {processing.isProcessing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm">
             <div className="relative">
                <div className="w-20 h-20 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
                </div>
             </div>
             <p className="mt-6 text-amber-500 font-medium animate-pulse">Dreaming up pixels...</p>
          </div>
        )}

        {generatedImage ? (
          <div className="relative w-full h-full flex items-center justify-center p-4 group">
            <img 
              src={generatedImage.url} 
              alt={generatedImage.prompt}
              className="max-w-full max-h-[600px] object-contain rounded-lg shadow-2xl shadow-black/50"
            />
            <div className="absolute bottom-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <a 
                 href={generatedImage.url} 
                 download={`gemini-nexus-${Date.now()}.png`}
                 className="flex items-center gap-2 bg-slate-900/90 text-white px-4 py-2 rounded-lg hover:bg-black border border-slate-700 backdrop-blur-md"
               >
                 <Download className="w-4 h-4" />
                 Download
               </a>
            </div>
          </div>
        ) : (
          !processing.isProcessing && (
            <div className="text-center text-slate-600">
              <ImageIcon className="w-24 h-24 mx-auto mb-4 opacity-20" />
              <p className="text-xl font-medium">Ready to create</p>
              <p className="text-sm mt-2 opacity-60">Enter a prompt above to start</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ImageMode;