import React from 'react';
import BentoCard from '@/shared/ui/BentoCard';
import { FileVideo, Music, Image as ImageIcon, File, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { UploadItem } from './uploadProgress';

interface UploadProgressCardProps {
  items: UploadItem[];
  batchPct: number;
  onDismiss: () => void;
}

// Presentational only. NO try/catch, NO || or ?? (explicit ternaries/if).
const UploadProgressCard: React.FC<UploadProgressCardProps> = ({ items, batchPct, onDismiss }) => {
  const total = items.length;
  const done = items.filter((it) => it.status === 'done').length;
  const failed = items.filter((it) => it.status === 'failed').length;

  const renderTypeIcon = (type: UploadItem['type']) => {
    if (type === 'video') return <FileVideo className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />;
    if (type === 'audio') return <Music className="w-4 h-4 text-violet-500 dark:text-violet-400 shrink-0" />;
    if (type === 'image') return <ImageIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />;
    return <File className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />;
  };

  const renderStatusIcon = (item: UploadItem) => {
    if (item.status === 'done') return <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />;
    if (item.status === 'failed') return <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />;
    return <Loader2 className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0 animate-spin" />;
  };

  const headerControls = (
    <button
      type="button"
      onClick={onDismiss}
      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      aria-label="Dismiss"
    >
      <X className="w-4 h-4" />
    </button>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <BentoCard title="Uploading" headerControls={headerControls} glowing className="max-h-[60vh]">
        <div className="px-4 pt-3">
          <div className="h-1.5 w-full rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-sky-500 dark:bg-sky-400 transition-all duration-300"
              style={{ width: `${batchPct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
            <span>{failed > 0 ? `${done}/${total} done · ${failed} failed` : `${done}/${total} done`}</span>
            <span>{batchPct}%</span>
          </div>
        </div>

        <div className="px-4 py-2 space-y-1.5 max-h-[40vh] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/40 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5"
            >
              {renderTypeIcon(item.type)}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                  {item.name}
                </div>
                {item.status === 'failed' && item.error ? (
                  <div className="text-[10px] text-rose-500 dark:text-rose-400 truncate">
                    {item.error}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {item.pct}%
                  </div>
                )}
              </div>
              {renderStatusIcon(item)}
            </div>
          ))}
        </div>
      </BentoCard>
    </div>
  );
};

export default UploadProgressCard;
