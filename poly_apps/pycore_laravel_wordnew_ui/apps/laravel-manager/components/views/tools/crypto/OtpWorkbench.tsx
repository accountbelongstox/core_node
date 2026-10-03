/** Authenticator bench: live TOTP/HOTP codes with a countdown ring, otpauth URI import/export and a drift-aware verifier. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Dices, Link2, Minus, Plus, ShieldCheck, XCircle } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { buildOtpUri, DEFAULT_OTP_PARAMS, groupOtpSecret, isValidOtpSecret, OTP_ALGORITHMS, OTP_DIGITS, OTP_PERIODS, otpAt, parseOtpUri, randomOtpSecret, secondsLeft, totpCounter, verifyOtp, type OtpAlgorithm, type OtpKind, type OtpParams, type OtpVerification } from './lib/otpLib';
import { CopyButton, FieldLabel, Hint, ModeTabs, Readout, SecretInput, VAULT_FIELD, VAULT_GHOST_BUTTON, VaultPage, VaultPanel, readSettings, useVaultRecorder } from './cryptoKit';

type OtpTab = 'generate' | 'verify';

interface OtpSettings {
  kind: OtpKind;
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
}

const DEFAULT_SETTINGS: OtpSettings = { kind: DEFAULT_OTP_PARAMS.kind, algorithm: DEFAULT_OTP_PARAMS.algorithm, digits: DEFAULT_OTP_PARAMS.digits, period: DEFAULT_OTP_PARAMS.period };
const TICK_MS = 250;
const VERIFY_WINDOWS: readonly number[] = [0, 1, 2, 3];
const CHIP_CLASS = 'rounded-lg px-3 py-1.5 font-mono text-[11px]';
const CHIP_SELECTED = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
const CHIP_IDLE = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-emerald-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10';
const STEP_OFFSETS: Record<OtpKind, readonly number[]> = { totp: [-1, 0, 1], hotp: [0, 1, 2] };
const SLOT_KEYS: Record<number, string> = { [-1]: 'previous', 0: 'current', 1: 'next', 2: 'later' };

const groupCode = (code: string): string => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : `${code.slice(0, 4)} ${code.slice(4)}`);

const OtpWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => readSettings(lastRun, DEFAULT_SETTINGS), [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const [tab, setTab] = useState<OtpTab>(variant === 'otpVerifier' ? 'verify' : 'generate');
  const [settings, setSettings] = useState<OtpSettings>(initial);
  const [secret, setSecret] = useState(randomOtpSecret);
  const [counter, setCounter] = useState(0);
  const [issuer, setIssuer] = useState('CoreNode');
  const [account, setAccount] = useState('user@example.com');
  const [importText, setImportText] = useState('');
  const [importFailed, setImportFailed] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [codes, setCodes] = useState<Array<string | null>>([]);
  const [candidate, setCandidate] = useState('');
  const [windowSize, setWindowSize] = useState(1);
  const [verification, setVerification] = useState<OtpVerification | null>(null);
  const params: OtpParams = useMemo(() => ({ ...settings, secret, counter }), [settings, secret, counter]);
  const secretValid = secret !== '' && isValidOtpSecret(secret);
  const step = settings.kind === 'totp' ? totpCounter(params, now) : counter;
  const left = secondsLeft(settings.period, now);
  const offsets = STEP_OFFSETS[settings.kind];
  const uri = secretValid ? buildOtpUri(params, { issuer, account }) : '';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!secretValid) {
      setCodes([]);
      return undefined;
    }
    Promise.all(offsets.map((offset) => otpAt(settings.kind === 'totp' ? { ...params, period: settings.period } : { ...params, counter: counter + offset }, settings.kind === 'totp' ? (step + offset) * settings.period * 1000 : now)))
      .then((values) => { if (!cancelled) setCodes(values); });
    return () => { cancelled = true; };
  }, [secretValid, secret, settings, counter, step]);

  useEffect(() => {
    let cancelled = false;
    if (tab !== 'verify' || !secretValid || !candidate.trim()) {
      setVerification(null);
      return undefined;
    }
    verifyOtp(params, candidate, windowSize, now).then((value) => { if (!cancelled) setVerification(value); });
    return () => { cancelled = true; };
  }, [tab, secretValid, secret, settings, counter, candidate, windowSize, step]);

  const patch = (next: Partial<OtpSettings>): void => setSettings((prev) => ({ ...prev, ...next }));

  const importUri = (text: string): void => {
    setImportText(text);
    if (!text.trim()) {
      setImportFailed(false);
      return;
    }
    const parsed = parseOtpUri(text);
    setImportFailed(!parsed);
    if (!parsed) return;
    setSettings({ kind: parsed.params.kind, algorithm: parsed.params.algorithm, digits: parsed.params.digits, period: parsed.params.period });
    setSecret(parsed.params.secret);
    setCounter(parsed.params.counter);
    setIssuer(parsed.fields.issuer);
    setAccount(parsed.fields.account);
  };

  const current = codes[offsets.indexOf(0)] ?? null;
  const recordUse = (): void => record({ ...settings }, { tab });

  return (
    <VaultPage>
      <ModeTabs value={tab} onChange={setTab} label={t('toolsCrypto.otpGenerator.tab')} options={[
        { value: 'generate', label: t('toolsCrypto.otpGenerator.tab_generate') },
        { value: 'verify', label: t('toolsCrypto.otpGenerator.tab_verify') },
      ]} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <VaultPanel title={tab === 'generate' ? t('toolsCrypto.otpGenerator.code_title') : t('toolsCrypto.otpGenerator.verify_title')} vault className="space-y-4">
          {tab === 'generate' ? (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                {settings.kind === 'totp' && (
                  <ProgressRing progress={left / settings.period} sizeClass="h-24 w-24" colorClass={left <= 5 ? 'text-rose-400' : 'text-emerald-400'} trackClassName="text-emerald-400/10" durationSec={TICK_MS / 1000}>
                    <span className="font-mono text-2xl font-black text-emerald-200">{Math.ceil(left)}</span>
                    <span className="font-mono text-[9px] uppercase text-emerald-500/60">{t('toolsCrypto.otpGenerator.seconds_short')}</span>
                  </ProgressRing>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">{settings.kind === 'totp' ? t('toolsCrypto.otpGenerator.current_code') : t('toolsCrypto.otpGenerator.counter_code', { counter })}</p>
                  <p className={`mt-1 font-mono text-3xl font-black tracking-wider sm:text-5xl sm:tracking-widest ${current ? (settings.kind === 'totp' && left <= 5 ? 'text-rose-300' : 'text-emerald-300') : 'text-emerald-500/30'}`}>{current ? groupCode(current) : '— —'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <CopyButton value={current ?? ''} caption dark onCopied={recordUse} />
                    {settings.kind === 'hotp' && (
                      <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-200">
                        <button type="button" aria-label={t('toolsCrypto.otpGenerator.counter_down')} disabled={counter <= 0} onClick={() => setCounter((prev) => Math.max(0, prev - 1))} className="cursor-pointer rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-1.5 disabled:opacity-40"><Minus className="h-3.5 w-3.5" aria-hidden /></button>
                        <span className="min-w-8 text-center font-black">{counter}</span>
                        <button type="button" aria-label={t('toolsCrypto.otpGenerator.counter_up')} onClick={() => setCounter((prev) => prev + 1)} className="cursor-pointer rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-1.5"><Plus className="h-3.5 w-3.5" aria-hidden /></button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {offsets.map((offset, index) => (
                  <div key={offset} className={`rounded-xl border px-2 py-2 text-center font-mono ${offset === 0 ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-emerald-500/15 bg-black/20'}`}>
                    <p className="text-[9px] uppercase tracking-wider text-emerald-500/60">{t(`toolsCrypto.otpGenerator.slot_${SLOT_KEYS[offset]}`)}</p>
                    <p className="mt-0.5 text-xs font-black text-emerald-200 sm:text-sm">{codes[index] ? groupCode(codes[index]!) : '—'}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="otp-candidate" className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">{t('toolsCrypto.otpGenerator.candidate')}</label>
                <input id="otp-candidate" inputMode="numeric" autoComplete="one-time-code" value={candidate} onChange={(event) => setCandidate(event.target.value.replace(/[^0-9 ]/g, ''))}
                  placeholder={'0'.repeat(settings.digits)} className="w-full rounded-xl border border-emerald-500/20 bg-black/30 px-3 py-3 text-center font-mono text-3xl font-black tracking-[0.3em] text-emerald-200 outline-none focus:border-emerald-400/60" />
              </div>
              <div>
                <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">{t(settings.kind === 'totp' ? 'toolsCrypto.otpGenerator.window_totp' : 'toolsCrypto.otpGenerator.window_hotp')}</p>
                <ChipGroup value={windowSize} onChange={(size) => setWindowSize(size)} label={t('toolsCrypto.otpGenerator.window')} options={VERIFY_WINDOWS.map((size) => ({ value: size, label: `±${size}` }))}
                  chipClassName={CHIP_CLASS} selectedClassName="border-emerald-400 bg-emerald-400/20 text-emerald-200" idleClassName="border-emerald-500/20 bg-black/20 text-emerald-500/70 hover:bg-emerald-400/10" />
              </div>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-3 font-mono text-sm font-bold ${verification === null ? 'border-emerald-500/15 text-emerald-500/50' : verification.valid ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
                {verification === null ? <ShieldCheck className="h-5 w-5" aria-hidden /> : verification.valid ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <XCircle className="h-5 w-5" aria-hidden />}
                <span>
                  {verification === null ? t('toolsCrypto.otpGenerator.verify_idle')
                    : verification.valid ? t('toolsCrypto.otpGenerator.verify_valid', { drift: verification.drift ?? 0 }) : t('toolsCrypto.otpGenerator.verify_invalid')}
                </span>
              </div>
            </>
          )}
        </VaultPanel>

        <VaultPanel title={t('toolsCrypto.otpGenerator.config_title')} className="space-y-4">
          <SecretInput id="otp-secret" value={secret} onChange={(value) => setSecret(value.toUpperCase())} label={t('toolsCrypto.otpGenerator.secret')}
            trailing={<button type="button" onClick={() => setSecret(randomOtpSecret())} className={`${VAULT_GHOST_BUTTON} !px-2 !py-1 !text-[10px]`}><Dices className="h-3 w-3" aria-hidden />{t('toolsCrypto.otpGenerator.new_secret')}</button>} />
          {secret !== '' && !secretValid && <Hint tone="error">{t('toolsCrypto.otpGenerator.secret_invalid')}</Hint>}
          {secretValid && <p className="break-all font-mono text-[10px] text-slate-400">{groupOtpSecret(secret)}</p>}
          <ModeTabs value={settings.kind} onChange={(kind) => patch({ kind })} label={t('toolsCrypto.otpGenerator.kind')} options={[
            { value: 'totp', label: 'TOTP' },
            { value: 'hotp', label: 'HOTP' },
          ]} />
          <div>
            <FieldLabel>{t('toolsCrypto.otpGenerator.algorithm')}</FieldLabel>
            <ChipGroup value={settings.algorithm} onChange={(algorithm) => patch({ algorithm })} label={t('toolsCrypto.otpGenerator.algorithm')} options={OTP_ALGORITHMS.map((algorithm) => ({ value: algorithm, label: algorithm }))}
              chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>{t('toolsCrypto.otpGenerator.digits')}</FieldLabel>
              <ChipGroup value={settings.digits} onChange={(digits) => patch({ digits })} label={t('toolsCrypto.otpGenerator.digits')} options={OTP_DIGITS.map((digits) => ({ value: digits, label: String(digits) }))}
                chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
            </div>
            {settings.kind === 'totp' && (
              <div>
                <FieldLabel>{t('toolsCrypto.otpGenerator.period')}</FieldLabel>
                <ChipGroup value={settings.period} onChange={(period) => patch({ period })} label={t('toolsCrypto.otpGenerator.period')} options={OTP_PERIODS.map((period) => ({ value: period, label: `${period}s` }))}
                  chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
              </div>
            )}
          </div>
        </VaultPanel>
      </div>

      <VaultPanel title={t('toolsCrypto.otpGenerator.uri_title')} icon={Link2} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="otp-issuer">{t('toolsCrypto.otpGenerator.issuer')}</FieldLabel>
            <input id="otp-issuer" value={issuer} onChange={(event) => setIssuer(event.target.value)} spellCheck={false} className={VAULT_FIELD} />
          </div>
          <div>
            <FieldLabel htmlFor="otp-account">{t('toolsCrypto.otpGenerator.account')}</FieldLabel>
            <input id="otp-account" value={account} onChange={(event) => setAccount(event.target.value)} spellCheck={false} className={VAULT_FIELD} />
          </div>
        </div>
        <Readout label="otpauth://" value={uri} masked onCopied={recordUse} valueClassName="text-xs" emptyText={t('toolsCrypto.otpGenerator.uri_waiting')} />
        <div>
          <FieldLabel htmlFor="otp-import">{t('toolsCrypto.otpGenerator.import_label')}</FieldLabel>
          <input id="otp-import" type="password" autoComplete="off" value={importText} onChange={(event) => importUri(event.target.value)} spellCheck={false}
            placeholder="otpauth://totp/..." className={VAULT_FIELD} />
          {importFailed && <div className="mt-1.5"><Hint tone="error">{t('toolsCrypto.otpGenerator.import_invalid')}</Hint></div>}
        </div>
      </VaultPanel>
    </VaultPage>
  );
};

export default OtpWorkbench;
