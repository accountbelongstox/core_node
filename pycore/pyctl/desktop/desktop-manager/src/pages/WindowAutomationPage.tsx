import { useState } from 'react';
import { RefreshCw, Tv, AppWindow, Rocket } from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { QueueItem } from '../types';

export default function WindowAutomationPage() {
  const { queue, setQueue, syncQueue, settings, t, toast } = useApp();
  const [automationScript, setAutomationScript] = useState('Sync code layout');
  const [automationWindow, setAutomationWindow] = useState('Discord-Client-Main');
  const [isExecuting, setIsExecuting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const execute = () => {
    setIsExecuting(true);
    setStatus(null);
    setTimeout(() => {
      setIsExecuting(false);
      setStatus(`[OK] ${automationScript} -> ${automationWindow}`);
      const nextIdx = queue.length ? Math.max(...queue.map((q) => q.index)) + 1 : 1;
      const item: QueueItem = {
        id: `auto_${Date.now()}`, index: nextIdx,
        text: `Automation run: [${automationScript}] triggered on ${automationWindow}.`,
        category: 'Window', playCount: 1, created: new Date().toISOString(), status: 'completed',
        metadata: { targetWindow: automationWindow },
      };
      const updated = [...queue, item];
      setQueue(updated); syncQueue(updated);
      toast('Window macro completed', 'success');
    }, 1400);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className={`rounded-3xl p-6 border backdrop-blur-xl transition-all ${
        settings.theme === 'dark' ? 'bg-slate-900/40 border-white/10' : 'bg-white hover:border-slate-200 shadow-md'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400"><AppWindow className="w-6 h-6" /></div>
          <div>
            <h3 className="font-bold text-md">{t.windowAutomation}</h3>
            <p className="text-[11px] text-slate-500">Automate layout arrangements and application sizes</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t.scriptName}</label>
            <select value={automationScript} onChange={(e) => setAutomationScript(e.target.value)}
              className="w-full text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500">
              <option value="Sync code layout">Sync code layout every 30m</option>
              <option value="Keep-Alive Ping">Daemon script auto keep-alive</option>
              <option value="Compress backups">Log compression workflow</option>
              <option value="Screenshot grab">Periodic frame grab and analysis</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t.targetWindowName}</label>
            <input type="text" value={automationWindow} onChange={(e) => setAutomationWindow(e.target.value)}
              className="w-full text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500"
              placeholder="e.g. Discord-Client-Main" />
          </div>
          <button onClick={execute} disabled={isExecuting}
            className="w-full mt-2 py-3 bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 text-xs font-bold rounded-xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition">
            {isExecuting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Executing...</>) : (<><Rocket className="w-4 h-4" /> {t.runBtn}</>)}
          </button>
          {status && <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono text-purple-400">{status}</div>}
        </div>
      </div>

      <div className={`rounded-3xl p-6 border backdrop-blur-xl transition-all ${
        settings.theme === 'dark' ? 'bg-slate-900/40 border-white/10' : 'bg-white hover:border-slate-200 shadow-md'}`}>
        <h3 className="font-bold text-md text-slate-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5"><Tv className="w-4 h-4 text-purple-400" /> About Window Automation</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          Desktop overlay control integrates client window hooks. Trigger automated key combinations, log terminal events, or capture screens directly.
        </p>
        <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-950/20 border border-slate-300/30 dark:border-white/5 space-y-2 text-xs">
          {[['DRIVER VERSION', 'v2.19.4-Active'], ['HOST CONTROLLER', 'COM4 (Hardware Hook)'], ['LAST SIGNAL', 'PING_OK (14ms)']].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center text-[10px] font-mono text-slate-400"><span>{k}</span><span className={k === 'LAST SIGNAL' ? 'text-emerald-500' : ''}>{v}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
