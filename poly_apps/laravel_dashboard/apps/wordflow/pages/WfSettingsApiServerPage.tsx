/* [v4.1-Iris] API Server Settings — ported from
 * qy_capacitor/pages/Settings/ApiServer.tsx. Embeds a self-contained endpoint
 * switcher wired to the WordflowApiManager: lists getAllEndpoints(), shows the
 * current selection + per-endpoint health, and lets the user pin one via
 * setEndpoint() or re-detect via recheckWordflowEndpointsNow() (the shared
 * STORED-FIRST pass: stored endpoint only → full sweep only if it's down,
 * + offline-loop re-sync). Switch flow
 * (original ApiEndpointSwitcher semantics): manual pick persists user_modified
 * + current_endpoint, then clearCache() + resetEndpointInit() +
 * wfEventBus.emit('api-endpoint-changed') and an immediate connectivity probe
 * of the picked endpoint. The auth token is intentionally KEPT across switches
 * (all endpoints front the same backend cluster / account system). All async
 * work is try/caught and degrades gracefully. Self-contained: useNavigate +
 * wfPath(), useWfApp().t, shared Iris primitives. Iris reference parity. */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, SectionTitle, Card, Spinner, Button, Badge } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import {
  apiManager, HealthCheckResult, WORDFLOW_API_HEALTH_EVENT, WF_PROBE_ERROR,
} from '../../../core/api-libs/wordflow/WordflowApiManager';
import {
  recheckWordflowEndpointsNow,
  syncWordflowOfflineRecheckLoop,
} from '../../../core/api-libs/wordflow/WordflowHealthRecheck';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { ApiEndpoint } from '../../../core/api-libs/wordflow/wordflow-api-endpoints';
import { wfEventBus } from '../services/WfEventBus';

const formatProbeError = (
  code: string | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): string => {
  if (!code) return '';
  if (code === WF_PROBE_ERROR.HTML) return t('settings.probeHtmlResponse');
  if (code === WF_PROBE_ERROR.TIMEOUT) return t('settings.probeTimeout');
  if (code === WF_PROBE_ERROR.SSL) return t('settings.probeSsl');
  if (code === WF_PROBE_ERROR.CONNECTION) return t('settings.probeConnection');
  if (code.startsWith(`${WF_PROBE_ERROR.HTTP}:`)) {
    const status = code.split(':')[1] || '?';
    return t('settings.probeHttp', { status });
  }
  return code;
};

const WfSettingsApiServerPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfApp();

  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, HealthCheckResult>>({});
  const [probing, setProbing] = useState(false);
  /** Endpoint id whose post-switch connectivity probe is in flight. */
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [intervalSec, setIntervalSec] = useState(() => Math.round(apiManager.getRecheckIntervalMs() / 1000));

  const refresh = useCallback(() => {
    try {
      setEndpoints(apiManager.getAllEndpoints());
      setCurrentId(apiManager.getCurrentEndpoint()?.id ?? null);
      const map: Record<string, HealthCheckResult> = {};
      apiManager.getAllHealthResults().forEach((r) => { map[r.endpoint.id] = r; });
      setHealth(map);
    } catch (e) {
      console.error('[WfSettingsApiServer] refresh failed:', e);
    }
  }, []);

  // The active endpoint was re-pointed (manual pick, or a detect pass failed
  // over): drop the TTL data caches + the one-shot probe promise so the next
  // request re-probes against the new target, then broadcast so live views
  // refetch. The auth token is deliberately NOT cleared — every endpoint
  // fronts the same backend cluster, so the session stays valid.
  const reactToEndpointChange = useCallback((prevId: string | null) => {
    const ep = apiManager.getCurrentEndpoint();
    if (!ep || ep.id === prevId) return;
    try {
      wordflowApi.clearCache();
      wordflowApi.resetEndpointInit();
      wfEventBus.emit('api-endpoint-changed', { endpoint: ep });
    } catch (e) {
      console.error('[WfSettingsApiServer] endpoint-change propagation failed:', e);
    }
  }, []);

  // Manual re-detect: fresh probe + availability-first failover, and it
  // re-syncs the all-Offline retry loop (still down → keep retrying at the
  // configured interval; recovered → loop stops). When the pass actually
  // moves the endpoint, propagate it like a manual switch (prevId-gated so a
  // plain page mount never wipes caches).
  const probeAll = useCallback(async () => {
    setProbing(true);
    const prevId = apiManager.getCurrentEndpoint()?.id ?? null;
    try {
      await recheckWordflowEndpointsNow();
      if (prevId) reactToEndpointChange(prevId);
    } catch (e) {
      console.error('[WfSettingsApiServer] probe failed:', e);
    } finally {
      setProbing(false);
      refresh();
    }
  }, [refresh, reactToEndpointChange]);

  useEffect(() => {
    refresh();
    probeAll();
    // Keep the page live while the background retry loop ticks.
    const onHealthChanged = () => refresh();
    window.addEventListener(WORDFLOW_API_HEALTH_EVENT, onHealthChanged);
    return () => window.removeEventListener(WORDFLOW_API_HEALTH_EVENT, onHealthChanged);
  }, [refresh, probeAll]);

  // Persist the per-end retry interval; the loop reads it fresh on every
  // tick, so it applies without restart. Re-read after set to reflect clamping.
  const commitInterval = () => {
    apiManager.setRecheckIntervalMs(intervalSec * 1000);
    setIntervalSec(Math.round(apiManager.getRecheckIntervalMs() / 1000));
  };

  // Manual pick: pin as the user choice (API_USER_MODIFIED + API_CURRENT_ENDPOINT;
  // later auto-detect passes rank it first but never blindly — a dead manual
  // pick still fails over), propagate the change (cache clear + probe-promise
  // reset + event), then probe the picked endpoint right away (config 3000ms
  // timeout) so its row shows real connectivity immediately.
  const selectEndpoint = async (id: string) => {
    try {
      const prevId = apiManager.getCurrentEndpoint()?.id ?? null;
      if (!apiManager.setEndpoint(id, true)) return;
      setCurrentId(id);
      reactToEndpointChange(prevId);

      const ep = apiManager.getCurrentEndpoint();
      if (ep) {
        setCheckingId(id);
        try {
          await apiManager.checkEndpoint(ep);
        } finally {
          setCheckingId(null);
        }
      }
      // Picked endpoint may be the only healthy one (loop stops) or dead while
      // everything else is too (loop keeps ticking) — re-align it.
      syncWordflowOfflineRecheckLoop();
    } catch (e) {
      console.error('[WfSettingsApiServer] select endpoint failed:', e);
      setCheckingId(null);
    } finally {
      refresh();
    }
  };

  // "Re-run auto-detect": forget the user pin, then run a fresh
  // AVAILABILITY-FIRST pass (parallel probe + failover + offline-loop re-sync
  // + health event). If the pass re-points the endpoint, propagate it.
  const autoDetect = async () => {
    setProbing(true);
    const prevId = apiManager.getCurrentEndpoint()?.id ?? null;
    try {
      apiManager.clearUserModifiedEndpoint();
      await recheckWordflowEndpointsNow();
      reactToEndpointChange(prevId);
    } catch (e) {
      console.error('[WfSettingsApiServer] auto-detect failed:', e);
    } finally {
      setProbing(false);
      refresh();
    }
  };

  // Explicit all-Offline state: every listed endpoint has a settled probe
  // result and none is healthy (the interval retry loop is ticking).
  const allOffline =
    endpoints.length > 0 &&
    endpoints.every((ep) => health[ep.id] !== undefined && !health[ep.id].isHealthy);

  const points = [
    t('settings.serversTestedInOrder'),
    t('settings.firstWorkingSelected'),
    t('settings.healthChecksRun'),
    t('settings.manualSelectionPersists'),
  ];

  return (
    <div className="min-h-screen pb-28">

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.apiServer')}
          </h1>
          <BackButton onClick={() => navigate(wfPath('settings'))} />
        </div>

        {/* Backend API config — gradient hero card */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-white relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-44 h-44 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-1">{t('settings.backendApiConfig')}</h3>
            <p className="text-white/80 text-sm leading-relaxed">{t('settings.backendApiDescription')}</p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Endpoint Switcher */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle
            title={t('settings.apiServer')}
            action={
              <button
                type="button"
                onClick={probeAll}
                disabled={probing}
                className="ds-link-more flex items-center gap-2 disabled:opacity-50"
              >
                {probing ? <Spinner size="sm" /> : null}
                {t('common.refresh')}
              </button>
            }
            className="px-1 mb-1"
          />

          {endpoints.map((ep) => {
            const isActive = ep.id === currentId;
            const result = health[ep.id];
            const url = `${ep.protocol}://${ep.url}${ep.port ? ':' + ep.port : ''}`;
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => selectEndpoint(ep.id)}
                className={`ds-row w-full p-4 flex items-center justify-between gap-3 text-left ds-touch-target transition-all ${
                  isActive ? 'ring-2 ring-[var(--klein-blue)]' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      result ? (result.isHealthy ? 'bg-emerald-500' : 'bg-red-500') : 'bg-[var(--color-text-tertiary)]'
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)] truncate">{ep.description}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] font-mono truncate">{url}</p>
                    {result && !result.isHealthy && result.error && (
                      <p className="text-xs text-red-500 mt-0.5 truncate">
                        {formatProbeError(result.error, t)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {checkingId === ep.id && <Spinner size="sm" />}
                  {result && result.isHealthy && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">{result.responseTime}ms</span>
                  )}
                  {isActive && <Badge tone="klein">{t('settings.active')}</Badge>}
                </div>
              </button>
            );
          })}

          {/* All endpoints Offline — the interval retry loop is ticking; offer
              an immediate manual re-detect. (Existing i18n keys only.) */}
          {allOffline && (
            <div
              className="ds-row p-4 flex items-center justify-between gap-3"
              style={{ borderColor: 'rgba(239,68,68,0.45)' }}
              role="status"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" aria-hidden />
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('settings.allOfflineHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={probeAll}
                disabled={probing}
                className="ds-link-more flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
              >
                {probing ? <Spinner size="sm" /> : null}
                {t('settings.retry')}
              </button>
            </div>
          )}

          <Button variant="secondary" onClick={autoDetect} disabled={probing}>
            {probing ? <Spinner size="sm" /> : null}
            {t('settings.auto')}
          </Button>

          {/* Offline retry interval — only ticks while ALL endpoints are Offline */}
          <div className="ds-row p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)]">
                {t('settings.recheckInterval')}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {t('settings.recheckIntervalHint')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="number"
                min={5}
                step={5}
                value={intervalSec}
                onChange={(e) => setIntervalSec(Number(e.target.value))}
                onBlur={commitInterval}
                onKeyDown={(e) => { if (e.key === 'Enter') commitInterval(); }}
                className="w-20 px-2 py-1.5 text-sm text-right rounded-xl border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)]"
              />
              <span className="text-xs text-[var(--color-text-tertiary)]">s</span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.howItWorks')} className="px-1 mb-1" />
          <Card>
            <ul className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              {points.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Technical Details */}
        <div className="px-1 text-xs text-[var(--color-text-tertiary)] space-y-1.5">
          <p>{t('settings.healthChecksVerify')}</p>
          <p>{t('settings.responseTimesMeasured')}</p>
          <p>{t('settings.endpointSavedLocalStorage')}</p>
        </div>
      </div>
    </div>
  );
};

export default WfSettingsApiServerPage;
