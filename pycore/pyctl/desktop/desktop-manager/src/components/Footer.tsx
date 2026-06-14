import { useApp } from '../state/AppContext';

export default function Footer() {
  const { settings, accent } = useApp();
  return (
    <footer className={`h-8 px-6 flex items-center justify-between text-[10px] font-mono tracking-wider transition-colors select-none ${
      settings.theme === 'dark' ? 'bg-black text-slate-500' : 'bg-white border-t border-slate-200 text-slate-400'}`}>
      <div>SYSTEM ENGINE: OPTIMIZED (v2.4.1)</div>
      <div className="flex gap-4">
        <span>MEMORY: 244MB</span>
        <span>CPU: 4%</span>
        <span className={`${accent.text} font-semibold`}>NETWORK: LATENCY 14ms</span>
      </div>
    </footer>
  );
}
