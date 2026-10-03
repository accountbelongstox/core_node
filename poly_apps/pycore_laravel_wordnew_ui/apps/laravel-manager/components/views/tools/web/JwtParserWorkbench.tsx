/** JWT parser: colored token anatomy, decoded claims with time status and Web Crypto signature check. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BadgeCheck, Clock, Eraser, KeyRound, ShieldAlert, ShieldCheck, ShieldQuestion, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CopyBtn, Notice, Pane, WEB_MONO_INPUT_CLASS, WebPage, lastInput, pickString, useDebounced, useToolRecord } from './kit/webKit';
import { JsonHighlight } from './kit/JsonHighlight';
import { JWT_TIME_CLAIMS, claimSeconds, decodeJwt, jwtTiming, normalizeToken, verifyJwt, type JwtTimeStatus, type JwtVerifyResult } from './logic/jwt';
import type { JsonValue } from './logic/json';

const SAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const SAMPLE_SECRET = 'your-256-bit-secret';
const TICK_MS = 1000;
const VERIFY_DEBOUNCE_MS = 250;
const REGISTERED = ['iss', 'sub', 'aud', 'jti', 'typ', 'kid'] as const;
const SEGMENT_CLASS = ['text-rose-600 dark:text-rose-400', 'text-violet-600 dark:text-violet-400', 'text-cyan-600 dark:text-cyan-400'];
const SEGMENT_DOT = ['bg-rose-500', 'bg-violet-500', 'bg-cyan-500'];
const SEGMENT_KEYS = ['header', 'payload', 'signature'] as const;
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
const STATUS_STYLE: Record<JwtTimeStatus, string> = {
  valid: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  expired: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300',
  not_yet_valid: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  no_expiry: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const relative = (formatter: Intl.RelativeTimeFormat, ms: number): string => {
  const seconds = Math.round(ms / 1000);
  const [unit, size] = RELATIVE_UNITS.find(([, span]) => Math.abs(seconds) >= span) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return formatter.format(Math.trunc(seconds / size), unit);
};

const displayValue = (value: JsonValue): string => (typeof value === 'string' ? value : JSON.stringify(value));

const JwtParserWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [token, setToken] = useState(pickString(prefill, 'token', ''));
  const [key, setKey] = useState('');
  const [now, setNow] = useState(Date.now());
  const [verdict, setVerdict] = useState<JwtVerifyResult | null>(null);
  const debouncedKey = useDebounced(key, VERIFY_DEBOUNCE_MS);
  const debouncedToken = useDebounced(token, VERIFY_DEBOUNCE_MS);

  const decoded = useMemo(() => (token.trim() ? decodeJwt(token) : null), [token]);
  const jwt = decoded?.ok ? decoded.jwt : null;
  const timing = useMemo(() => (jwt ? jwtTiming(jwt.payload, now) : null), [jwt, now]);
  const formatter = useMemo(() => new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }), [i18n.language]);
  const headerText = useMemo(() => (jwt ? JSON.stringify(jwt.header, null, 2) : ''), [jwt]);
  const payloadText = useMemo(() => (jwt ? JSON.stringify(jwt.payload, null, 2) : ''), [jwt]);
  const hasTime = !!jwt && JWT_TIME_CLAIMS.some((claim) => claimSeconds(jwt.payload, claim) !== null);

  useEffect(() => {
    if (!hasTime) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [hasTime]);

  useEffect(() => {
    const target = decodeJwt(debouncedToken);
    if (!target.ok || !debouncedKey.trim()) { setVerdict(null); return undefined; }
    let cancelled = false;
    void verifyJwt(target.jwt.parts, target.jwt.alg, debouncedKey).then((result) => { if (!cancelled) setVerdict(result); });
    return () => { cancelled = true; };
  }, [debouncedToken, debouncedKey]);

  const parts = jwt ? jwt.parts : normalizeToken(token).split('.');
  const recordRun = () => record({ token }, { alg: jwt?.alg ?? '', status: timing?.status ?? null });
  const algNone = jwt?.alg.toLowerCase() === 'none';
  const hmac = jwt?.alg.startsWith('HS') ?? true;

  const statusLabel = timing ? t(`toolsWeb.jwt.status_${timing.status}`) : '';
  const statusDetail = timing
    ? timing.status === 'expired' && timing.expiresInMs !== null ? relative(formatter, timing.expiresInMs)
      : timing.status === 'not_yet_valid' && timing.notBeforeInMs !== null ? relative(formatter, timing.notBeforeInMs)
        : timing.expiresInMs !== null ? relative(formatter, timing.expiresInMs) : ''
    : '';

  const verdictView = (): { tone: 'ok' | 'error' | 'warn' | 'info'; icon: typeof ShieldCheck; text: string } | null => {
    if (!jwt) return null;
    if (algNone) return { tone: 'warn', icon: ShieldAlert, text: t('toolsWeb.jwt.verify_none_alg') };
    if (!verdict) return { tone: 'info', icon: ShieldQuestion, text: t('toolsWeb.jwt.verify_idle') };
    if (verdict === 'valid') return { tone: 'ok', icon: ShieldCheck, text: t('toolsWeb.jwt.verify_valid') };
    if (verdict === 'invalid') return { tone: 'error', icon: ShieldAlert, text: t('toolsWeb.jwt.verify_invalid') };
    return { tone: 'warn', icon: ShieldAlert, text: t(`toolsWeb.jwt.verify_${verdict}`) };
  };
  const verdictInfo = verdictView();

  return (
    <WebPage>
      <Pane
        title={t('toolsWeb.jwt.token')}
        icon={BadgeCheck}
        actions={(
          <>
            <Btn icon={Wand2} onClick={() => { setToken(SAMPLE_TOKEN); setKey(SAMPLE_SECRET); }}>{t('toolsWeb.common.sample')}</Btn>
            <Btn icon={Eraser} disabled={!token && !key} onClick={() => { setToken(''); setKey(''); }}>{t('uiTools.common.clear')}</Btn>
          </>
        )}
      >
        <textarea
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={t('toolsWeb.jwt.placeholder')}
          spellCheck={false}
          rows={4}
          className={`${WEB_MONO_INPUT_CLASS} block resize-y rounded-none border-0 text-xs focus:ring-0`}
        />
        {token.trim() && (
          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <p className="break-all font-mono text-[13px] leading-6" aria-label={t('toolsWeb.jwt.anatomy')}>
              {parts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-slate-400">.</span>}
                  <span className={SEGMENT_CLASS[Math.min(i, 2)]}>{part}</span>
                </React.Fragment>
              ))}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {SEGMENT_KEYS.map((name, i) => (
                <span key={name} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${SEGMENT_DOT[i]}`} />{t(`toolsWeb.jwt.${name}`)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Pane>

      {decoded && decoded.ok === false && <Notice tone="error" icon={AlertTriangle}>{t(`toolsWeb.jwt.errors.${decoded.code}`)}</Notice>}

      {jwt && timing && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLE[timing.status]}`}>
              <Clock className="h-3.5 w-3.5" aria-hidden />{statusLabel}{statusDetail && <span className="font-normal opacity-80">{`· ${statusDetail}`}</span>}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 font-mono text-xs font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">
              {t('toolsWeb.jwt.algorithm')}: {jwt.alg || '-'}
            </span>
            {typeof jwt.header.typ === 'string' && (
              <span className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 font-mono text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">typ: {jwt.header.typ}</span>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Pane title={t('toolsWeb.jwt.header')} actions={<CopyBtn getText={() => headerText} onCopied={recordRun} />} bodyClassName="p-3">
              <JsonHighlight text={headerText} />
            </Pane>
            <Pane title={t('toolsWeb.jwt.payload')} actions={<CopyBtn getText={() => payloadText} onCopied={recordRun} />} bodyClassName="p-3">
              <JsonHighlight text={payloadText} />
            </Pane>
          </div>

          <Pane title={t('toolsWeb.jwt.claims')} icon={Clock}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {JWT_TIME_CLAIMS.filter((claim) => claimSeconds(jwt.payload, claim) !== null).map((claim) => {
                const seconds = claimSeconds(jwt.payload, claim) as number;
                const date = new Date(seconds * 1000);
                const valid = Number.isFinite(date.getTime());
                return (
                  <div key={claim} className="grid gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300">{claim}</span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t(`toolsWeb.jwt.claim_${claim}`)}</span>
                    </div>
                    <div className="min-w-0 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {valid ? <>{date.toLocaleString(i18n.language)}<span className="ml-2 text-slate-400">{date.toISOString()}</span></> : seconds}
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">{valid ? relative(formatter, seconds * 1000 - now) : ''}</div>
                  </div>
                );
              })}
              {REGISTERED.filter((claim) => claim in jwt.payload || claim in jwt.header).map((claim) => (
                <div key={claim} className="grid gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[8rem_1fr] sm:items-center">
                  <div>
                    <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300">{claim}</span>
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t(`toolsWeb.jwt.claim_${claim}`)}</span>
                  </div>
                  <div className="min-w-0 break-all font-mono text-xs text-slate-700 dark:text-slate-200">{displayValue((jwt.payload[claim] ?? jwt.header[claim]) as JsonValue)}</div>
                </div>
              ))}
              {!JWT_TIME_CLAIMS.some((claim) => claimSeconds(jwt.payload, claim) !== null) && !REGISTERED.some((claim) => claim in jwt.payload || claim in jwt.header) && (
                <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{t('toolsWeb.jwt.no_claims')}</p>
              )}
            </div>
          </Pane>

          <Pane title={t('toolsWeb.jwt.verify')} icon={KeyRound}>
            <div className="space-y-2 p-3">
              <textarea
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={t(hmac ? 'toolsWeb.jwt.key_placeholder_secret' : 'toolsWeb.jwt.key_placeholder_public')}
                spellCheck={false}
                rows={hmac ? 2 : 5}
                aria-label={t('toolsWeb.jwt.key')}
                className={`${WEB_MONO_INPUT_CLASS} resize-y text-xs`}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('toolsWeb.jwt.key_hint')}</p>
              {verdictInfo && <Notice tone={verdictInfo.tone} icon={verdictInfo.icon}>{verdictInfo.text}</Notice>}
            </div>
          </Pane>
        </>
      )}
    </WebPage>
  );
};

export default JwtParserWorkbench;
