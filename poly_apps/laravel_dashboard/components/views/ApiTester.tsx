import React, { useState } from 'react';
import BentoCard from '../BentoCard';
import { API_ENDPOINTS } from '../../constants';
import { apiClient } from '../../services/api';
import { Search, Copy, PlayCircle, Clock, CheckCircle, XCircle } from "lucide-react";

const MethodBadge = ({ method }: { method: string }) => {
    const colors: Record<string, string> = {
        GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        POST: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
        PUT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors[method] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
            {method}
        </span>
    );
}

const ApiTester: React.FC = () => {
    const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null);
    const [lastResponse, setLastResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleTestEndpoint = async (e: React.MouseEvent, endpoint: any) => {
        e.stopPropagation();
        setActiveEndpointId(endpoint.id);
        setLoading(true);
        setLastResponse(null);

        const res = await apiClient.fetchEndpoint(endpoint.method, endpoint.path, {});
        setLastResponse(res);
        setLoading(false);
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-8 overflow-hidden">
             {/* Header */}
             <div className="flex justify-between items-center mb-6">
                 <div>
                     <h2 className="text-xl font-bold text-white mb-1">API Testing Dashboard</h2>
                     <p className="text-xs text-slate-400">Select application: <span className="text-white font-mono">AppQyV1</span></p>
                 </div>
                 <div className="w-96 relative hidden md:block">
                     <input type="text" placeholder="Search APIs by path, description..." className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-4 pr-10 text-sm text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none" />
                     <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                 </div>
             </div>

             {/* Shared Headers Config */}
             <BentoCard title="AppQyV1 - Shared Headers" className="mb-6 flex-shrink-0" glowing>
                 <div className="p-4 grid gap-4">
                     <div className="grid grid-cols-[120px_1fr_120px] gap-4 items-center text-sm">
                         <span className="text-slate-400 font-mono">Authorization:</span>
                         <input type="text" value="Bearer {access_token}" className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-slate-300 font-mono text-xs" readOnly />
                         <span className="text-slate-600 text-xs text-right">Bearer Token</span>
                     </div>
                     <div className="flex gap-2 mt-2">
                         <button className="px-3 py-1.5 bg-lime-500/20 text-lime-400 border border-lime-500/30 rounded text-xs hover:bg-lime-500/30 transition-colors">Save All Headers</button>
                     </div>
                 </div>
             </BentoCard>

             <div className="flex-1 min-h-0 flex gap-6">
                 {/* Endpoint List */}
                 <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                     {API_ENDPOINTS.map((endpoint, idx) => (
                         <div 
                            key={endpoint.id} 
                            onClick={() => setActiveEndpointId(endpoint.id)}
                            className={`group flex items-center justify-between p-3 border rounded-lg transition-all cursor-pointer ${activeEndpointId === endpoint.id ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-indigo-500/30'}`}
                         >
                            <div className="flex items-center gap-4">
                                 <MethodBadge method={endpoint.method} />
                                 <span className="font-mono text-sm text-slate-200 group-hover:text-white transition-colors">{endpoint.path}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    className={`p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors ${loading && activeEndpointId === endpoint.id ? 'animate-pulse text-indigo-400' : ''}`}
                                    onClick={(e) => handleTestEndpoint(e, endpoint)}
                                    title="Test Endpoint"
                                >
                                    <PlayCircle size={16} />
                                </button>
                            </div>
                         </div>
                     ))}
                 </div>

                 {/* Response Panel */}
                 <div className="w-[400px] bg-slate-900/50 border border-white/10 rounded-xl flex flex-col overflow-hidden backdrop-blur-md">
                    <div className="p-3 bg-white/5 border-b border-white/10 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Live Console</span>
                        {lastResponse && (
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-mono font-bold ${lastResponse.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {lastResponse.statusCode}
                                </span>
                                <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                    <Clock size={10} /> {lastResponse.latency}ms
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-indigo-400 gap-2">
                                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Sending Request...</span>
                            </div>
                        ) : lastResponse ? (
                            <pre className="whitespace-pre-wrap">{JSON.stringify(lastResponse.data || lastResponse, null, 2)}</pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                <PlayCircle size={32} className="mb-2" />
                                <p>Select an endpoint to test</p>
                            </div>
                        )}
                    </div>
                 </div>
             </div>
        </div>
    );
};

export default ApiTester;