
import React, { useState } from 'react';
import BentoCard from '../BentoCard';
import { ToolConfig, ToolUISchema } from '../../types';
import { Upload, File, ChevronDown, Check, AlertTriangle, Cloud, Zap } from "lucide-react";
import { apiClient } from '../../services/api';

interface UniversalToolProps {
  config: ToolConfig;
  schema: ToolUISchema;
}

const UniversalTool: React.FC<UniversalToolProps> = ({ config, schema }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputData, setOutputData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'cloud' | 'mock' | null>(null);

  const handleInputChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    setError(null);
  };

  const executeAction = async (actionId: string) => {
    setIsProcessing(true);
    setError(null);
    setOutputData(null);
    setDataSource(null);

    try {
      const response = await apiClient.executeToolAction(schema.id, actionId, formData, config);
      
      if (response.success) {
        setOutputData(response.data);
        setDataSource(response.dataSource || null);
      } else {
        setError(response.error || "Unknown error occurred");
        setDataSource(response.dataSource || null);
      }
    } catch (e) {
      setError("System failure: " + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <BentoCard title={schema.title} className="h-full">
      <div className="flex flex-col md:flex-row h-full">
        {/* Left: Input Panel */}
        <div className="w-full md:w-1/2 p-6 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto">
           <div className="mb-2">
             <p className="text-sm text-slate-400">{schema.description}</p>
           </div>

           {/* Dynamic Inputs */}
           <div className="space-y-4 flex-1">
             {schema.inputs.map(input => (
               <div key={input.id} className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{input.label}</label>
                  
                  {input.type === 'text' && (
                    <input 
                      type="text" 
                      placeholder={input.placeholder}
                      className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none"
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                    />
                  )}

                  {input.type === 'color' && (
                    <div className="flex items-center gap-3">
                        <input 
                            type="color" 
                            defaultValue={input.defaultValue || "#000000"}
                            className="w-12 h-12 rounded-lg bg-transparent border-none cursor-pointer"
                            onChange={(e) => handleInputChange(input.id, e.target.value)}
                        />
                        <span className="text-sm font-mono text-slate-300">
                             {formData[input.id] || input.defaultValue || "Select Color"}
                        </span>
                    </div>
                  )}

                  {input.type === 'number' && (
                    <input 
                      type="number" 
                      defaultValue={input.defaultValue}
                      placeholder={input.placeholder}
                      className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none"
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                    />
                  )}

                  {input.type === 'datetime' && (
                    <input 
                      type="datetime-local" 
                      defaultValue={input.defaultValue}
                      className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none"
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                    />
                  )}

                  {input.type === 'textarea' && (
                    <textarea 
                      placeholder={input.placeholder}
                      className="w-full h-32 bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none"
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                    />
                  )}

                  {input.type === 'select' && (
                     <div className="relative">
                       <select 
                         className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none appearance-none"
                         onChange={(e) => handleInputChange(input.id, e.target.value)}
                       >
                         {input.options?.map(opt => (
                           <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">{opt.label}</option>
                         ))}
                       </select>
                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                     </div>
                  )}

                  {input.type === 'file' && (
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 hover:bg-white/5 hover:border-white/20 transition-colors cursor-pointer">
                       <Upload size={24} className="mb-2" />
                       <span className="text-xs font-medium">Click to upload or drag {input.accept || 'files'}</span>
                    </div>
                  )}

                  {input.type === 'checkbox' && (
                     <div className="flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-white/10 bg-black/20 accent-indigo-500"
                            onChange={(e) => handleInputChange(input.id, e.target.checked)}
                        />
                        <span className="text-sm text-slate-300">Enabled</span>
                     </div>
                  )}
               </div>
             ))}
           </div>

           {/* Actions */}
           <div className="flex flex-col gap-3 mt-4">
             {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-xs text-red-300">
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                    {error}
                </div>
             )}
             {schema.actions.map(action => (
               <button
                 key={action.id}
                 onClick={() => executeAction(action.id)}
                 disabled={isProcessing}
                 className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isProcessing ? "Processing..." : (
                   <>
                     {action.icon && <action.icon size={18} />}
                     {action.label}
                   </>
                 )}
               </button>
             ))}
           </div>
        </div>

        {/* Right: Output Panel */}
        <div className="w-full md:w-1/2 bg-slate-900/40 p-6 flex flex-col relative">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Output Console</h3>
            
            {/* Source Indicator */}
            {dataSource && (
                <div className={`absolute top-6 right-6 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 border ${dataSource === 'cloud' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {dataSource === 'cloud' ? <Cloud size={10} /> : <Zap size={10} />}
                    {dataSource === 'cloud' ? 'API' : 'Mock'}
                </div>
            )}

            <div className="flex-1 bg-black/40 rounded-xl border border-white/10 p-4 font-mono text-sm overflow-auto text-slate-300">
                {outputData ? (
                  <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                      {schema.outputs.map(output => {
                        // In a real implementation, we'd map output keys to data keys
                        // For this mock, we just dump specific fields if they match types
                        if (output.type === 'image-preview' && outputData.imageUrl) {
                          return (
                            <div key={output.id} className="flex flex-col items-center">
                                <img src={outputData.imageUrl} alt="Result" className="max-w-full rounded-lg border border-white/10" />
                            </div>
                          );
                        }
                        if (output.type === 'html' && outputData.preview) {
                             return (
                                <div key={output.id} className="w-full">
                                    <div className="text-xs text-slate-500 mb-1">{output.label}</div>
                                    <div dangerouslySetInnerHTML={{ __html: outputData.preview }} />
                                </div>
                             )
                        }
                        if (output.type === 'download' && outputData.downloadUrl) {
                          return (
                            <div key={output.id} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                                <span className="text-emerald-400">File Ready</span>
                                <button className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Download</button>
                            </div>
                          );
                        }
                        return (
                          <div key={output.id}>
                             <div className="text-xs text-slate-500 mb-1">{output.label}</div>
                             <div className="whitespace-pre-wrap">{JSON.stringify(outputData[output.id] || outputData, null, 2)}</div>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <File size={32} className="mb-2 opacity-20" />
                    <p>No output generated yet</p>
                  </div>
                )}
            </div>
        </div>
      </div>
    </BentoCard>
  );
};

export default UniversalTool;
