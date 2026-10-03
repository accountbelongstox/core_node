/** Safelink tool: unwrap scanner / redirect links step by step, or make a link safe to share (defang, percent-encode). */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ShieldCheck } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperTextarea, Segmented, prefillOneOf, prefillString, useToolRecord } from './textKit';
import { defang, percentDecode, percentEncode, refang, unwrapSafelink } from './logic/safelinkLogic';

const MODES = ['decode', 'encode'] as const;
const ENCODE_METHODS = ['defang', 'percent'] as const;
type Mode = (typeof MODES)[number];
type EncodeMethod = (typeof ENCODE_METHODS)[number];

const SAMPLE_WRAPPED = 'https://nam02.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Freport%3Fid%3D42%26lang%3Den&data=05%7C02%7C&sdata=abc123&reserved=0';

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const SafelinkWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [mode, setMode] = useState<Mode>(() => prefillOneOf(lastRun, 'action', MODES, 'decode'));
  const [method, setMethod] = useState<EncodeMethod>(() => prefillOneOf(lastRun, 'method', ENCODE_METHODS, 'defang'));
  const [input, setInput] = useState(() => prefillString(lastRun, 'url', SAMPLE_WRAPPED));

  const unwrapped = useMemo(() => unwrapSafelink(input), [input]);
  const decodedResult = unwrapped.steps.length > 0 ? unwrapped.final : percentDecode(refang(input.trim()));
  const encodedResult = method === 'defang' ? defang(input.trim()) : percentEncode(input.trim());
  const result = mode === 'decode' ? decodedResult : encodedResult;
  const host = hostOf(refang(decodedResult));
  const recordRun = (): void => record({ url: input, action: mode, method }, { result });

  return (
    <Desk>
      <Paper
        title={t('toolsText.safelink.link')}
        actions={<Segmented value={mode} onChange={setMode} ariaLabel={t('toolsText.safelink.mode')} options={MODES.map((id) => ({ value: id, label: t(`toolsText.safelink.mode_${id}`) }))} />}
      >
        <PaperTextarea mono rows={5} value={input} onChange={setInput} ariaLabel={t('toolsText.safelink.link')} placeholder={mode === 'decode' ? t('toolsText.safelink.placeholder_decode') : t('toolsText.safelink.placeholder_encode')} />
        {mode === 'encode' && (
          <div className="mt-3">
            <FieldLabel>{t('toolsText.safelink.method')}</FieldLabel>
            <Segmented value={method} onChange={setMethod} ariaLabel={t('toolsText.safelink.method')} options={ENCODE_METHODS.map((id) => ({ value: id, label: t(`toolsText.safelink.method_${id}`), title: t(`toolsText.safelink.method_${id}_hint`) }))} />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t(`toolsText.safelink.method_${method}_hint`)}</p>
          </div>
        )}
      </Paper>

      <Paper title={t('toolsText.safelink.result')} actions={<CopyButton text={result} onCopied={recordRun} />}>
        {!input.trim() ? (
          <p className="py-6 text-center text-sm text-slate-400">{t('toolsText.safelink.empty')}</p>
        ) : (
          <>
            <p className="break-all rounded-xl bg-violet-50/70 px-4 py-3 font-mono text-sm leading-6 text-slate-800 dark:bg-violet-500/10 dark:text-slate-100" aria-live="polite">{result}</p>
            {mode === 'decode' && (
              <div className="mt-4 space-y-3">
                {host && (
                  <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    {t('toolsText.safelink.destination')}: <span className="font-mono font-bold text-violet-700 dark:text-violet-300">{host}</span>
                  </p>
                )}
                {unwrapped.steps.length === 0 ? (
                  <Notice tone="info">{t('toolsText.safelink.no_wrapper')}</Notice>
                ) : (
                  <ol className="space-y-2">
                    {unwrapped.steps.map((step, index) => (
                      <li key={index} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">{t('toolsText.safelink.layer', { n: index + 1 })} - {t(`toolsText.safelink.provider_${step.provider}`)}</p>
                        <p className="mt-1 break-all font-mono text-xs text-slate-400 line-through decoration-slate-300">{step.from}</p>
                        <ArrowDown className="my-1 h-3.5 w-3.5 text-violet-500" />
                        <p className="break-all font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{step.to}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
      </Paper>
    </Desk>
  );
};

export default SafelinkWorkbench;
