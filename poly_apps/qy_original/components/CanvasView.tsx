import React, { useState } from 'react';
import { Icons } from './Icons';
import { GeneratedImage, LoadingState } from '../types';
import { generateCreativeImage } from '../services/geminiService';

export const CanvasView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading.isLoading) return;

    setLoading({ isLoading: true });
    
    try {
      const imageUrl = await generateCreativeImage(prompt);
      
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now()
      };
      
      setImages(prev => [newImage, ...prev]);
      setPrompt('');
    } catch (err) {
      alert("Failed to generate image. Please try a different prompt.");
    } finally {
      setLoading({ isLoading: false });
    }
  };

  const downloadImage = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumina-art-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-8 h-full overflow-y-auto custom-scrollbar">
      
      {/* Hero Input Section */}
      <div className="max-w-2xl mx-auto mb-16 mt-8 text-center animate-fade-in">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-400 font-serif tracking-tight">
          Dream in Pixels
        </h2>
        <p className="text-gray-400 mb-10 font-light text-lg">
          Describe the unseen, and Lumina will bring it into focus.
        </p>

        <form onSubmit={handleGenerate} className="relative group z-10">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative flex flex-col md:flex-row gap-2 bg-slate-900/50 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A cyberpunk city inside a glass bottle..."
              className="w-full bg-transparent border-none focus:ring-0 text-white placeholder:text-gray-600 px-4 py-3 text-lg"
              disabled={loading.isLoading}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || loading.isLoading}
              className="px-8 py-3 bg-white text-black rounded-xl font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:hover:bg-white flex items-center justify-center space-x-2 shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {loading.isLoading ? (
                <Icons.Loader className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Icons.Sparkles className="w-4 h-4" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Gallery Grid */}
      {images.length === 0 && !loading.isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20 animate-pulse-slow">
          <Icons.LayoutGrid className="w-16 h-16 mb-4" />
          <p className="text-lg font-light tracking-wide">The canvas is waiting.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-