import React, { useEffect, useRef, useState } from 'react';
import { CircleCheck, Loader2, Power, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PYCORE_HTTP_ROUTES, type PycoreHttpApi } from '@/apps/pycore-manager/api';

const RESTART_TIMEOUT_MS = 8000;
const PING_TIMEOUT_MS = 2500;
const RETRY_INTERVAL_MS = 1500;
const CONFIRM_WINDOW_MS = 4000;
const ONLINE_NOTICE_MS = 4000;
const TICK_MS = 1000;
const MS_PER_SECOND = 1000;

type RestartPhase = 'idle' | 'confirm' | 'waiting' | 'online' | 'error';

interface PcPycoreRestartButtonProps {
  /** HTTP client of the pycore node to restart. */
  http: PycoreHttpApi;
  /** Icon-only button for dense headers. */
  compact?: boolean;
  onBackOnline?: () => void;
  className?: string;
}

function startedAt(result: unknown): number | null {
  const value = (result as { process_started_at?: unknown } | null)?.process_started_at;
  return typeof value === 'number' ? value : null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

/** Restart a pycore (second tap confirms), then keep retrying until the new process answers. */
export const PcPycoreRestartButton: React.FC<PcPycoreRestartButtonProps> = ({ http, compact = false, onBackOnline, className = '' }) => {
  const { t } = useTranslation('pc');
  const [phase, setPhase] = useState<RestartPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (phase !== 'confirm') return undefined;
    const timer = window.setTimeout(() => setPhase('idle'), CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const begin = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - begin) / MS_PER_SECOND)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  const waitForNewProcess = async (previous: number | null) => {
    while (aliveRef.current) {
      await sleep(RETRY_INTERVAL_MS);
      try {
        const version = await http.requestPycoreHttp(PYCORE_HTTP_ROUTES.versionVersion, {}, PING_TIMEOUT_MS);
        const current = startedAt(version);
        if (version?.success !== false && (previous === null || (current !== null && current > previous))) return true;
      } catch {
        // Still restarting: keep retrying until it answers.
      }
    }
    return false;
  };

  const restart = async () => {
    setError('');
    setElapsed(0);
    setPhase('waiting');
    let previous: number | null = null;
    try {
      const result = await http.requestPycoreHttp(PYCORE_HTTP_ROUTES.controlRestart, {}, RESTART_TIMEOUT_MS);
      if (result?.success === false) {
        setError(t(`restart.errors.${String(result.error_code)}`, { defaultValue: String(result.error_code || '') }));
        setPhase('error');
        return;
      }
      previous = startedAt(result);
    } catch {
      // The connection may drop as the process restarts; wait for it either way.
    }
    if (!(await waitForNewProcess(previous)) || !aliveRef.current) return;
    setPhase('online');
    onBackOnline?.();
    window.setTimeout(() => { if (aliveRef.current) setPhase('idle'); }, ONLINE_NOTICE_MS);
  };

  const onClick = () => {
    if (phase === 'idle' || phase === 'error' || phase === 'online') setPhase('confirm');
    else if (phase === 'confirm') void restart();
  };

  const label = phase === 'confirm'
    ? t('restart.confirm')
    : phase === 'waiting'
      ? t('restart.waiting', { seconds: elapsed })
      : phase === 'online'
        ? t('restart.online')
        : phase === 'error'
          ? error || t('restart.failed')
          : t('restart.action');
  const icon = phase === 'waiting'
    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
    : phase === 'online'
      ? <CircleCheck className="h-3.5 w-3.5" />
      : phase === 'confirm'
        ? <Power className="h-3.5 w-3.5" />
        : <RotateCcw className="h-3.5 w-3.5" />;
  const tone = phase === 'confirm' || phase === 'error'
    ? 'bg-rose-500/15 text-rose-500 hover:bg-rose-500/25'
    : phase === 'online'
      ? 'bg-emerald-500/15 text-emerald-500'
      : 'pc-glass text-sky-500 hover:bg-sky-500/10';
  const showText = !compact || phase !== 'idle';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={phase === 'waiting'}
      title={t('restart.hint')}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-wait ${tone} ${className}`}
    >
      {icon}
      {showText && <span className="whitespace-nowrap tabular-nums">{label}</span>}
    </button>
  );
};

export default PcPycoreRestartButton;
