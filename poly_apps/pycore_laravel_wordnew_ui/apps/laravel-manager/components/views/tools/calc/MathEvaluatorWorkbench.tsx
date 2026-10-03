/** Calculator-style expression evaluator with keypad, live result and a history tape. */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete, Keyboard, Sigma, Trash2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, CopyButton, Lcd, MUTED_TEXT, Seg, prefillInput, useAccent, useRecordUse } from './calcKit';
import { ExprError, evaluateExpression, formatResult, groupDigits, radixView, type AngleMode } from './mathLogic';

interface TapeEntry { e: string; r: string }

interface Key {
  label: string;
  insert?: string;
  action?: 'clear' | 'back' | 'equals' | 'ans';
  tone?: 'num' | 'op' | 'fn' | 'accent';
}

const TAPE_LIMIT = 40;
const KEYS: readonly Key[] = [
  { label: 'AC', action: 'clear', tone: 'fn' }, { label: '(', insert: '(', tone: 'fn' }, { label: ')', insert: ')', tone: 'fn' }, { label: '%', insert: '%', tone: 'fn' }, { label: '÷', insert: '/', tone: 'op' },
  { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' }, { label: '^', insert: '^', tone: 'op' }, { label: '×', insert: '*', tone: 'op' },
  { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' }, { label: '!', insert: '!', tone: 'op' }, { label: '−', insert: '-', tone: 'op' },
  { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' }, { label: 'ans', action: 'ans', tone: 'fn' }, { label: '+', insert: '+', tone: 'op' },
  { label: '0', insert: '0' }, { label: '.', insert: '.' }, { label: 'π', insert: 'pi' }, { label: '⌫', action: 'back', tone: 'fn' }, { label: '=', action: 'equals', tone: 'accent' },
];
const FN_KEYS: readonly Key[] = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'sqrt', 'abs', 'exp', 'cbrt', 'floor', 'round', 'e']
  .map((name) => (name === 'e' ? { label: 'e', insert: 'e', tone: 'fn' as const } : { label: name, insert: `${name}(`, tone: 'fn' as const }));

const isCoarsePointer = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

const readTape = (value: unknown): TapeEntry[] => (Array.isArray(value)
  ? value.filter((v): v is TapeEntry => typeof v?.e === 'string' && typeof v?.r === 'string').slice(0, TAPE_LIMIT)
  : []);

const MathEvaluatorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { expr: '', angle: 'deg', tape: [] as unknown[] }), [lastRun]);
  const [expr, setExpr] = useState(initial.expr);
  const [angle, setAngle] = useState<AngleMode>(initial.angle === 'rad' ? 'rad' : 'deg');
  const [tape, setTape] = useState<TapeEntry[]>(() => readTape(initial.tape));
  const [showFn, setShowFn] = useState(false);
  const [systemKeyboard, setSystemKeyboard] = useState(() => !isCoarsePointer());
  const inputRef = useRef<HTMLInputElement>(null);

  const ans = useMemo(() => Number(tape[0]?.r ?? 0) || 0, [tape]);

  const outcome = useMemo(() => {
    if (!expr.trim()) return { kind: 'idle' as const };
    try {
      const value = evaluateExpression(expr, { angle, ans });
      return { kind: 'ok' as const, value, text: formatResult(value) };
    } catch (err) {
      if (err instanceof ExprError) return { kind: 'error' as const, code: err.code, detail: err.detail };
      return { kind: 'error' as const, code: 'domain' as const, detail: '' };
    }
  }, [expr, angle, ans]);

  const radix = outcome.kind === 'ok' ? radixView(outcome.value) : null;

  const insertText = (text: string): void => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expr.length;
    const end = input?.selectionEnd ?? expr.length;
    setExpr(`${expr.slice(0, start)}${text}${expr.slice(end)}`);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const backspace = (): void => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expr.length;
    const end = input?.selectionEnd ?? expr.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setExpr(`${expr.slice(0, from)}${expr.slice(end)}`);
    requestAnimationFrame(() => input?.setSelectionRange(from, from));
  };

  const commit = (): void => {
    if (outcome.kind !== 'ok') return;
    const entry: TapeEntry = { e: expr.trim(), r: outcome.text };
    const nextTape = [entry, ...tape].slice(0, TAPE_LIMIT);
    setTape(nextTape);
    setExpr(outcome.text);
    record({ expr: entry.e, angle, tape: nextTape }, { result: outcome.text });
  };

  const press = (key: Key): void => {
    if (key.action === 'clear') setExpr('');
    else if (key.action === 'back') backspace();
    else if (key.action === 'equals') commit();
    else if (key.action === 'ans') insertText('ans');
    else if (key.insert) insertText(key.insert);
  };

  const keyClass = (tone: Key['tone'] = 'num'): string => {
    if (tone === 'accent') return `${a.solid} font-black`;
    if (tone === 'op') return `${a.tint} ${a.text} font-bold hover:brightness-110`;
    if (tone === 'fn') return 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
    return 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700';
  };

  const errorText = outcome.kind === 'error' ? t(`toolsCalc.mathEvaluator.errors.${outcome.code}`, { name: outcome.detail }) : '';

  return (
    <Bench accent="math">
      <Lcd className="space-y-1">
        <div className="flex items-center justify-between text-[11px] opacity-70">
          <Seg
            value={angle}
            onChange={setAngle}
            ariaLabel={t('toolsCalc.mathEvaluator.angle')}
            options={[{ value: 'deg', label: t('toolsCalc.mathEvaluator.deg') }, { value: 'rad', label: t('toolsCalc.mathEvaluator.rad') }]}
          />
          <span>{t('toolsCalc.mathEvaluator.ans')} = {groupDigits(String(ans))}</span>
        </div>
        <input
          ref={inputRef}
          value={expr}
          onChange={(event) => setExpr(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') commit(); }}
          inputMode={systemKeyboard ? 'text' : 'none'}
          aria-label={t('toolsCalc.mathEvaluator.expression')}
          placeholder={t('toolsCalc.mathEvaluator.placeholder')}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full bg-transparent text-right text-xl text-orange-100 outline-none placeholder:text-orange-300/30 sm:text-2xl"
        />
        <p className={`min-h-[3rem] break-all text-right text-4xl font-bold leading-tight sm:text-5xl ${outcome.kind === 'error' ? 'text-orange-300/40' : ''}`}>
          {outcome.kind === 'ok' ? groupDigits(outcome.text) : outcome.kind === 'error' ? '…' : '0'}
        </p>
        <p className="min-h-[1.25rem] text-right text-xs opacity-80">
          {outcome.kind === 'error' ? errorText : radix ? `0x${radix.hex}  ·  0b${radix.bin}  ·  0o${radix.oct}` : ''}
        </p>
      </Lcd>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setShowFn(!showFn)} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${showFn ? a.text : MUTED_TEXT}`}>
              <Sigma className="h-3.5 w-3.5" />{t('toolsCalc.mathEvaluator.functions')}
            </button>
            <button type="button" onClick={() => setSystemKeyboard(!systemKeyboard)} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${systemKeyboard ? a.text : MUTED_TEXT}`}>
              <Keyboard className="h-3.5 w-3.5" />{t('toolsCalc.mathEvaluator.system_keyboard')}
            </button>
          </div>
          {showFn && (
            <div className="mb-2 grid grid-cols-5 gap-1.5">
              {FN_KEYS.map((key) => (
                <button key={key.label} type="button" onClick={() => press(key)} className={`cursor-pointer rounded-xl py-2.5 font-mono text-xs transition active:scale-95 ${keyClass('fn')}`}>{key.label}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-5 gap-1.5">
            {KEYS.map((key) => (
              <button
                key={key.label}
                type="button"
                onClick={() => press(key)}
                aria-label={key.action === 'back' ? t('toolsCalc.mathEvaluator.backspace') : undefined}
                className={`cursor-pointer rounded-xl py-3.5 font-mono text-base transition active:scale-95 ${keyClass(key.tone)}`}
              >
                {key.action === 'back' ? <Delete className="mx-auto h-4 w-4" /> : key.label}
              </button>
            ))}
          </div>
        </Card>

        <Card
          title={t('toolsCalc.mathEvaluator.tape')}
          aside={tape.length > 0 && (
            <button type="button" onClick={() => setTape([])} className={`inline-flex cursor-pointer items-center gap-1 text-xs ${MUTED_TEXT} hover:text-red-500`}>
              <Trash2 className="h-3.5 w-3.5" />{t('toolsCalc.common.clear')}
            </button>
          )}
        >
          {tape.length === 0 ? (
            <p className={`py-6 text-center text-xs ${MUTED_TEXT}`}>{t('toolsCalc.mathEvaluator.tape_empty')}</p>
          ) : (
            <ul className="max-h-[22rem] space-y-1 overflow-y-auto font-mono text-sm">
              {tape.map((entry, index) => (
                <li key={`${index}:${entry.e}`} className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800/70">
                  <button type="button" onClick={() => setExpr(entry.e)} className="min-w-0 flex-1 cursor-pointer text-left" title={t('toolsCalc.mathEvaluator.reuse')}>
                    <span className={`block truncate text-xs ${MUTED_TEXT}`}>{entry.e}</span>
                    <span className="block truncate font-bold text-slate-900 dark:text-slate-100">= {groupDigits(entry.r)}</span>
                  </button>
                  <button type="button" onClick={() => insertText(entry.r)} className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-bold ${a.tint} ${a.text}`} title={t('toolsCalc.mathEvaluator.insert_result')}>↵</button>
                  <CopyButton text={entry.r} label={t('toolsCalc.common.copy')} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Bench>
  );
};

export default MathEvaluatorWorkbench;
