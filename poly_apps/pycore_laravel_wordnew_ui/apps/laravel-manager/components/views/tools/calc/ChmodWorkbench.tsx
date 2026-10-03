/** Chmod calculator: rwx checkbox matrix linked to octal, symbolic and symbolic-modifier inputs with a command preview. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Btn, Card, Chips, CopyButton, FIELD_CLASS, FieldLabel, Lcd, MUTED_TEXT, Seg, Switch2, prefillInput, useAccent, useAutoRecord, useRecordUse } from './calcKit';
import {
  CHMOD_CLASSES, CHMOD_PERMS, CHMOD_SPECIALS, applySymbolicSpec, chmodEquals, chmodOctal, chmodSymbolic, classDigit, hasPerm, hasSpecial,
  parseOctalMode, parseSymbolicMode, togglePerm, toggleSpecial, type ChmodPerm,
} from './netLogic';

type CommandForm = 'octal' | 'symbolic';

const PRESETS = [0o644, 0o755, 0o600, 0o700, 0o750, 0o664, 0o777, 0o400, 0o444, 0o1777, 0o2755, 0o4755] as const;
const PERM_LETTER: Record<ChmodPerm, string> = { read: 'r', write: 'w', execute: 'x' };
const PERM_WEIGHT: Record<ChmodPerm, number> = { read: 4, write: 2, execute: 1 };
const SPECIAL_WEIGHT = { setuid: 4, setgid: 2, sticky: 1 } as const;

const ChmodWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { mode: 0o755, target: 'file', recursive: false, form: 'octal' }), [lastRun]);
  const [mode, setMode] = useState<number>(initial.mode >= 0 && initial.mode <= 0o7777 ? initial.mode : 0o755);
  const [target, setTarget] = useState(initial.target);
  const [recursive, setRecursive] = useState(initial.recursive);
  const [form, setForm] = useState<CommandForm>(initial.form === 'symbolic' ? 'symbolic' : 'octal');
  const [octalDraft, setOctalDraft] = useState<string | null>(null);
  const [symbolicDraft, setSymbolicDraft] = useState<string | null>(null);
  const [spec, setSpec] = useState('');
  const [specInvalid, setSpecInvalid] = useState(false);

  const commit = (next: number): void => { setMode(next); setOctalDraft(null); setSymbolicDraft(null); };
  const octal = chmodOctal(mode);
  const symbolic = chmodSymbolic(mode);
  const octalValue = octalDraft ?? octal;
  const symbolicValue = symbolicDraft ?? symbolic;
  const safeTarget = target.trim() || 'file';
  const argument = form === 'octal' ? octal : chmodEquals(mode);
  const command = `chmod ${recursive ? '-R ' : ''}${argument} ${/\s/.test(safeTarget) ? `'${safeTarget}'` : safeTarget}`;
  const list = useMemo(() => new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }), [i18n.language]);

  useAutoRecord(record, { mode, target, recursive, form }, { octal, symbolic, command }, true);

  const applySpec = (): void => {
    const next = applySymbolicSpec(mode, spec);
    setSpecInvalid(next === null);
    if (next !== null) commit(next);
  };

  return (
    <Bench accent="net">
      <Lcd className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <p className="text-5xl font-bold sm:text-6xl">{octal}</p>
          <p className="break-all text-xl font-semibold sm:text-2xl">-{symbolic}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm">
          <span className="select-none opacity-50">$</span>
          <code className="min-w-0 flex-1 break-all text-rose-100">{command}</code>
          <CopyButton text={command} label={t('toolsCalc.common.copy')} className="!text-rose-200 hover:!bg-white/10">{t('toolsCalc.common.copy')}</CopyButton>
        </div>
      </Lcd>

      <Card title={t('toolsCalc.chmod.matrix')} icon={<Lock className="h-3.5 w-3.5" />}>
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(4.5rem,1fr)_repeat(3,minmax(0,3.5rem))_2rem] items-center gap-2 sm:grid-cols-[8rem_repeat(3,4.5rem)_2.5rem]">
            <span />
            {CHMOD_PERMS.map((perm) => <span key={perm} className={`text-center text-[11px] font-bold uppercase tracking-wider ${MUTED_TEXT}`}>{t(`toolsCalc.chmod.${perm}`)}</span>)}
            <span />
          </div>
          {CHMOD_CLASSES.map((cls) => (
            <div key={cls} className="grid grid-cols-[minmax(4.5rem,1fr)_repeat(3,minmax(0,3.5rem))_2rem] items-center gap-2 sm:grid-cols-[8rem_repeat(3,4.5rem)_2.5rem]">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(`toolsCalc.chmod.${cls}`)}</span>
              {CHMOD_PERMS.map((perm) => {
                const on = hasPerm(mode, cls, perm);
                return (
                  <button
                    key={perm}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${t(`toolsCalc.chmod.${cls}`)} ${t(`toolsCalc.chmod.${perm}`)}`}
                    onClick={() => commit(togglePerm(mode, cls, perm))}
                    className={`flex h-12 cursor-pointer flex-col items-center justify-center rounded-xl border font-mono transition active:scale-95 ${on ? `${a.solid} border-transparent` : 'border-slate-300 text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                  >
                    <span className="text-base font-black leading-none">{PERM_LETTER[perm]}</span>
                    <span className="text-[10px] opacity-70">{PERM_WEIGHT[perm]}</span>
                  </button>
                );
              })}
              <span className={`text-center font-mono text-2xl font-black ${a.text}`}>{classDigit(mode, cls)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${MUTED_TEXT}`}>{t('toolsCalc.chmod.special')}</p>
          <div className="flex flex-wrap gap-2">
            {CHMOD_SPECIALS.map((special) => {
              const on = hasSpecial(mode, special);
              return (
                <button
                  key={special}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => commit(toggleSpecial(mode, special))}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold transition ${on ? a.chipActive : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  {t(`toolsCalc.chmod.${special}`)} <span className="font-mono opacity-60">{SPECIAL_WEIGHT[special]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ul className="mt-4 space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {CHMOD_CLASSES.map((cls) => {
            const perms = CHMOD_PERMS.filter((p) => hasPerm(mode, cls, p)).map((p) => t(`toolsCalc.chmod.can_${p}`));
            return <li key={cls}><span className="font-semibold">{t(`toolsCalc.chmod.${cls}`)}:</span> {perms.length ? list.format(perms) : t('toolsCalc.chmod.nothing')}</li>;
          })}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t('toolsCalc.chmod.inputs')}>
          <div className="space-y-3">
            <div>
              <FieldLabel htmlFor="chmod-octal">{t('toolsCalc.chmod.octal')}</FieldLabel>
              <input
                id="chmod-octal"
                value={octalValue}
                onChange={(event) => { setOctalDraft(event.target.value); const next = parseOctalMode(event.target.value); if (next !== null) { setMode(next); setSymbolicDraft(null); } }}
                onBlur={() => setOctalDraft(null)}
                maxLength={5}
                spellCheck={false}
                className={`${FIELD_CLASS} ${a.focus} ${octalDraft !== null && parseOctalMode(octalDraft) === null ? 'border-red-500/60' : ''}`}
              />
            </div>
            <div>
              <FieldLabel htmlFor="chmod-symbolic">{t('toolsCalc.chmod.symbolic')}</FieldLabel>
              <input
                id="chmod-symbolic"
                value={symbolicValue}
                onChange={(event) => { setSymbolicDraft(event.target.value); const next = parseSymbolicMode(event.target.value); if (next !== null) { setMode(next); setOctalDraft(null); } }}
                onBlur={() => setSymbolicDraft(null)}
                maxLength={10}
                spellCheck={false}
                className={`${FIELD_CLASS} ${a.focus} ${symbolicDraft !== null && parseSymbolicMode(symbolicDraft) === null ? 'border-red-500/60' : ''}`}
              />
            </div>
            <div>
              <FieldLabel htmlFor="chmod-spec">{t('toolsCalc.chmod.modify')}</FieldLabel>
              <div className="flex gap-2">
                <input
                  id="chmod-spec"
                  value={spec}
                  onChange={(event) => { setSpec(event.target.value); setSpecInvalid(false); }}
                  onKeyDown={(event) => { if (event.key === 'Enter') applySpec(); }}
                  placeholder="u+x,go-w"
                  spellCheck={false}
                  className={`${FIELD_CLASS} ${a.focus} ${specInvalid ? 'border-red-500/60' : ''}`}
                />
                <Btn onClick={applySpec} disabled={!spec.trim()}>{t('toolsCalc.chmod.apply')}</Btn>
              </div>
              {specInvalid && <p className="mt-1 text-xs text-red-500">{t('toolsCalc.chmod.modify_invalid')}</p>}
            </div>
          </div>
        </Card>

        <Card title={t('toolsCalc.chmod.command')}>
          <div className="space-y-3">
            <Seg value={form} onChange={setForm} ariaLabel={t('toolsCalc.chmod.command_form')} options={[{ value: 'octal', label: t('toolsCalc.chmod.form_octal') }, { value: 'symbolic', label: t('toolsCalc.chmod.form_symbolic') }]} />
            <div>
              <FieldLabel htmlFor="chmod-target">{t('toolsCalc.chmod.target')}</FieldLabel>
              <input id="chmod-target" value={target} onChange={(event) => setTarget(event.target.value)} spellCheck={false} className={`${FIELD_CLASS} ${a.focus}`} />
            </div>
            <Switch2 on={recursive} onChange={setRecursive} label={t('toolsCalc.chmod.recursive')} />
          </div>
        </Card>
      </div>

      <Card title={t('toolsCalc.chmod.presets')}>
        <Chips value={mode} onChange={commit} options={PRESETS.map((p) => ({ value: p, label: chmodOctal(p) }))} />
      </Card>
    </Bench>
  );
};

export default ChmodWorkbench;
