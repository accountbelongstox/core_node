import { Check, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../state/AppContext';

export default function Toasts() {
  const { toasts, dismissToast, settings } = useApp();
  return (
    <div className="fixed bottom-12 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((item) => (
        <div key={item.id}
          style={{
            backgroundColor: settings.theme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: item.type === 'success' ? 'rgba(16, 185, 129, 0.5)' : item.type === 'error' ? 'rgba(244, 63, 94, 0.5)' : 'rgba(99, 102, 241, 0.5)',
          }}
          className="p-3.5 rounded-2xl border backdrop-blur-md shadow-xl flex items-start gap-2.5 animate-float pointer-events-auto transition text-xs">
          <span className={`p-1 rounded ${item.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : item.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
            {item.type === 'success' ? <Check className="w-3.5 h-3.5" /> : item.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
          </span>
          <div className="flex-1"><p className="font-semibold text-slate-800 dark:text-zinc-100">{item.message}</p></div>
          <button onClick={() => dismissToast(item.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition"><X className="w-3 h-3" /></button>
        </div>
      ))}
    </div>
  );
}
