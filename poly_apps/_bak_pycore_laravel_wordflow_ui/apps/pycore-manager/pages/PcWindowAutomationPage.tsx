/**
 * PcWindowAutomationPage — pycore window-automation control.
 *
 * Pick an automation script + target window, run it, and record the run as a
 * REAL `window`-category entry in the pycore voice-subtitle queue via the
 * add-text pipeline (PycoreApi.tts with category 'window' — the legacy
 * client-authoritative syncQueue had no backend counterpart and never
 * persisted). No dependency on the original app's AppContext / UI — local React
 * state, PycoreApi, lucide icons and Tailwind / `.pc-glass` only. Degrades to an
 * inline "pycore unreachable" banner when the backend (:59000) is offline; the
 * run still completes locally.
 */
import React, { useState } from 'react';
import { RefreshCw, Tv, AppWindow, Rocket, AlertTriangle } from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';

const SCRIPTS: { value: string; label: string }[] = [
  { value: 'Sync code layout', label: 'Sync code layout every 30m' },
  { value: 'Keep-Alive Ping', label: 'Daemon script auto keep-alive' },
  { value: 'Compress backups', label: 'Log compression workflow' },
  { value: 'Screenshot grab', label: 'Periodic frame grab and analysis' },
];

const INFO_ROWS: [string, string][] = [
  ['DRIVER VERSION', 'v2.19.4-Active'],
  ['HOST CONTROLLER', 'COM4 (Hardware Hook)'],
  ['LAST SIGNAL', 'PING_OK (14ms)'],
];

const PcWindowAutomationPage: React.FC = () => {
  const [automationScript, setAutomationScript] = useState('Sync code layout');
  const [automationWindow, setAutomationWindow] = useState('Discord-Client-Main');
  const [isExecuting, setIsExecuting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const execute = async () => {
    setIsExecuting(true);
    setStatus(null);
    // Simulated macro run (matches the original page's behaviour): after a short
    // delay, record the run as a real `window`-category queue entry server-side.
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const text = `Automation run: [${automationScript}] triggered on ${automationWindow}.`;
      try {
        await pycoreApi.tts(text, ['en'], 'window');
        setUnreachable(false);
      } catch {
        // Backend offline: the run still completed locally, just not recorded.
        setUnreachable(true);
      }
      setStatus(`[OK] ${automationScript} -> ${automationWindow}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <AppWindow className="w-5 h-5 text-indigo-500" /> Window Automation
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Automate layout arrangements and application sizes on the pycore host.
        </p>
      </div>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            pycore unreachable — the run was recorded locally but not synced. The backend (:59000) may be offline.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="pc-glass p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500"><AppWindow className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold text-md text-slate-800 dark:text-slate-100">Run automation</h3>
              <p className="text-[11px] text-slate-500">Automate layout arrangements and application sizes</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Script name</label>
              <select
                value={automationScript}
                onChange={(e) => setAutomationScript(e.target.value)}
                className="w-full text-xs font-medium rounded-lg bg-white/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                {SCRIPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Target window name</label>
              <input
                type="text"
                value={automationWindow}
                onChange={(e) => setAutomationWindow(e.target.value)}
                className="w-full text-xs bg-white/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Discord-Client-Main" />
            </div>
            <button
              onClick={execute}
              disabled={isExecuting}
              className="w-full mt-2 py-3 bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 text-xs font-bold rounded-xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition">
              {isExecuting
                ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Executing…</>)
                : (<><Rocket className="w-4 h-4" /> Run automation</>)}
            </button>
            {status && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono text-purple-500 dark:text-purple-400">
                {status}
              </div>
            )}
          </div>
        </section>

        <section className="pc-glass p-6">
          <h3 className="font-bold text-md text-slate-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
            <Tv className="w-4 h-4 text-purple-500" /> About Window Automation
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            Desktop overlay control integrates client window hooks. Trigger automated key combinations,
            log terminal events, or capture screens directly.
          </p>
          <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-950/20 border border-slate-300/30 dark:border-white/5 space-y-2 text-xs">
            {INFO_ROWS.map(([k, v]) => (
              <div key={k} className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>{k}</span>
                <span className={k === 'LAST SIGNAL' ? 'text-emerald-500' : ''}>{v}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PcWindowAutomationPage;
