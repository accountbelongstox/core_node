/** PDF protector: password form with strength meter and requirement checklist; the encrypted PDF is produced on the server. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Notice, TONE, useMediaT } from './MediaKit';
import { JobFeedback, PdfCard, PdfDesk, PdfDropZone, PdfSection, ResultCard, useDocumentIntake, usePdfJob } from './PdfKit';
import { baseName } from './mediaFormat';
import { PDF_MAX_STRENGTH, passwordStrength } from './pdfOps';
import { protectPdf, type PdfOutput } from './pdfServer';

const METER_TONES = ['bg-slate-200 dark:bg-slate-700', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
const LEVEL_KEYS = ['empty', 'weak', 'fair', 'good', 'strong'];

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

const Requirement: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <li className={`flex items-center gap-1.5 text-[11px] ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
    {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{label}
  </li>
);

const PdfProtectorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const m = useMediaT();
  const intake = useDocumentIntake(false);
  const item = intake.items[0] ?? null;
  const { result, error, running, run, reset, backendMissing } = usePdfJob<PdfOutput>(tool, variant);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => { reset(); }, [item?.id, password, reset]);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const matches = password.length > 0 && password === confirm;
  const canRun = Boolean(item) && matches;

  const submit = useCallback(async () => {
    if (!item || !matches) return;
    await run({ fileName: item.file.name }, () => protectPdf(tool.apiMethod, item.file, password));
  }, [item, matches, password, run, tool.apiMethod]);

  return (
    <PdfDesk>
      {!item ? <PdfDropZone tone="red" onFiles={intake.add} /> : (
        <>
          <PdfDropZone tone="red" onFiles={intake.add}><PdfCard item={item} tone="red" onRemove={intake.clear} /></PdfDropZone>
          {item.encrypted && <Notice tone="warn">{m('protector.already_encrypted')}</Notice>}
          <PdfSection title={m('protector.password')}>
            <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{m('protector.password')}</span>
                <span className="relative">
                  <input type={visible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
                  <button type="button" aria-label={m(visible ? 'protector.hide' : 'protector.show')} onClick={() => setVisible((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100">
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{m('protector.confirm')}</span>
                <input type={visible ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={`${inputClass} ${confirm.length > 0 && !matches ? 'border-red-500' : ''}`} />
                {confirm.length > 0 && <span className={`text-[11px] ${matches ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{m(matches ? 'protector.match' : 'protector.mismatch')}</span>}
              </label>
            </form>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{m('protector.strength')}</span>
                <span className="font-bold">{m(`protector.level_${LEVEL_KEYS[strength.score]}`)}</span>
              </div>
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: PDF_MAX_STRENGTH }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength.score ? METER_TONES[strength.score] : METER_TONES[0]}`} />)}
              </div>
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                <Requirement met={strength.hasLength} label={m('protector.req_length')} />
                <Requirement met={strength.hasMixedCase} label={m('protector.req_case')} />
                <Requirement met={strength.hasDigit} label={m('protector.req_digit')} />
                <Requirement met={strength.hasSymbol} label={m('protector.req_symbol')} />
              </ul>
            </div>
            <Notice>{m('protector.privacy')}</Notice>
            <ActionButton tone="red" onClick={() => { void submit(); }} disabled={!canRun} busy={running} icon={<Lock className="h-4 w-4" />}>{m('protector.run')}</ActionButton>
            <JobFeedback error={error} backendMissing={backendMissing} />
          </PdfSection>
          {result && (
            <PdfSection title={m('protector.result')}>
              <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${TONE.red.soft}`}>{m('protector.result_note')}</div>
              <ResultCard output={result} fileName={`${baseName(item.file.name)}-protected.pdf`} tone="red" openable={false} />
            </PdfSection>
          )}
        </>
      )}
      {intake.rejected && <JobFeedback error={m('pdf.not_pdf')} backendMissing={false} />}
    </PdfDesk>
  );
};

export default PdfProtectorWorkbench;
