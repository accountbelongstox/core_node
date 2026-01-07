
import React, { useState } from 'react';
import { useAppContext } from '../App';
import { ApiKey } from '../types';

const KeysPage = () => {
  const { t } = useAppContext();
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: '1', name: 'Dev-Bot-Alpha', key: 'sk-tp-88...2k1', createdAt: '2024-06-12', status: 'active' },
    { id: '2', name: 'Prod-Matrix-HK', key: 'sk-tp-12...x92', createdAt: '2024-07-01', status: 'active' },
    { id: '3', name: 'Claude-Sync-Proxy', key: 'sk-tp-42...a11', createdAt: '2024-08-15', status: 'active' },
  ]);

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-16">
        <div>
          <h1 className="text-5xl font-black tracking-tight mb-3 italic">{t.apiKeys}</h1>
          <p className="dark:text-slate-400 text-slate-500 text-lg font-medium">{t.keysDescription}</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-12 rounded-[2rem] text-[10px] uppercase tracking-[0.3em] transition-all glow-button shadow-2xl shadow-blue-500/30">
          {t.generateKey}
        </button>
      </div>

      <div className="glass rounded-[4rem] overflow-hidden border-white/5 shadow-2xl">
        <table className="w-full text-left">
          <thead className="dark:bg-white/5 bg-slate-50 border-b dark:border-white/5 border-slate-200">
            <tr className="text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-500">
              <th className="px-12 py-10 italic">{t.keyName}</th>
              <th className="px-12 py-10 italic">{t.neuralPreview}</th>
              <th className="px-12 py-10 italic">{t.keyCreated}</th>
              <th className="px-12 py-10 italic">{t.keyStatus}</th>
              <th className="px-12 py-10 italic"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-white/5 divide-slate-100 font-medium">
            {keys.map(k => (
              <tr key={k.id} className="dark:hover:bg-white/[0.02] hover:bg-slate-50/50 transition-colors group">
                <td className="px-12 py-10 text-base font-black italic">{k.name}</td>
                <td className="px-12 py-10"><code className="bg-slate-500/10 dark:text-blue-400 text-blue-600 px-5 py-3 rounded-2xl text-xs font-mono font-bold">{k.key}</code></td>
                <td className="px-12 py-10 text-sm text-slate-500">{k.createdAt}</td>
                <td className="px-12 py-10">
                  <span className="text-[10px] font-black bg-green-500/10 text-green-500 px-5 py-2 rounded-full border border-green-500/20 uppercase tracking-widest">{k.status}</span>
                </td>
                <td className="px-12 py-10 text-right">
                  <button className="text-[10px] font-black text-red-500/50 hover:text-red-500 transition-colors uppercase tracking-[0.4em]">{t.severLink}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default KeysPage;

