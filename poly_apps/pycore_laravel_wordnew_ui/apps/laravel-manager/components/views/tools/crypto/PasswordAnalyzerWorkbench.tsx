/** Live password auditor: pattern-aware entropy meter, rule checklist and crack-time scenarios; nothing leaves the page. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Dices, Gauge, TriangleAlert } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { analyzePassword, type DurationUnit } from './lib/passwordLib';
import { DEFAULT_TOKEN_OPTIONS, generateTokens } from './lib/tokenLib';
import { EntropyMeter, formatDuration, Hint, SecretInput, VAULT_GHOST_BUTTON, VaultPage, VaultPanel, useVaultRecorder } from './cryptoKit';

const RECORD_DEBOUNCE_MS = 1500;
const SUGGESTION_LENGTH = 20;
const FAST_UNITS: readonly DurationUnit[] = ['instant', 'second', 'minute', 'hour'];
const SLOW_UNITS: readonly DurationUnit[] = ['day'];
const SCORE_TEXT = ['text-rose-500', 'text-orange-500', 'text-amber-500', 'text-lime-500', 'text-emerald-500'];

const durationTone = (unit: DurationUnit): string => {
  if (FAST_UNITS.includes(unit)) return 'bg-rose-500/15 text-rose-400';
  if (SLOW_UNITS.includes(unit)) return 'bg-amber-500/15 text-amber-300';
  return 'bg-emerald-500/15 text-emerald-300';
};

const PasswordAnalyzerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const { t } = useTranslation();
  const record = useVaultRecorder(tool.id, variant);
  const [password, setPassword] = useState('');
  const report = useMemo(() => analyzePassword(password), [password]);
  const empty = password === '';

  useEffect(() => {
    if (empty) return undefined;
    const timer = window.setTimeout(() => record({}, { score: report.score, length: report.length }), RECORD_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [empty, record, report.score, report.length]);

  const checks = [
    { id: 'length', ok: report.length >= 12 },
    { id: 'lower', ok: report.classes.lower },
    { id: 'upper', ok: report.classes.upper },
    { id: 'digit', ok: report.classes.digit },
    { id: 'symbol', ok: report.classes.symbol || report.classes.other },
    { id: 'patterns', ok: !empty && report.findings.length === 0 },
  ];

  const suggest = (): void => setPassword(generateTokens({ ...DEFAULT_TOKEN_OPTIONS, symbols: true, excludeAmbiguous: true, length: SUGGESTION_LENGTH, count: 1 })[0] ?? '');

  return (
    <VaultPage>
      <VaultPanel title={t('toolsCrypto.passwordAnalyzer.input_title')} icon={Gauge}>
        <SecretInput id="password-input" value={password} onChange={setPassword} label={t('toolsCrypto.passwordAnalyzer.password')} placeholder={t('toolsCrypto.passwordAnalyzer.placeholder')} autoFocus
          trailing={<button type="button" onClick={suggest} className={`${VAULT_GHOST_BUTTON} !px-2 !py-1 !text-[10px]`}><Dices className="h-3 w-3" aria-hidden />{t('toolsCrypto.passwordAnalyzer.suggest')}</button>} />
        <p className="mt-2 font-mono text-[10px] text-slate-400">{t('toolsCrypto.passwordAnalyzer.local_note')}</p>
      </VaultPanel>

      <VaultPanel title={t('toolsCrypto.passwordAnalyzer.verdict_title')} vault className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <p className={`font-mono text-2xl font-black ${empty ? 'text-emerald-500/40' : SCORE_TEXT[report.score]}`}>
            {empty ? '—' : t(`toolsCrypto.passwordAnalyzer.score_${report.score}`)}
          </p>
          <dl className="grid grid-cols-3 gap-4 text-right font-mono">
            <div><dt className="text-[9px] uppercase tracking-wider text-emerald-500/60">{t('toolsCrypto.passwordAnalyzer.stat_length')}</dt><dd className="text-sm font-black text-emerald-200">{report.length}</dd></div>
            <div><dt className="text-[9px] uppercase tracking-wider text-emerald-500/60">{t('toolsCrypto.passwordAnalyzer.stat_charset')}</dt><dd className="text-sm font-black text-emerald-200">{report.charsetSize}</dd></div>
            <div><dt className="text-[9px] uppercase tracking-wider text-emerald-500/60">{t('toolsCrypto.passwordAnalyzer.stat_naive')}</dt><dd className="text-sm font-black text-emerald-200">{report.naiveBits.toFixed(0)}</dd></div>
          </dl>
        </div>
        <EntropyMeter bits={report.entropyBits} caption={t('toolsCrypto.passwordAnalyzer.effective_entropy')} />
        {!empty && report.entropyBits < report.naiveBits - 1 && <Hint tone="warn">{t('toolsCrypto.passwordAnalyzer.pattern_penalty', { naive: report.naiveBits.toFixed(0), effective: report.entropyBits.toFixed(0) })}</Hint>}
      </VaultPanel>

      <div className="grid gap-4 md:grid-cols-2">
        <VaultPanel title={t('toolsCrypto.passwordAnalyzer.checklist_title')}>
          <ul className="space-y-1.5">
            {checks.map((check) => (
              <li key={check.id} className={`flex items-center gap-2 font-mono text-xs ${check.ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400'}`}>
                {check.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <Circle className="h-4 w-4 shrink-0" aria-hidden />}
                {t(`toolsCrypto.passwordAnalyzer.check_${check.id}`)}
              </li>
            ))}
          </ul>
          {report.findings.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 dark:border-white/10">
              {report.findings.map((finding, index) => (
                <li key={`${finding.kind}:${index}`} className="flex items-start gap-2 font-mono text-xs text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{t(`toolsCrypto.passwordAnalyzer.finding_${finding.kind}`, { text: finding.text })}</span>
                </li>
              ))}
            </ul>
          )}
        </VaultPanel>

        <VaultPanel title={t('toolsCrypto.passwordAnalyzer.crack_title')}>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {report.crack.map((estimate) => (
              <li key={estimate.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{t(`toolsCrypto.passwordAnalyzer.scenario_${estimate.id}`)}</span>
                  <span className="block font-mono text-[10px] text-slate-400">{t(`toolsCrypto.passwordAnalyzer.scenario_${estimate.id}_rate`)}</span>
                </span>
                <span className={`shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-black ${empty ? 'text-slate-400' : durationTone(estimate.unit)}`}>
                  {empty ? '—' : formatDuration(t, estimate.unit, estimate.value)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[10px] text-slate-400">{t('toolsCrypto.passwordAnalyzer.crack_note')}</p>
        </VaultPanel>
      </div>
    </VaultPage>
  );
};

export default PasswordAnalyzerWorkbench;
