
import React, { useState } from 'react';
import { 
  Scissors,
  ScanText,
  Mic,
  Activity,
  Play,
  Video,
  FileSearch,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';

const Tools: React.FC = () => {
  const { t } = useApp();
  const [activeTool, setActiveTool] = useState('screenshot');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const resetState = () => {
      setResult(null);
      setLoading(false);
  };

  const changeTool = (tool: string) => {
      setActiveTool(tool);
      resetState();
  };

  // --- Handlers ---

  const handleScreenshot = async (mode: 'fullscreen' | 'window' | 'region') => {
      setLoading(true);
      try {
          const res = await api.tools.captureScreenshot({
              mode,
              auto_ocr: true,
              auto_upload: false
          });
          setResult(res);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleOCR = async () => {
      setLoading(true);
      try {
          const res = await api.tools.performOCR({
              image_data: 'dummy_base64',
              engine: 'PaddleOCR'
          });
          setResult(res);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleAudio = async () => {
      setLoading(true);
      try {
          const res = await api.tools.transcribeAudio({
              file_name: 'test_audio.mp3',
              model: 'medium',
              generate_subtitle: true
          });
          setResult(res);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleVideo = async () => {
      setLoading(true);
      try {
          const res = await api.tools.processVideo({
              file_name: 'test_video.mp4',
              extract_audio: true,
              generate_subtitle: true
          });
          setResult(res);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleFile = async () => {
      setLoading(true);
      try {
          const res = await api.tools.analyzeFile({
              file_name: 'report.pdf',
              file_type: 'pdf',
              extract_text: true,
              extract_metadata: true
          });
          setResult(res);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('tools.title')}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tool Navigation */}
          <div className="space-y-2">
              <ToolNavButton 
                active={activeTool === 'screenshot'} 
                onClick={() => changeTool('screenshot')}
                icon={Scissors}
                label={t('tools.screenshot')}
                desc="Capture and process screen areas"
              />
              <ToolNavButton 
                active={activeTool === 'ocr'} 
                onClick={() => changeTool('ocr')}
                icon={ScanText}
                label={t('tools.ocr')}
                desc="Extract text from images"
              />
              <ToolNavButton 
                active={activeTool === 'audio'} 
                onClick={() => changeTool('audio')}
                icon={Mic}
                label={t('tools.audio')}
                desc="Transcribe audio files"
              />
              <ToolNavButton 
                active={activeTool === 'video'} 
                onClick={() => changeTool('video')}
                icon={Video}
                label={t('tools.video')}
                desc="Process video streams"
              />
              <ToolNavButton 
                active={activeTool === 'file'} 
                onClick={() => changeTool('file')}
                icon={FileSearch}
                label={t('tools.file')}
                desc="Analyze document metadata"
              />
              <ToolNavButton 
                active={activeTool === 'test'} 
                onClick={() => changeTool('test')}
                icon={Activity}
                label={t('tools.test')}
                desc="Run system diagnostics"
              />
          </div>

          {/* Tool Content Area */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 min-h-[500px]">
               {activeTool === 'screenshot' && (
                   <div className="space-y-6 animate-fade-in">
                       <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Scissors className="text-blue-500" />
                           {t('tools.screenshot')}
                       </h2>
                       <div className="grid grid-cols-3 gap-4">
                           <ScreenshotBtn onClick={() => handleScreenshot('fullscreen')} label="Fullscreen" icon={<div className="w-8 h-8 rounded bg-slate-300 dark:bg-slate-600"></div>} />
                           <ScreenshotBtn onClick={() => handleScreenshot('window')} label="Window" icon={<div className="w-8 h-8 rounded border-2 border-slate-400"></div>} />
                           <ScreenshotBtn onClick={() => handleScreenshot('region')} label="Region" icon={<div className="w-8 h-8 border-2 border-dashed border-slate-400"></div>} />
                       </div>
                       
                       {loading && <div className="text-center py-4 text-blue-500 flex items-center justify-center gap-2"><Loader className="animate-spin"/> {t('tools.processing')}</div>}
                       
                       {result && (
                           <ResultBox title="Screenshot Result">
                               <div className="flex gap-4">
                                   <div className="w-1/3 bg-slate-200 dark:bg-slate-800 rounded aspect-video flex items-center justify-center text-xs text-slate-500">Preview</div>
                                   <div className="flex-1 space-y-2">
                                       <div className="text-sm">File: <span className="font-mono text-slate-600 dark:text-slate-300">{result.file_path}</span></div>
                                       {result.ocr_text && (
                                           <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm font-mono border border-slate-100 dark:border-slate-700">
                                               {result.ocr_text}
                                           </div>
                                       )}
                                       <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12}/> Captured in {result.execution_time}s</div>
                                   </div>
                               </div>
                           </ResultBox>
                       )}
                   </div>
               )}
               
               {activeTool === 'ocr' && (
                   <div className="space-y-6 animate-fade-in">
                       <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <ScanText className="text-green-500" />
                           {t('tools.ocr')}
                       </h2>
                       <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={handleOCR}>
                           {loading ? <Loader className="animate-spin mb-2" size={32}/> : <UploadCloud size={48} className="mb-4 opacity-50" />}
                           <p>{loading ? t('tools.processing') : t('tools.upload_drop')}</p>
                           <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm" disabled={loading}>
                               {loading ? 'Analyzing...' : 'Select Image'}
                           </button>
                       </div>

                       {result && (
                           <ResultBox title="OCR Result">
                               <p className="whitespace-pre-wrap font-mono text-sm text-slate-700 dark:text-slate-300 mb-2">{result.text}</p>
                               <div className="text-xs text-slate-500">Confidence: {(result.confidence * 100).toFixed(1)}% • Time: {result.execution_time}s</div>
                           </ResultBox>
                       )}
                   </div>
               )}
               
               {activeTool === 'audio' && (
                   <div className="space-y-6 animate-fade-in">
                       <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Mic className="text-pink-500" />
                           {t('tools.audio')}
                       </h2>
                        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={handleAudio}>
                           {loading ? <Loader className="animate-spin mb-2" size={32}/> : <Mic size={48} className="mb-4 opacity-50" />}
                           <p>{loading ? t('tools.processing') : 'Drop audio files (wav, mp3)'}</p>
                           <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm" disabled={loading}>
                               {loading ? 'Transcribing...' : 'Select Audio File'}
                           </button>
                       </div>

                       {result && (
                           <ResultBox title="Transcription Result">
                               <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 italic">"{result.text}"</p>
                               <div className="flex gap-4 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
                                   <span>Language: {result.language}</span>
                                   <span>Duration: {result.duration}s</span>
                                   <span>Segments: {result.segments.length}</span>
                               </div>
                           </ResultBox>
                       )}
                   </div>
               )}

               {activeTool === 'video' && (
                   <div className="space-y-6 animate-fade-in">
                       <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Video className="text-purple-500" />
                           {t('tools.video')}
                       </h2>
                       <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={handleVideo}>
                           {loading ? <Loader className="animate-spin mb-2" size={32}/> : <Video size={48} className="mb-4 opacity-50" />}
                           <p className="mb-4">{loading ? t('tools.processing') : 'Drag and drop video files here'}</p>
                           {!loading && <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-sm">Select File</button>}
                       </div>
                       
                       {result && (
                           <ResultBox title="Video Processing Output">
                               <div className="grid grid-cols-2 gap-4 text-sm">
                                   <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                                       <span className="block text-xs text-slate-500">Metadata</span>
                                       <span className="font-mono text-slate-700 dark:text-slate-300">{result.metadata.resolution} • {result.metadata.codec}</span>
                                   </div>
                                   <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                                       <span className="block text-xs text-slate-500">Generated Files</span>
                                       <div className="flex gap-2 mt-1">
                                            {result.audio_path && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Audio</span>}
                                            {result.subtitle_path && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Subs</span>}
                                       </div>
                                   </div>
                               </div>
                           </ResultBox>
                       )}
                   </div>
               )}

               {activeTool === 'file' && (
                   <div className="space-y-6 animate-fade-in">
                       <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <FileSearch className="text-orange-500" />
                           {t('tools.file')}
                       </h2>
                       <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={handleFile}>
                           {loading ? <Loader className="animate-spin mb-2" size={32}/> : <FileSearch size={48} className="mb-4 opacity-50" />}
                           <p>{loading ? t('tools.processing') : 'Analyze PDF, Docx, or Text files'}</p>
                           <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm" disabled={loading}>
                               {loading ? 'Scanning...' : 'Upload Document'}
                           </button>
                       </div>

                       {result && (
                           <ResultBox title="Analysis Report">
                               <div className="space-y-2 text-sm">
                                   <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                       <span className="text-slate-500">Author</span>
                                       <span className="text-slate-800 dark:text-slate-200">{result.metadata.author}</span>
                                   </div>
                                   <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                       <span className="text-slate-500">Pages</span>
                                       <span className="text-slate-800 dark:text-slate-200">{result.metadata.pages}</span>
                                   </div>
                                   <div className="flex justify-between pb-1">
                                       <span className="text-slate-500">Created</span>
                                       <span className="text-slate-800 dark:text-slate-200">{result.metadata.created}</span>
                                   </div>
                                   {result.text_preview && (
                                       <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded font-mono text-xs text-slate-600 dark:text-slate-400">
                                           {result.text_preview}
                                       </div>
                                   )}
                               </div>
                           </ResultBox>
                       )}
                   </div>
               )}

               {activeTool === 'test' && (
                   <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Activity className="text-green-500" />
                           {t('tools.test')}
                       </h2>
                       <div className="space-y-3">
                           <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                               <div>
                                   <div className="font-medium text-slate-900 dark:text-white">Local Inference Test</div>
                                   <div className="text-xs text-slate-500">Test CPU/GPU model loading time</div>
                               </div>
                               <button className="p-2 bg-white dark:bg-slate-700 rounded-full hover:text-blue-500 shadow-sm"><Play size={16} /></button>
                           </div>
                           <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                               <div>
                                   <div className="font-medium text-slate-900 dark:text-white">Network Bandwidth Test</div>
                                   <div className="text-xs text-slate-500">Test upload speed to configured servers</div>
                               </div>
                               <button className="p-2 bg-white dark:bg-slate-700 rounded-full hover:text-blue-500 shadow-sm"><Play size={16} /></button>
                           </div>
                       </div>
                   </div>
               )}
          </div>
      </div>
    </div>
  );
};

// --- Sub-components ---

const ToolNavButton: React.FC<{ active: boolean; onClick: () => void; icon: any; label: string; desc: string }> = ({ active, onClick, icon: Icon, label, desc }) => (
    <button 
        onClick={onClick}
        className={`w-full text-left p-4 rounded-xl border transition-all ${
            active 
            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900/20' 
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
    >
        <div className="flex items-center gap-3 mb-1">
            <Icon size={20} className={active ? 'text-blue-200' : 'text-slate-400'} />
            <span className={`font-bold ${active ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{label}</span>
        </div>
        <div className={`text-xs ${active ? 'text-blue-100' : 'text-slate-400'}`}>{desc}</div>
    </button>
);

const ScreenshotBtn: React.FC<{ onClick: () => void; label: string; icon: React.ReactNode }> = ({ onClick, label, icon }) => (
    <button 
        onClick={onClick}
        className="h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400"
    >
        {icon}
        <span className="text-sm font-medium">{label}</span>
    </button>
);

const ResultBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mt-6 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-fade-in">
        <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{title}</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900">
            {children}
        </div>
    </div>
);

export default Tools;
