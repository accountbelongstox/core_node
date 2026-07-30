/**
 * OkxQuantPanel — the OKX section of the Vortex "量化参数设置" (settings) tab. Lives
 * ONLY in /vortex (alongside OkxBacktestPanel). Talks to the pycore OKX market-data
 * service over the shared pycore HTTP interface; on HTTP connect it
 * pulls the centralized quant-info controller and renders read-only operational cards:
 *   1. Rate limits (client window + OKX note)
 *   2. API usage record (total / rate / in-window / throttled)
 *   3. Database (path, size, instruments+candles, serialize-to-disk action)
 *   4. OKX KEY (masked api_key + reveal-all toggle; secret/passphrase masked by design)
 *   5. Pre-open (待发) source (official API vs scraper-needed + expandable inst list)
 *
 * Mirrors OkxBacktestPanel's conventions: bilingual L(lang) (every string en+zh),
 * dark+lang props, card/chip Tailwind helpers, lucide icons, fmtTs timestamps.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, AlertTriangle, Database, KeyRound, Gauge, Activity, Eye, EyeOff,
  Copy, Check, HardDriveDownload, Rocket, ChevronDown, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { connectPycoreHttp, callRpc, onHttpStatus } from '../../core/api-libs/pycore';
import { VORTEX_PYCORE_ROUTES } from './VortexPycoreProtocol';

interface QuantInfo {
  limits?: { client_window?: { max_requests?: number; time_window?: number }; okx_note?: string };
  usage?: { in_window?: number; max?: number; rate?: number; overall_rate?: number; total?: number; throttled?: boolean };
  database?: { path?: string; exists?: boolean; size_bytes?: number; size_human?: string; instruments?: number; candles?: number; in_memory?: boolean };
  credentials?: { configured?: boolean; api_key_masked?: string; has_secret?: boolean; has_passphrase?: boolean };
  preopen?: { api_available?: boolean; source?: string; count?: number; scraper_needed?: boolean; note?: string };
}
interface RevealedCreds { api_key?: string; secret_masked?: string; passphrase_masked?: string; note?: string }
interface PreopenInst { inst_id: string; state?: string; list_time?: number | null; base_ccy?: string; quote_ccy?: string }

const fmtTs = (t?: number | null) => (t ? new Date(t).toLocaleString() : '—');

const L = (lang: string) => (lang === 'en'
  ? {
      title: 'OKX Quant Settings', sub: 'Rate limits · usage · database · credentials · pre-open',
      refresh: 'Refresh', unreachable: 'pycore unreachable — OKX quant info unavailable.',
      // rate limits
      rateLimits: 'Rate limits', clientWindow: 'Client window', reqsPerWindow: 'requests', windowSec: 's window',
      // usage
      apiUsage: 'API usage record', total: 'Total requests', rate: 'Rate', reqS: 'req/s',
      inWindow: 'In window', throttled: 'THROTTLED', healthy: 'Healthy', overallRate: 'Overall rate',
      // database
      database: 'Database', path: 'Path', size: 'Size', instruments: 'Instruments', candles: 'Candles',
      inMemory: 'IN-MEMORY', onDisk: 'ON-DISK', serialize: 'Serialize to disk now', serializing: 'Serializing…',
      serialized: 'Serialized to disk.', serializeFail: 'Serialize failed.', copied: 'Copied', copyHint: 'Click to copy',
      autoSerialize: 'Auto-serialize', everyN: 'every', secs: 's', autoSerHint: 'Default 5s; backs off to 30s when CPU is busy. Only writes when data changed.',
      // credentials
      okxKey: 'OKX KEY', apiKey: 'API key', secret: 'Secret', passphrase: 'Passphrase',
      showAll: 'Show all', hideKey: 'Hide', revealNote: 'Secret & passphrase are masked-only by design.',
      configured: 'Configured', notConfigured: 'Not configured', present: 'present', missing: 'missing',
      // preopen
      preopen: 'Pre-open source', source: 'Source', count: 'Count',
      officialApi: 'Official OKX API ✓', scraperNeeded: 'Scraping would be required — no official feed',
      showList: 'Show pre-open list', hideList: 'Hide list', listed: 'Listed', state: 'State', noPreopen: 'No pre-open instruments.',
    }
  : {
      title: 'OKX 量化设置', sub: '速率限制 · 用量 · 数据库 · 凭据 · 待发',
      refresh: '刷新', unreachable: 'pycore 不可达 —— 无法获取 OKX 量化信息。',
      rateLimits: '速率限制', clientWindow: '客户端窗口', reqsPerWindow: '次请求', windowSec: '秒窗口',
      apiUsage: 'API 用量记录', total: '总请求数', rate: '速率', reqS: '次/秒',
      inWindow: '窗口内', throttled: '已限流', healthy: '正常', overallRate: '总体速率',
      database: '数据库', path: '路径', size: '大小', instruments: '币种', candles: 'K线',
      inMemory: '内存中', onDisk: '已落盘', serialize: '立即序列化到磁盘', serializing: '序列化中…',
      serialized: '已序列化到磁盘。', serializeFail: '序列化失败。', copied: '已复制', copyHint: '点击复制',
      autoSerialize: '自动序列化', everyN: '每', secs: '秒', autoSerHint: '默认5秒；CPU繁忙时回退到30秒。仅在数据变化时写入。',
      okxKey: 'OKX 密钥', apiKey: 'API Key', secret: 'Secret', passphrase: 'Passphrase',
      showAll: '全部显示', hideKey: '隐藏', revealNote: 'Secret 与 Passphrase 按设计仅做掩码显示。',
      configured: '已配置', notConfigured: '未配置', present: '存在', missing: '缺失',
      preopen: '待发来源', source: '来源', count: '数量',
      officialApi: 'OKX 官方 API ✓', scraperNeeded: '需要抓取 —— 没有官方接口',
      showList: '显示待发列表', hideList: '隐藏列表', listed: '上线', state: '状态', noPreopen: '暂无待发币种。',
    });

export const OkxQuantPanel: React.FC<{ dark: boolean; lang: string }> = ({ dark, lang }) => {
  const t = L(lang);
  const [info, setInfo] = useState<QuantInfo | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [loading, setLoading] = useState(false);
  // OKX KEY reveal: revealed creds (full api_key) cached after the first reveal call.
  const [revealed, setRevealed] = useState<RevealedCreds | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revealing, setRevealing] = useState(false);
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
      const r = await callRpc(VORTEX_PYCORE_ROUTES.quantInfo, {}, 10000);
      if (r) setInfo(r);
      setUnreachable(false);
    } catch {
      setUnreachable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load is driven by HTTP readiness.
  // mirroring OkxBacktestPanel — never call callRpc before the socket is OPEN.
  const loadSerSettings = useCallback(async () => {
    try {
      const s = await callRpc(VORTEX_PYCORE_ROUTES.getSettings, {}, 8000);
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
    try { await callRpc(VORTEX_PYCORE_ROUTES.setSettings, patch, 8000); } catch { /* best-effort */ }
  }, []);

  // OKX KEY reveal toggle: first click fetches the full api_key, subsequent toggles
  // flip the local visibility flag (no re-fetch).
  const toggleReveal = useCallback(async () => {
    if (showKey) { setShowKey(false); return; }
    if (revealed) { setShowKey(true); return; }
    setRevealing(true);
    try {
      const r = await callRpc(VORTEX_PYCORE_ROUTES.revealCredentials, {}, 10000);
      if (r) { setRevealed(r); setShowKey(true); }
    } catch { /* leave masked */ }
    finally { setRevealing(false); }
  }, [showKey, revealed]);

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
      await callRpc(VORTEX_PYCORE_ROUTES.serialize, {}, 15000);
      setSerializeNote(t.serialized);
      refresh();
    } catch {
      setSerializeNote(t.serializeFail);
    } finally {
      setSerializing(false);
      window.setTimeout(() => setSerializeNote(null), 4000);
    }
  }, [refresh, t.serialized, t.serializeFail]);

  const togglePreopen = useCallback(async () => {
    if (showPreopen) { setShowPreopen(false); return; }
    setShowPreopen(true);
    if (preopenList) return;
    setPreopenLoading(true);
    try {
      const r = await callRpc(VORTEX_PYCORE_ROUTES.preopen, {}, 15000);
      setPreopenList(Array.isArray(r?.instruments) ? r.instruments : []);
    } catch { setPreopenList([]); }
    finally { setPreopenLoading(false); }
  }, [showPreopen, preopenList]);

  const limits = info?.limits;
  const usage = info?.usage;
  const db = info?.database;
  const creds = info?.credentials;
  const preopen = info?.preopen;

  // the api_key shown in the KEY card: full when revealed+toggled, else the masked form
  const apiKeyShown = useMemo(
    () => (showKey && revealed?.api_key ? revealed.api_key : (creds?.api_key_masked ?? '—')),
    [showKey, revealed, creds],
  );

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
            <Gauge className="w-5 h-5 text-indigo-400" /> {t.title}
          </h2>
          <p className="text-xs text-slate-400 font-mono">{t.sub}</p>
        </div>
        <button onClick={refresh} title={t.refresh}
          className={`p-2.5 rounded-xl border ${card} text-slate-400 hover:text-indigo-400 transition`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{t.unreachable}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. RATE LIMITS */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(<Activity className="w-4 h-4 text-indigo-400" />, t.rateLimits)}
          {kv(t.clientWindow,
            `${limits?.client_window?.max_requests ?? '—'} ${t.reqsPerWindow} / ${limits?.client_window?.time_window ?? '—'} ${t.windowSec}`)}
          {limits?.okx_note && (
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500 font-mono">{limits.okx_note}</p>
          )}
        </div>

        {/* 2. API USAGE RECORD */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(
            <Gauge className="w-4 h-4 text-fuchsia-400" />, t.apiUsage,
            usage?.throttled
              ? <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-amber-500/15 text-amber-400">{t.throttled}</span>
              : <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-500/15 text-emerald-400">{t.healthy}</span>,
          )}
          {kv(t.total, (usage?.total ?? 0).toLocaleString())}
          {kv(t.rate, `${usage?.rate ?? 0} ${t.reqS}`)}
          {kv(t.overallRate, `${usage?.overall_rate ?? 0} ${t.reqS}`)}
          {kv(t.inWindow, `${usage?.in_window ?? 0} / ${usage?.max ?? 0}`,
            usage?.throttled ? 'text-amber-400' : 'text-slate-200')}
        </div>

        {/* 3. DATABASE */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(
            <Database className="w-4 h-4 text-emerald-400" />, t.database,
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${db?.in_memory ? 'bg-indigo-500/15 text-indigo-400' : 'bg-slate-500/15 text-slate-400'}`}>
              {db?.in_memory ? t.inMemory : t.onDisk}
            </span>,
          )}
          <div className="mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{t.path}</span>
            <button onClick={() => db?.path && copyPath(db.path)} title={t.copyHint}
              className={`mt-1 w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${card} hover:border-indigo-500/40 transition group`}>
              <span className="text-[10px] font-mono text-slate-300 break-all flex-1">{db?.path ?? '—'}</span>
              {copied
                ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                : <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0" />}
            </button>
            {copied && <span className="text-[9px] font-mono text-emerald-400">{t.copied}</span>}
          </div>
          {kv(t.size, db?.size_human ?? '—')}
          {kv(t.instruments, (db?.instruments ?? 0).toLocaleString())}
          {kv(t.candles, (db?.candles ?? 0).toLocaleString())}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={serialize} disabled={serializing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold transition">
              <HardDriveDownload className={`w-3.5 h-3.5 ${serializing ? 'animate-pulse' : ''}`} />
              {serializing ? t.serializing : t.serialize}
            </button>
            {serializeNote && <span className="text-[10px] font-mono text-emerald-400">{serializeNote}</span>}
          </div>
          {/* auto-serialize interval (persisted in pycore settings) */}
          <div className="mt-3 flex items-center gap-2 flex-wrap" title={t.autoSerHint}>
            <button type="button" role="switch" aria-checked={autoSer}
              onClick={() => saveSer({ auto_serialize: !autoSer })}
              className={`relative w-9 h-5 rounded-full transition-colors ${autoSer ? 'bg-emerald-500' : dark ? 'bg-slate-700' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSer ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-[11px] font-bold text-slate-300">{t.autoSerialize}</span>
            <span className="text-[10px] font-mono text-slate-500">{t.everyN}</span>
            <input type="number" min={2} max={3600} value={serSecs} disabled={!autoSer}
              onChange={(e) => setSerSecs(Math.max(2, Number(e.target.value) || 5))}
              onBlur={() => saveSer({ serialize_secs: serSecs })}
              className={`w-16 px-2 py-1 rounded-lg border ${card} bg-transparent text-[11px] font-mono text-slate-200 disabled:opacity-40`} />
            <span className="text-[10px] font-mono text-slate-500">{t.secs}</span>
          </div>
        </div>

        {/* 4. OKX KEY */}
        <div className={`p-4 rounded-2xl border ${card}`}>
          {sectionTitle(
            <KeyRound className="w-4 h-4 text-amber-400" />, t.okxKey,
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${creds?.configured ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
              {creds?.configured ? t.configured : t.notConfigured}
            </span>,
          )}
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{t.apiKey}</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold font-mono text-slate-200 truncate max-w-[180px]">{apiKeyShown}</span>
              <button onClick={toggleReveal} disabled={revealing}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-500/15 text-slate-300 hover:text-indigo-400 text-[10px] font-bold transition shrink-0">
                {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showKey ? t.hideKey : t.showAll}
              </button>
            </div>
          </div>
          {kv(t.secret,
            <span className="flex items-center gap-1.5">
              {revealed?.secret_masked ?? '••••••'}
              <span className={dot(!!creds?.has_secret)} title={creds?.has_secret ? t.present : t.missing} />
            </span>)}
          {kv(t.passphrase,
            <span className="flex items-center gap-1.5">
              {revealed?.passphrase_masked ?? '••••••'}
              <span className={dot(!!creds?.has_passphrase)} title={creds?.has_passphrase ? t.present : t.missing} />
            </span>)}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500 font-mono flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px text-slate-500" />
            {revealed?.note ?? t.revealNote}
          </p>
        </div>

        {/* 5. PRE-OPEN (待发) SOURCE */}
        <div className={`p-4 rounded-2xl border ${card} lg:col-span-2`}>
          {sectionTitle(<Rocket className="w-4 h-4 text-emerald-400" />, t.preopen)}
          <div className="grid grid-cols-2 gap-3 mb-2">
            {kv(t.source, preopen?.source ?? '—')}
            {kv(t.count, (preopen?.count ?? 0).toLocaleString())}
          </div>
          {preopen?.api_available && !preopen?.scraper_needed ? (
            <div className="flex items-center gap-2 text-xs rounded-xl p-2.5 border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" /> <span className="font-bold">{t.officialApi}</span>
              {preopen?.note && <span className="text-[10px] font-mono text-emerald-400/80">· {preopen.note}</span>}
            </div>
          ) : preopen?.scraper_needed ? (
            <div className="flex items-start gap-2 text-xs rounded-xl p-2.5 border bg-amber-500/10 border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span><span className="font-bold">{t.scraperNeeded}</span>{preopen?.note ? ` · ${preopen.note}` : ''}</span>
            </div>
          ) : preopen?.note ? (
            <p className="text-[10px] font-mono text-slate-500">{preopen.note}</p>
          ) : null}

          {/* expandable pre-open instrument list */}
          <button onClick={togglePreopen}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-indigo-400 transition">
            {showPreopen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {showPreopen ? t.hideList : t.showList}
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
                        <th className="py-2 px-3 font-semibold">{t.instruments}</th>
                        <th className="py-2 px-3 font-semibold">{t.listed}</th>
                        <th className="py-2 px-3 font-semibold">{t.state}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {preopenList.map((p) => (
                        <tr key={p.inst_id} className="hover:bg-indigo-500/5">
                          <td className="py-1.5 px-3 font-bold text-slate-200">{p.inst_id}</td>
                          <td className="py-1.5 px-3 text-[10px] text-slate-400">{fmtTs(p.list_time)}</td>
                          <td className="py-1.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/15 text-amber-400">{p.state || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-xs text-slate-500">{t.noPreopen}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OkxQuantPanel;
