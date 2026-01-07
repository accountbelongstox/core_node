
import React from 'react';
import { useAppContext } from '../App';
import { Icons } from '../constants';

const DocsPage = () => {
  const { t } = useAppContext();
  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto">
      <div className="text-center mb-24">
        <h1 className="text-7xl font-black mb-8 tracking-tighter italic">{t.docsTitle}</h1>
        <div className="max-w-2xl mx-auto relative group">
          <input 
            type="text" 
            placeholder={t.docsSearch} 
            className="w-full glass rounded-[3rem] py-7 px-10 text-base outline-none focus:ring-4 focus:ring-blue-500/20 border-white/10 transition-all font-medium placeholder:text-slate-600 shadow-2xl" 
          />
          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[11px] border border-white/10 px-5 py-3 rounded-2xl bg-white/5 shadow-inner select-none pointer-events-none font-bold">⌘ K</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {[
          { title: t.neuralMatrixRouting, desc: t.neuralMatrixRoutingDesc, items: [t.multiModelEdgeArch, t.latencyTuningGuide, t.regionFallbackLogic] },
          { title: t.restAPISpec, desc: t.restAPISpecDesc, items: [t.authV3Protocols, t.batchInferenceSync, t.realtimeStreaming] },
          { title: t.developerKits, desc: t.developerKitsDesc, items: [t.reactHooksMatrix, t.pythonEnterpriseClient, t.goNetworkDriver] },
        ].map((cat, idx) => (
          <div key={idx} className="glass p-14 rounded-[4rem] border-white/5 shadow-2xl hover:border-blue-500/30 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-colors"></div>
            <h4 className="text-3xl font-black mb-3 italic tracking-tight relative z-10">{cat.title}</h4>
            <p className="text-xs text-slate-500 mb-10 font-medium relative z-10 leading-relaxed">{cat.desc}</p>
            <ul className="space-y-6 relative z-10">
              {cat.items.map((i, iidx) => (
                <li key={iidx} className="group/item">
                  <a href="#" className="text-sm font-bold dark:text-slate-400 text-slate-600 hover:text-blue-500 transition-all flex items-center justify-between">
                    {i} 
                    <span className="opacity-0 group-hover/item:opacity-100 transition-all translate-x-3 group-hover/item:translate-x-0"><Icons.Check /></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocsPage;

