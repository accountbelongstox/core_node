/**
 * PcVersionChips — "Code updated" chips for the pycore-manager top bar.
 *
 * Mirrors the laravel-manager header chip, showing the newest-source-edit time
 * for BOTH pycore and the currently-pointed laravel backend. Honors the comms
 * chain UI -> pycore -> laravel: it calls ONLY pycore (pycoreApi.getVersion,
 * which rides the WS bus) and pycore proxies the laravel version internally.
 *
 * Polls every 10s; a 1s tick refreshes the "N ago" label between polls. Fully
 * self-contained (local state), guarded against an offline backend (shows a
 * muted em-dash chip rather than crashing the top bar).
 */
import React, { useEffect, useRef, useState } from 'react';
import { GitCommitHorizontal } from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { PcVersionInfo } from '../../../core/api-libs/pycore';
import { relativeAgo, absoluteTime } from '../utils/pcFormat';

const POLL_MS = 10000;

const PcVersionChips: React.FC = () => {
  const [info, setInfo] = useState<PcVersionInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const poll = async () => {
      try {
        const r = await pycoreApi.getVersion() as PcVersionInfo & { error?: string; detail?: string };
        if (!mounted.current) return;
        if (r && r.success && r.pycore) {
          setInfo(r); setErr(null);
        } else {
          // Endpoint answered but carried no version payload — almost always a
          // stale pycore that predates /api/local/version (needs a restart).
          setInfo(null);
          setErr(r?.error || r?.detail || 'no version payload — restart pycore to load /api/local/version');
        }
      } catch (e) {
        if (!mounted.current) return;
        setInfo(null);
        const msg = e instanceof Error ? e.message : 'pycore unreachable';
        // A 404 here means the running pycore predates the /api/local/version
        // route — surface a restart hint rather than a raw "HTTP 404".
        setErr(/404|not found/i.test(msg)
          ? 'restart pycore to load the new /api/local/version route'
          : msg);
      }
    };
    void poll();
    const pollId = window.setInterval(() => { void poll(); }, POLL_MS);
    // Re-render each second so the "N ago" label stays fresh without re-fetching.
    const tickId = window.setInterval(() => { if (mounted.current) setTick((n) => n + 1); }, 1000);
    return () => { mounted.current = false; window.clearInterval(pollId); window.clearInterval(tickId); };
  }, []);

  const chip = (label: string, unix: number, file: string, ok: boolean, reason: string | null) => {
    const has = ok && unix > 0;
    const title = has
      ? `${file || label}\nCode updated: ${absoluteTime(unix)} · ${relativeAgo(unix)}`
      : `${label}: ${reason || 'unavailable'}`;
    return (
      <span
        className={`hidden md:inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border ${
          has
            ? 'border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 text-slate-500 dark:text-slate-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        }`}
        title={title}
      >
        <GitCommitHorizontal className="w-3 h-3 shrink-0" />
        <span className="uppercase tracking-wide opacity-70">{label}</span>
        <span className="font-mono">{has ? relativeAgo(unix) : '—'}</span>
      </span>
    );
  };

  const p = info?.pycore;
  const b = info?.backend;
  const backendReason = !info
    ? err
    : (b?.reachable ? null : `unreachable${b?.base_url ? ` (${b.base_url})` : ''}`);
  return (
    <div className="flex items-center gap-2">
      {chip('pycore', p?.last_modified_unix ?? 0, p?.latest_file ?? '', !!p, err)}
      {chip('backend', b?.last_modified_unix ?? 0, b?.latest_file ?? '', !!b?.reachable, backendReason)}
    </div>
  );
};

export default PcVersionChips;
