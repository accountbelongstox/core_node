import React, { useState } from 'react';
import { 
  Scissors,
  ScanText,
  Mic,
  Activity,
  Play,
  Video,
  FileSearch
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const Tools: React.FC = () => {
  const { t } = useApp();
  const [activeTool, setActiveTool] = useState('screenshot');

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('tools.title')}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tool Navigation */}
          <div className="space-y-2">
              <ToolNavButton 
                active={activeTool === 'screenshot'} 
                onClick={() => setActiveTool('screenshot')}
                icon={Scissors}
                label={t('tools.screenshot')}
                desc="Capture and process screen areas"
              />
              <ToolNavButton 
                active={activeTool === 'ocr'} 
                onClick={() => setActiveTool('ocr')}
                icon={ScanText}
                label={t('tools.ocr')}
                desc="Extract text from images"
              />
              <ToolNavButton 
                active={activeTool === 'audio'} 
                onClick={() => setActiveTool('audio')}
                icon={Mic}
                label={t('tools.audio')}
                desc="Transcribe audio files"
              />
              <ToolNavButton 
                active={activeTool === 'video'} 
                onClick={() => setActiveTool('video')}
                icon={Video}
                label={t('tools.video')}
                desc="Process video streams"
              />
              <ToolNavButton 
                active={activeTool === 'file'} 
                onClick={() => setActiveTool('file')}
                icon={FileSearch}
                label={t('tools.file')}
                desc="Analyze document metadata"
              />
              <ToolNavButton 
                active={activeTool === 'test'} 
                onClick={() => setActiveTool('test')}
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
                           Screenshot Tool
                       </h2>
                       <div className="grid grid-cols-3 gap-4">
                           <button className="h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
                               <div className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-800"></div>
                               <span className="text-sm font-medium">Fullscreen</span>
                           </button>
                           <button className="h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
                               <div className="w-8 h-8 rounded border-2 border-slate-400"></div>
                               <span className="text-sm font-medium">Window</span>
                           </button>
                           <button className="h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
                               <div className="w-8 h-8 border-2 border-dashed border-slate-400"></div>
                               <span className="text-sm font-medium">Region</span>
                           </button>
                       </div>
                       
                       <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                           <label className="flex items-center gap-2 mb-2">
                               <input type="checkbox" className="rounded text-blue-600" defaultChecked />
                               <span className="text-sm text-slate-700 dark:text-slate-300">Auto-upload to active server</span>
                           </label>
                           <label className="flex items-center gap-2">
                               <input type="checkbox" className="rounded text-blue-600" />
                               <span className="text-sm text-slate-700 dark:text-slate-300">Run OCR after capture</span>
                           </label>
                       </div>
                   </div>
               )}
               
               {activeTool === 'ocr' && (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 animate-fade-in">
                       <ScanText size={48} />
                       <p>Drag and drop image here or paste from clipboard</p>
                       <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Select Image</button>
                   </div>
               )}
               
               {activeTool === 'audio' && (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 animate-fade-in">
                       <Mic size={48} />
                       <p>Drop audio files (wav, mp3) to start transcription</p>
                       <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Select Audio File</button>
                   </div>
               )}

               {activeTool === 'video' && (
                   <div className="space-y-6 animate-fade-in">
                       <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Video className="text-purple-500" />
                           Video Processor
                       </h2>
                       <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                           <Video size={48} className="mb-4 opacity-50" />
                           <p className="mb-4">Drag and drop video files here</p>
                           <div className="flex gap-2">
                               <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-sm">Select File</button>
                           </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                               <label className="flex items-center gap-2 mb-2 font-medium text-slate-700 dark:text-slate-300">
                                   <input type="checkbox" className="rounded" />
                                   Extract Audio
                               </label>
                               <select className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm">
                                   <option>MP3</option>
                                   <option>WAV</option>
                                   <option>FLAC</option>
                               </select>
                           </div>
                           <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                               <label className="flex items-center gap-2 mb-2 font-medium text-slate-700 dark:text-slate-300">
                                   <input type="checkbox" className="rounded" />
                                   Generate Subtitles
                               </label>
                               <select className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm">
                                   <option>SRT</option>
                                   <option>VTT</option>
                               </select>
                           </div>
                       </div>
                   </div>
               )}

               {activeTool === 'file' && (
                   <div className="space-y-6 animate-fade-in">
                       <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <FileSearch className="text-orange-500" />
                           File Analysis
                       </h2>
                       <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                           <FileSearch size={48} className="mb-4 opacity-50" />
                           <p>Analyze PDF, Docx, or Text files</p>
                           <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Upload Document</button>
                       </div>
                   </div>
               )}

               {activeTool === 'test' && (
                   <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Activity className="text-green-500" />
                           System Diagnostics
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

export default Tools;