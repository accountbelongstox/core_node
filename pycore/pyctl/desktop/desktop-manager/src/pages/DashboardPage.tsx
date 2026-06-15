import { useState } from 'react';
import {
  Play, Trash2, RefreshCw, Layers, Layers2, PlusCircle, AppWindow, Clapperboard, FolderOpen,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import VoicePlayer from '../components/VoicePlayer';
import type { QueueItem } from '../types';

export default function DashboardPage() {
  const { queue, setQueue, syncQueue, fetchQueue, settings, t, toast, playerState, setPlayerState, setActiveTab } = useApp();

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [batchCategory, setBatchCategory] = useState('');
  const [newQuickEntry, setNewQuickEntry] = useState('');
  const [quickCategory, setQuickCategory] = useState<QueueItem['category']>('Voice');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  const persist = (items: QueueItem[]) => { setQueue(items); syncQueue(items); };
  const getFilteredItems = () =>
    selectedCategoryFilter === 'all' ? queue : queue.filter((i) => i.category.toLowerCase() === selectedCategoryFilter);

  const totalItemsCount = queue.length;
  const todayItemsCount = queue.filter((q) => q.created.startsWith(new Date().toISOString().slice(0, 10))).length;

  const handleAddEntry = () => {
    if (!newQuickEntry.trim()) return;
    const nextIdx = queue.length ? Math.max(...queue.map((q) => q.index)) + 1 : 1;
    persist([...queue, {
      id: `item_${Date.now()}`, index: nextIdx, text: newQuickEntry.trim(),
      category: quickCategory, playCount: 0, created: new Date().toISOString(), status: 'pending',
    }]);
    setNewQuickEntry('');
    toast(`Added entry #${nextIdx}`, 'success');
  };
  const handleDeleteRow = (id: string) => {
    persist(queue.filter((i) => i.id !== id));
    setSelectedRowIds((p) => p.filter((r) => r !== id));
    toast('Item removed', 'info');
  };
  const handleClearQueue = () => { persist([]); setSelectedRowIds([]); toast('Queue cleared', 'error'); };
  const toggleRowSelect = (id: string) =>
    setSelectedRowIds((p) => (p.includes(id) ? p.filter((r) => r !== id) : [...p, id]));
  const toggleSelectAll = () => {
    const ids = getFilteredItems().map((q) => q.id);
    const all = ids.every((id) => selectedRowIds.includes(id));
    setSelectedRowIds((p) => (all ? p.filter((id) => !ids.includes(id)) : Array.from(new Set([...p, ...ids]))));
  };
  const handleDeleteSelected = () => {
    if (!selectedRowIds.length) return;
    persist(queue.filter((i) => !selectedRowIds.includes(i.id)));
    toast(`Deleted ${selectedRowIds.length} items`, 'info');
    setSelectedRowIds([]);
  };
  const handleApplyBatchCategory = () => {
    if (!selectedRowIds.length || !batchCategory) return;
    persist(queue.map((i) => (selectedRowIds.includes(i.id) ? { ...i, category: batchCategory as QueueItem['category'] } : i)));
  };

  return (
    <div className="grid grid-cols-12 gap-8 lg:items-start">
      {/* LEFT COLUMN */}
      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <VoicePlayer
          queue={queue}
          setQueue={persist}
          playerState={playerState}
          setPlayerState={setPlayerState}
          settings={settings}
          toast={toast}
        />

        <section className={`p-6 rounded-3xl border backdrop-blur-xl transition-all ${
          settings.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/80 border-slate-200/50 shadow-sm'}`}>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-4 flex items-center justify-between">
            <span>{t.activeTaskCount}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">ACTIVE CONTROLLERS</span>
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-200/30 dark:bg-white/5 border border-slate-300/20 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center"><AppWindow className="w-4.5 h-4.5" /></div>
                <div>
                  <div className="text-xs font-bold">{t.windowAutomation}</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">Auto layout intervals enabled</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold">READY</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-200/30 dark:bg-white/5 border border-slate-300/20 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><Clapperboard className="w-4.5 h-4.5" /></div>
                <div>
                  <div className="text-xs font-bold">NotebookLM Cached Audio</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">Fast file parsing on server</div>
                </div>
              </div>
              <button onClick={() => setActiveTab('video_extract')}
                className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 text-sky-400 rounded-md text-[9px] uppercase font-bold tracking-tight transition">
                Convert Code
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: queue grid */}
      <div className="col-span-12 lg:col-span-7 flex flex-col">
        <section className={`h-full rounded-3xl border backdrop-blur-xl flex flex-col transition-all overflow-hidden ${
          settings.theme === 'dark' ? 'bg-slate-900/45 border-white/10' : 'bg-white/85 border-slate-200 shadow-md'}`}>
          <div className="p-6 border-b border-slate-200/40 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <h2 className="text-md font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" /> {t.queueManager}
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">{queue.length}</span>
              </h2>
              <div className="flex gap-1.5 overflow-x-auto py-0.5">
                {['all', 'Voice', 'Window', 'Task', 'Video'].map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategoryFilter(cat.toLowerCase())}
                    className={`px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase transition ${
                      selectedCategoryFilter === cat.toLowerCase() ? 'bg-sky-500 text-white'
                        : 'bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800'}`}>
                    {cat === 'all' ? t.allCategories : cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { fetchQueue(); toast(t.refresh, 'info'); }}
                className="p-2 rounded-lg bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-slate-300/40 dark:border-white/10 text-xs transition" title={t.refresh}>
                <RefreshCw className="w-4 h-4 text-sky-400" />
              </button>
              <button onClick={handleClearQueue}
                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-xs transition" title={t.clearQueue}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedRowIds.length > 0 && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-mono text-amber-500 font-semibold">Selected: {selectedRowIds.length} items</span>
              <div className="flex items-center gap-2">
                <select value={batchCategory} onChange={(e) => setBatchCategory(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none">
                  <option value="">{t.changeCategory}</option>
                  {['Voice', 'Image', 'File', 'Task', 'Video', 'Window'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={handleApplyBatchCategory} disabled={!batchCategory}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-extrabold rounded text-[10px] transition">{t.applyCategory}</button>
                <button onClick={handleDeleteSelected}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded text-[10px] transition">{t.deleteSelected}</button>
                <button onClick={() => setSelectedRowIds([])} className="text-slate-400 hover:text-slate-200 px-1 font-semibold">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-x-auto p-4 md:p-6 max-h-[360px] overflow-y-auto">
            {getFilteredItems().length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-500">
                <Layers2 className="w-8 h-8 opacity-40 mb-2 text-sky-500" />
                <p className="text-xs font-sans italic">{t.emptyQueueMsg}</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 dark:text-zinc-500 uppercase text-[10px] tracking-wider border-b border-slate-200/40 dark:border-white/5">
                    <th className="pb-3 text-center w-8">
                      <input type="checkbox"
                        checked={getFilteredItems().length > 0 && getFilteredItems().every((i) => selectedRowIds.includes(i.id))}
                        onChange={toggleSelectAll} className="rounded bg-slate-100 border-slate-300 accent-sky-500 cursor-pointer" />
                    </th>
                    <th className="pb-3 font-semibold">{t.index}</th>
                    <th className="pb-3 font-semibold">{t.text}</th>
                    <th className="pb-3 font-semibold">{t.category}</th>
                    <th className="pb-3 font-semibold">{t.playCount}</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {getFilteredItems().map((item) => {
                    const isPlaying = playerState.currentIndex === item.index;
                    return (
                      <tr key={item.id} className={`group hover:bg-slate-300/10 dark:hover:bg-white/5 transition-colors ${isPlaying ? 'bg-sky-500/10 dark:bg-sky-500/5' : ''}`}>
                        <td className="py-3 text-center">
                          <input type="checkbox" checked={selectedRowIds.includes(item.id)} onChange={() => toggleRowSelect(item.id)}
                            className="rounded bg-slate-100 border-slate-300 accent-sky-500 cursor-pointer" />
                        </td>
                        <td className="py-3 font-mono opacity-50 font-semibold">{String(item.index).padStart(3, '0')}</td>
                        <td className="py-3 max-w-xs md:max-w-sm">
                          <p className="font-sans font-medium text-slate-800 dark:text-zinc-200 line-clamp-2">{item.text}</p>
                          {item.metadata?.fileName && (
                            <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" /> {item.metadata.fileName}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.category === 'Voice' ? 'bg-blue-500/15 text-blue-500'
                              : item.category === 'Window' ? 'bg-purple-500/15 text-purple-500'
                              : item.category === 'Task' ? 'bg-amber-500/15 text-amber-500'
                              : item.category === 'Video' ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-emerald-500/15 text-emerald-500'}`}>{item.category}</span>
                        </td>
                        <td className="py-3 font-mono font-medium text-center sm:text-left">{item.playCount}</td>
                        <td className="py-3">
                          <span className={`text-[9px] font-bold uppercase ${item.status === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {item.status === 'completed' ? 'READY' : 'QUEUED'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setPlayerState((p) => ({ ...p, currentIndex: item.index, isPlaying: true })); toast(`Playing #${item.index}`, 'success'); }}
                              className="p-1 rounded bg-sky-500/10 text-sky-500 hover:bg-sky-500/25 transition" title="Play">
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button onClick={() => handleDeleteRow(item.id)}
                              className="p-1 rounded bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-zinc-500 dark:hover:text-red-400 hover:text-red-600 transition" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-6 mt-auto bg-slate-200/50 dark:bg-black/40 rounded-b-3xl border-t border-slate-200/40 dark:border-white/5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex gap-4">
                <div className="text-center sm:text-left">
                  <div className="text-lg font-bold font-mono">{totalItemsCount}</div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">{t.totalItems}</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-lg font-bold font-mono text-emerald-400">+{todayItemsCount}</div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">{t.todayItems}</div>
                </div>
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-2">
                <input type="text" value={newQuickEntry} onChange={(e) => setNewQuickEntry(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()} placeholder={t.enterText}
                  className="flex-1 text-xs bg-white/70 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                <div className="flex gap-2">
                  <select value={quickCategory} onChange={(e) => setQuickCategory(e.target.value as QueueItem['category'])}
                    className="text-xs font-semibold rounded-xl bg-white/70 dark:bg-[#121214] border border-slate-300 dark:border-white/10 px-2 py-1 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-sky-500">
                    {['Voice', 'Image', 'File', 'Task', 'Video', 'Window'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={handleAddEntry} disabled={!newQuickEntry.trim()}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/20 transition flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5" /> {t.addEntry}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
