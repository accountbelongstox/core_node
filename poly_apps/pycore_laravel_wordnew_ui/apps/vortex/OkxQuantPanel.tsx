/** OKX quant settings surface of the /vortex app (read-only operational cards). */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw, AlertTriangle, Database, KeyRound, Gauge, Activity,
  Copy, Check, HardDriveDownload, Rocket, ChevronDown, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { classifyPycoreAccess, connectPycoreHttp, requestPycoreHttp, onHttpStatus, type PycoreAccess } from '@/apps/vortex/api';
import { VORTEX_PYCORE_HTTP_ROUTES } from '@/apps/vortex/api';
import { VortexPycoreNotice } from './VortexPycoreNotice';
import { formatTimestamp } from '../../core/utils/formatters';

interface QuantInfo {
  limits?: { client_window?: { max_requests?: number; time_window?: number }; okx_note?: string };
  usage?: { in_window?: number; max?: number; rate?: number; overall_rate?: number; total?: number; throttled?: boolean };
  database?: { path?: string; exists?: boolean; size_bytes?: number; size_human?: string; instruments?: number; candles?: number; in_memory?: boolean };
  credentials?: { configured?: boolean; api_key_masked?: string; has_secret?: boolean; has_passphrase?: boolean };
  preopen?: { api_available?: boolean; source?: string; count?: number; scraper_needed?: boolean; note?: string };
}
interface PreopenInst { inst_id: string; state?: string; list_time?: number | null; base_ccy?: string; quote_ccy?: string }


