/** Code-update indicators for the independently addressed backends. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitCommitHorizontal } from 'lucide-react';
import { laravelApi, pycoreApi, PYCORE_HTTP_DEFAULTS } from '@/apps/pycore-manager/api';
import type { PcCodeVersion, PcVersionInfo } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import { relativeAgo, absoluteTime } from '../utils/pcFormat';
import { useTopicDrivenRefresh } from '../hooks/useTopicDrivenRefresh';
import { usePcLaravelEndpoint } from '../PcLaravelEndpointContext';

const PcVersionChips: React.FC = () => {
  const { t } = useTranslation('pc');
  const { current: laravelEndpoint } = usePcLaravelEndpoint();
  const [pycoreVersion, setPycoreVersion] = useState<PcCodeVersion | null>(null);
  const [laravelVersion, setLaravelVersion] = useState<PcCodeVersion | null>(null);
  const [pycoreError, setPycoreError] = useState<string | null>(null);
  const [laravelError, setLaravelError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const mounted = useRef(true);

  const refreshVersion = useCallback(async () => {
    const [pycoreResult, laravelResult] = await Promise.allSettled([
      pycoreApi.getVersion() as Promise<PcVersionInfo & { error?: string; detail?: string }>,
      laravelApi.getCodeVersion() as Promise<PcCodeVersion>,
    ]);
    if (!mounted.current) return;

    if (pycoreResult.status === 'fulfilled' && pycoreResult.value?.success && pycoreResult.value.pycore) {
      setPycoreVersion(pycoreResult.value.pycore);
      setPycoreError(null);
    } else {
      setPycoreVersion(null);
      const reason = pycoreResult.status === 'rejected'
        ? pycoreResult.reason
        : pycoreResult.value?.error || pycoreResult.value?.detail;
      setPycoreError(reason instanceof Error ? reason.message : String(reason || t('version.pycoreUnavailable')));
    }

    if (laravelResult.status === 'fulfilled' && laravelResult.value) {
      setLaravelVersion(laravelResult.value);
      setLaravelError(null);
    } else {
      setLaravelVersion(null);
      const reason = laravelResult.status === 'rejected' ? laravelResult.reason : null;
      setLaravelError(reason instanceof Error ? reason.message : t('version.laravelUnavailable'));
    }
  }, [laravelEndpoint, t]);

  useEffect(() => {
    mounted.current = true;
    void refreshVersion();
    const tickId = window.setInterval(() => {
      if (mounted.current) setTick((value) => value + 1);
    }, 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(tickId);
    };
  }, [refreshVersion]);

  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.operationChanged],
    refreshVersion,
    { fallbackMs: PYCORE_HTTP_DEFAULTS.slowFallbackPollMs },
  );

  const chip = (label: string, version: PcCodeVersion | null, reason: string | null) => {
    const hasVersion = !!version && version.last_modified_unix > 0;
    const title = hasVersion
      ? `${version!.latest_file || label}\n${t('version.codeUpdated')}: ${absoluteTime(version!.last_modified_unix)} · ${relativeAgo(version!.last_modified_unix)}`
      : `${label}: ${reason || t('version.unavailable')}`;
    return (
      <span
        className={`hidden md:inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border ${
          hasVersion
            ? 'border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 text-slate-500 dark:text-slate-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        }`}
        title={title}
      >
        <GitCommitHorizontal className="w-3 h-3 shrink-0" />
        <span className="uppercase tracking-wide opacity-70">{label}</span>
        <span className="font-mono">{hasVersion ? relativeAgo(version!.last_modified_unix) : '—'}</span>
      </span>
    );
  };

  const laravelReason = laravelError || (
    laravelEndpoint ? t('version.unreachableAt', { endpoint: laravelEndpoint }) : t('version.laravelUnavailable')
  );
  return (
    <div className="flex items-center gap-2">
      {chip('pycore', pycoreVersion, pycoreError)}
      {chip('Laravel', laravelVersion, laravelReason)}
    </div>
  );
};

export default PcVersionChips;
