import { Captions, Play, Pause, ChevronRight } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { CATEGORY_ICONS } from '../lib/icons';

/**
 * Subtitle tab: a focused, large-type view of the currently selected queue item's
 * text (subtitle), with a clickable list to switch the active item.
 */
export default function SubtitlePage() {
  const { queue, playerState, setPlayerState, settings, t, accent } = useApp();
  const current = queue.find((q) => q.index === playerState.currentIndex) || queue[0];

  return (
    <div className="grid grid-cols-12 gap-6 lg:items-start">
      {/* Big subtitle stage */}
      <div className="col-span-12 lg:col-span-8">
        <section className={`rounded-3xl border backdrop-blur-xl p-8 min-h-[320px] flex flex-col transition-all ${
          settings.theme === 'dark' ? 'bg-slate-900/45 border-white/10' : 'bg-white/85 border-slate-200 shadow-md'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-md font-bold flex items-center gap-2"><Captions className={`w-5 h-5 ${accent.text}`} /> {t.subtitleMode}</h2>
            {current && (
              <button onClick={() => setPlayerState((p) => ({ ...p, isPlaying: !p.isPlaying }))}
                className={`p-2 rounded-xl text-white bg-gradient-to-tr ${accent.primary} shadow`}>
                {playerState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center text-center">
            {current ? (
              <p className="text-2xl md:text-3xl font-semibold leading-relaxed text-slate-800 dark:text-zinc-100 max-w-2xl">
                {current.text}
              </p>
            ) : (
              <p className="text-sm italic text-slate-500">{t.noSubtitle}</p>
            )}
          </div>
          {current && (
            <div className="mt-6 text-[11px] font-mono text-slate-500 flex items-center justify-center gap-3">
              <span>#{String(current.index).padStart(3, '0')}</span>
              <span className="uppercase">{current.category}</span>
              <span>{new Date(current.created).toLocaleTimeString()}</span>
            </div>
          )}
        </section>
      </div>

      {/* List */}
      <div className="col-span-12 lg:col-span-4">
        <section className={`rounded-3xl border backdrop-blur-xl p-4 transition-all ${
          settings.theme === 'dark' ? 'bg-slate-900/45 border-white/10' : 'bg-white/85 border-slate-200 shadow-md'}`}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-2 py-2">{t.latestItems}</h3>
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {queue.length === 0 && <p className="text-xs italic text-slate-500 px-2 py-4">{t.emptyQueueMsg}</p>}
            {queue.map((item) => {
              const Icon = CATEGORY_ICONS[item.category];
              const active = current && item.index === current.index;
              return (
                <button key={item.id} onClick={() => setPlayerState((p) => ({ ...p, currentIndex: item.index }))}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl transition ${
                    active ? `${accent.bg} ${accent.text}` : 'hover:bg-slate-200/40 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="flex-1 text-xs truncate">{item.text}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