export const OkxQuantPanel: React.FC<{ dark: boolean }> = ({ dark }) => {
  const { t } = useTranslation('vx');
  const [info, setInfo] = useState<QuantInfo | null>(null);
  const [failure, setFailure] = useState<PycoreAccess | null>(null);
  const [loading, setLoading] = useState(false);
  // copy-on-click feedback for the DB path
  const [copied, setCopied] = useState(false);
  // serialize-to-disk inline result note
  const [serializing, setSerializing] = useState(false);
  const [serializeNote, setSerializeNote] = useState<string | null>(null);
  // auto-serialize settings (interval persisted in pycore user-data store)
  const [autoSer, setAutoSer] = useState(true);
  const [serSecs, setSerSecs] = useState(5);
  // expandable pre-open instrument list
  const [showPreopen, setShowPreopen] = useState(false);
  const [preopenList, setPreopenList] = useState<PreopenInst[] | null>(null);
  const [preopenLoading, setPreopenLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.quantInfo, {}, 10000);
      if (r) setInfo(r);
      setFailure(null);
    } catch (error) {
      setFailure(classifyPycoreAccess(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load is driven by HTTP readiness.
  // Mirror OkxBacktestPanel and wait for transport readiness before requesting data.
  const loadSerSettings = useCallback(async () => {
    try {
      const s = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.getSettings, {}, 8000);
      if (s) { setAutoSer(s.auto_serialize !== false); setSerSecs(Number(s.serialize_secs) || 5); }
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => {
    connectPycoreHttp();
    const off = onHttpStatus((c) => { if (c) { refresh(); loadSerSettings(); } });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist an auto-serialize setting patch (optimistic) to the pycore user-data store.
  const saveSer = useCallback(async (patch: { auto_serialize?: boolean; serialize_secs?: number }) => {
    if (patch.auto_serialize !== undefined) setAutoSer(patch.auto_serialize);
    if (patch.serialize_secs !== undefined) setSerSecs(patch.serialize_secs);
    try { await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.setSettings, patch, 8000); } catch { /* best-effort */ }
  }, []);

  const copyPath = useCallback((path: string) => {
    try {
      navigator.clipboard?.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, []);

  const serialize = useCallback(async () => {
    setSerializing(true);
    setSerializeNote(null);
    try {
      await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.serialize, {}, 15000);
      setSerializeNote(t('quant.serialized'));
      refresh();
    } catch {
      setSerializeNote(t('quant.serializeFail'));
    } finally {
      setSerializing(false);
      window.setTimeout(() => setSerializeNote(null), 4000);
    }
  }, [refresh, t]);

  const togglePreopen = useCallback(async () => {
    if (showPreopen) { setShowPreopen(false); return; }
    setShowPreopen(true);
    if (preopenList) return;
    setPreopenLoading(true);
    try {
      const r = await requestPycoreHttp(VORTEX_PYCORE_HTTP_ROUTES.preopen, {}, 15000);
      setPreopenList(Array.isArray(r?.instruments) ? r.instruments : []);
    } catch { setPreopenList([]); }
    finally { setPreopenLoading(false); }
  }, [showPreopen, preopenList]);

  const limits = info?.limits;
  const usage = info?.usage;
  const db = info?.database;
  const creds = info?.credentials;
  const preopen = info?.preopen;

  const card = dark ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200';
  const dot = (ok: boolean) => `inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`;
  const sectionTitle = (icon: React.ReactNode, label: string, right?: React.ReactNode) => (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-black flex items-center gap-2 text-slate-200">{icon} {label}</span>
      {right}
    </div>
  );
  const kv = (label: string, value: React.ReactNode, valCls = 'text-slate-200') => (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-xs font-bold font-mono tabular-nums ${valCls}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-100">
            <Gauge className="w-5 h-5 text-indigo-400" /> {t('quant.title')}
          </h2>
          <p className="text-xs text-slate-400 font-mono">{t('quant.sub')}</p>
        </div>
        <button onClick={refresh} title={t('quant.refresh')}
          className={`p-2.5 rounded-xl border ${card} text-slate-400 hover:text-indigo-400 transition`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <VortexPycoreNotice failure={failure} unreachableText={t('quant.unreachable')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. RATE LIMITS */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(<Activity className="w-4 h-4 text-indigo-400" />, t('quant.rateLimits'))}
          {kv(t('quant.clientWindow'),
            `${limits?.client_window?.max_requests ?? '—'} ${t('quant.reqsPerWindow')} / ${limits?.client_window?.time_window ?? '—'} ${t('quant.windowSec')}`)}
          {limits?.okx_note && (
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500 font-mono">{limits.okx_note}</p>
          )}
        </div>

        {/* 2. API USAGE RECORD */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(
            <Gauge className="w-4 h-4 text-fuchsia-400" />, t('quant.apiUsage'),
            usage?.throttled
              ? <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-amber-500/15 text-amber-400">{t('quant.throttled')}</span>
              : <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-500/15 text-emerald-400">{t('quant.healthy')}</span>,
          )}
          {kv(t('quant.total'), (usage?.total ?? 0).toLocaleString())}
          {kv(t('quant.rate'), `${usage?.rate ?? 0} ${t('quant.reqS')}`)}
          {kv(t('quant.overallRate'), `${usage?.overall_rate ?? 0} ${t('quant.reqS')}`)}
          {kv(t('quant.inWindow'), `${usage?.in_window ?? 0} / ${usage?.max ?? 0}`,
            usage?.throttled ? 'text-amber-400' : 'text-slate-200')}
        </div>

        {/* 3. DATABASE */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(
            <Database className="w-4 h-4 text-emerald-400" />, t('quant.database'),
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${db?.in_memory ? 'bg-indigo-500/15 text-indigo-400' : 'bg-slate-500/15 text-slate-400'}`}>
              {db?.in_memory ? t('quant.inMemory') : t('quant.onDisk')}
            </span>,
          )}
          <div className="mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{t('quant.path')}</span>
            <button onClick={() => db?.path && copyPath(db.path)} title={t('quant.copyHint')}
              className={`mt-1 w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${card} hover:border-indigo-500/40 transition group`}>
              <span className="text-[10px] font-mono text-slate-300 break-all flex-1">{db?.path ?? '—'}</span>
              {copied
                ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                : <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0" />}
            </button>
            {copied && <span className="text-[9px] font-mono text-emerald-400">{t('quant.copied')}</span>}
          </div>
          {kv(t('quant.size'), db?.size_human ?? '—')}
          {kv(t('quant.instruments'), (db?.instruments ?? 0).toLocaleString())}
          {kv(t('quant.candles'), (db?.candles ?? 0).toLocaleString())}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={serialize} disabled={serializing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold transition">
              <HardDriveDownload className={`w-3.5 h-3.5 ${serializing ? 'animate-pulse' : ''}`} />
              {serializing ? t('quant.serializing') : t('quant.serialize')}
            </button>
            {serializeNote && <span className="text-[10px] font-mono text-emerald-400">{serializeNote}</span>}
          </div>
          {/* auto-serialize interval (persisted in pycore settings) */}
          <div className="mt-3 flex items-center gap-2 flex-wrap" title={t('quant.autoSerHint')}>
            <button type="button" role="switch" aria-checked={autoSer}
              onClick={() => saveSer({ auto_serialize: !autoSer })}
              className={`relative w-9 h-5 rounded-full transition-colors ${autoSer ? 'bg-emerald-500' : dark ? 'bg-slate-700' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSer ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-[11px] font-bold text-slate-300">{t('quant.autoSerialize')}</span>
            <span className="text-[10px] font-mono text-slate-500">{t('quant.everyN')}</span>
            <input type="number" min={2} max={3600} value={serSecs} disabled={!autoSer}
              onChange={(e) => setSerSecs(Math.max(2, Number(e.target.value) || 5))}
              onBlur={() => saveSer({ serialize_secs: serSecs })}
              className={`w-16 px-2 py-1 rounded-lg border ${card} bg-transparent text-[11px] font-mono text-slate-200 disabled:opacity-40`} />
            <span className="text-[10px] font-mono text-slate-500">{t('quant.secs')}</span>
          </div>
        </div>

        {/* 4. OKX KEY */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(
            <KeyRound className="w-4 h-4 text-amber-400" />, t('quant.okxKey'),
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${creds?.configured ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
              {creds?.configured ? t('quant.configured') : t('quant.notConfigured')}
            </span>,
          )}
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{t('quant.apiKey')}</span>
            <span className="text-xs font-bold font-mono text-slate-200 truncate max-w-[180px]">{creds?.api_key_masked ?? '—'}</span>
          </div>
          {kv(t('quant.secret'),
            <span className="flex items-center gap-1.5">
              ••••••
              <span className={dot(!!creds?.has_secret)} title={creds?.has_secret ? t('quant.present') : t('quant.missing')} />
            </span>)}
          {kv(t('quant.passphrase'),
            <span className="flex items-center gap-1.5">
              ••••••
              <span className={dot(!!creds?.has_passphrase)} title={creds?.has_passphrase ? t('quant.present') : t('quant.missing')} />
            </span>)}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500 font-mono flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px text-slate-500" />
            {t('quant.maskedNote')}
          </p>
        </div>

        {/* 5. PRE-OPEN (待发) SOURCE */}
        <div className={`p-4 rounded-2xl border ${card} lg:col-span-2`}>
          {sectionTitle(<Rocket className="w-4 h-4 text-emerald-400" />, t('quant.preopen'))}
          <div className="grid grid-cols-2 gap-3 mb-2">
            {kv(t('quant.source'), preopen?.source ?? '—')}
            {kv(t('quant.count'), (preopen?.count ?? 0).toLocaleString())}
          </div>
          {preopen?.api_available && !preopen?.scraper_needed ? (
            <div className="flex items-center gap-2 text-xs rounded-xl p-2.5 border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" /> <span className="font-bold">{t('quant.officialApi')}</span>
              {preopen?.note && <span className="text-[10px] font-mono text-emerald-400/80">· {preopen.note}</span>}
            </div>
          ) : preopen?.scraper_needed ? (
            <div className="flex items-start gap-2 text-xs rounded-xl p-2.5 border bg-amber-500/10 border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span><span className="font-bold">{t('quant.scraperNeeded')}</span>{preopen?.note ? ` · ${preopen.note}` : ''}</span>
            </div>
          ) : preopen?.note ? (
            <p className="text-[10px] font-mono text-slate-500">{preopen.note}</p>
          ) : null}

          {/* expandable pre-open instrument list */}
          <button onClick={togglePreopen}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-indigo-400 transition">
            {showPreopen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {showPreopen ? t('quant.hideList') : t('quant.showList')}
          </button>
          {showPreopen && (
            <div className={`mt-2 rounded-xl border overflow-hidden ${card}`}>
              {preopenLoading ? (
                <div className="h-20 flex items-center justify-center text-xs text-slate-500">…</div>
              ) : (preopenList && preopenList.length > 0) ? (
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className={`sticky top-0 ${dark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur`}>
                      <tr className="text-slate-400 uppercase text-[10px]">
                        <th className="py-2 px-3 font-semibold">{t('quant.instruments')}</th>
                        <th className="py-2 px-3 font-semibold">{t('quant.listed')}</th>
                        <th className="py-2 px-3 font-semibold">{t('quant.state')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {preopenList.map((p) => (
                        <tr key={p.inst_id} className="hover:bg-indigo-500/5">
                          <td className="py-1.5 px-3 font-bold text-slate-200">{p.inst_id}</td>
                          <td className="py-1.5 px-3 text-[10px] text-slate-400">{formatTimestamp(p.list_time)}</td>
                          <td className="py-1.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/15 text-amber-400">{p.state || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-xs text-slate-500">{t('quant.noPreopen')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OkxQuantPanel;
