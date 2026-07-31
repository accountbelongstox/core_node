import React, { useEffect, useRef, useState } from 'react';
import { Server, ChevronDown, RefreshCw, CircleAlert } from 'lucide-react';
import Portal from './Portal';
import { PYCORE_HTTP_ROUTES, requestPycoreHttp, subscribe } from '@/apps/laravel-manager/integrations/pycore';

interface LaravelLogEntry {
    id: string;
    timestamp: string;
    level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
    channel: string;
    message: string;
    context?: Record<string, any>;
    trace_id?: string;
}

interface LaravelLogSnapshot {
    source_id: string;
    entries: LaravelLogEntry[];
    stale: boolean;
    source_updated_at?: string;
    revision: number;
    timestamps: {
        last_success_at?: number;
        last_attempt_at?: number;
    };
    error?: any;
}

const LEVEL_COLORS: Record<string, string> = {
    debug: 'text-slate-500 dark:text-slate-400',
    info: 'text-blue-500 dark:text-blue-400',
    notice: 'text-teal-500 dark:text-teal-400',
    warning: 'text-amber-500 dark:text-amber-400',
    error: 'text-red-500 dark:text-red-400',
    critical: 'text-rose-600 dark:text-rose-400',
    alert: 'text-fuchsia-600 dark:text-fuchsia-400',
    emergency: 'text-red-700 dark:text-red-500 font-bold',
};

const LaravelLogPanel: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [snapshot, setSnapshot] = useState<LaravelLogSnapshot | null>(null);
    const [loading, setLoading] = useState(false);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const pinnedToTail = useRef(true);

    const fetchSnapshot = async () => {
        setLoading(true);
        try {
            const res = await requestPycoreHttp(PYCORE_HTTP_ROUTES.laravelLogsSnapshot, {});
            if (res.success && res.data) {
                setSnapshot(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch Laravel logs snapshot', err);
        } finally {
            setLoading(false);
        }
    };

    const triggerRefresh = async () => {
        try {
            await requestPycoreHttp(PYCORE_HTTP_ROUTES.laravelLogsRefresh, {});
        } catch (err) {
            console.error('Failed to trigger Laravel logs refresh', err);
        }
    };

    // Auto-follow tail
    useEffect(() => {
        if (!open) return;
        const el = scrollRef.current;
        if (el && pinnedToTail.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [snapshot?.entries, open]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        pinnedToTail.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    };

    const entries = snapshot?.entries || [];
    const errorCount = entries.reduce((n, e) => (['error', 'critical', 'alert', 'emergency'].includes(e.level) ? n + 1 : n), 0);
    const latest = entries.length ? entries[entries.length - 1] : null;

    return (
        <Portal lockScroll={false}>
            <div className="fixed bottom-3 left-3 z-[150] flex flex-col items-start pointer-events-none">
                {open && (
                    <div className="pointer-events-auto mb-2 w-[min(800px,calc(100vw-2rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                            <Server className="w-3.5 h-3.5 text-rose-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">Laravel Logs</span>

                            {snapshot?.stale && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-medium">
                                    STALE
                                </span>
                            )}

                            <span className="text-slate-400 truncate max-w-[200px]" title={snapshot?.source_id}>
                                {snapshot?.source_id?.replace(/^https?:\/\//, '') || 'No endpoint'}
                            </span>

                            <span className="flex-1" />

                            <button
                                type="button"
                                onClick={triggerRefresh}
                                disabled={loading}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                title="Refresh logs"
                            >
                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Collapse"
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {snapshot?.error && (
                            <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 text-xs text-red-600 dark:text-red-400">
                                <span className="font-semibold">Sync Error:</span> {typeof snapshot.error === 'string' ? snapshot.error : JSON.stringify(snapshot.error)}
                            </div>
                        )}

                        <div
                            ref={scrollRef}
                            onScroll={onScroll}
                            className="h-72 overflow-auto px-3 py-2 font-mono text-xs leading-5"
                        >
                            {entries.length === 0 ? (
                                <p className="text-slate-400 py-2">No Laravel logs available.</p>
                            ) : (
                                entries.map((e) => (
                                    <div key={e.id} className="flex gap-2 mb-1">
                                        <span className="text-slate-400 flex-shrink-0">{e.timestamp.split(' ')[1]}</span>
                                        <span className={`flex-shrink-0 w-16 uppercase ${LEVEL_COLORS[e.level] || 'text-slate-500'}`}>
                                            {e.level}
                                        </span>
                                        <span className="text-slate-500 flex-shrink-0 w-20 truncate" title={e.channel}>
                                            [{e.channel}]
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                                                {e.message}
                                            </span>
                                            {e.trace_id && (
                                                <span className="ml-2 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                                    trace: {e.trace_id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Collapsed pill */}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    title={open ? 'Collapse Laravel logs' : 'Expand Laravel logs'}
                    className="pointer-events-auto flex items-center gap-2 max-w-[min(560px,calc(100vw-2rem))] px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg text-xs text-slate-500 dark:text-slate-400 hover:border-rose-300 dark:hover:border-rose-700 transition-colors"
                >
                    <Server className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                    <span className="font-medium text-slate-700 dark:text-slate-200 flex-shrink-0">Laravel</span>

                    {snapshot?.stale && (
                        <span className="px-1.5 py-px rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex-shrink-0 font-medium">
                            STALE
                        </span>
                    )}

                    {errorCount > 0 && (
                        <span className="flex items-center gap-0.5 px-1.5 py-px rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex-shrink-0">
                            <CircleAlert className="w-3 h-3" />
                            {errorCount}
                        </span>
                    )}

                    {!open && latest && (
                        <span className={`truncate font-mono ${LEVEL_COLORS[latest.level] || 'text-slate-500'}`}>
                            {latest.message.split('\n')[0]}
                        </span>
                    )}
                </button>
            </div>
        </Portal>
    );
};

export default LaravelLogPanel;
