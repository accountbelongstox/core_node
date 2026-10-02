import React, { useState } from 'react';
import { ListChecks, Loader2, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

const OPTION_COUNT = 6;
const LETTER_CODE_A = 65;
type OptionLabelMode = 'number' | 'letter';

function optionLabel(position: number, mode: OptionLabelMode): string {
  return mode === 'letter' ? String.fromCharCode(LETTER_CODE_A + position - 1) : String(position);
}

interface PcTerminalChoicePickerProps {
  disabled: boolean;
  busy: boolean;
  /** option is 1-based; text (optional) is typed into the chosen option before Enter. */
  onChoose: (option: number, text: string) => Promise<boolean>;
}

/** Answers an AI agent's choice menu: Down to the chosen row, then Enter (optional text is typed first). */
export const PcTerminalChoicePicker: React.FC<PcTerminalChoicePickerProps> = ({ disabled, busy, onChoose }) => {
  const { t } = useTranslation('pc');
  const [mode, setMode] = useState<OptionLabelMode>(() => (
    StorageManager.getRaw(StorageKeys.PYCORE_TERMINAL_CHOICE_LABELS) === 'letter' ? 'letter' : 'number'
  ));
  const [pending, setPending] = useState<number | null>(null);
  const [text, setText] = useState('');

  const switchMode = (next: OptionLabelMode) => {
    setMode(next);
    StorageManager.setRaw(StorageKeys.PYCORE_TERMINAL_CHOICE_LABELS, next);
  };

  const submit = async () => {
    if (pending === null) return;
    if (await onChoose(pending, text.trim())) {
      setPending(null);
      setText('');
    }
  };

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-500/15 bg-white/40 p-1.5 dark:bg-slate-950/20">
      <div className="flex items-center gap-1">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-fuchsia-500" title={t('terminal.choice.title')}>
          <ListChecks className="h-4 w-4" />
        </span>
        <div className="grid flex-1 grid-cols-6 gap-1">
          {Array.from({ length: OPTION_COUNT }, (_, offset) => offset + 1).map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => { setPending(position); setText(''); }}
              disabled={disabled}
              title={t('terminal.choice.pick', { option: optionLabel(position, mode) })}
              className={`h-9 rounded-lg font-mono text-sm font-bold text-fuchsia-600 hover:bg-fuchsia-500/10 disabled:opacity-40 dark:text-fuchsia-400 ${
                pending === position ? 'bg-fuchsia-500/15 ring-1 ring-fuchsia-500' : ''
              }`}
            >
              {optionLabel(position, mode)}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-500/20 text-[10px] font-bold">
          {(['number', 'letter'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              aria-pressed={mode === value}
              title={t(`terminal.choice.mode.${value}`)}
              className={`px-1.5 py-1 font-mono ${mode === value ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-400'}`}
            >
              {value === 'number' ? '12' : 'AB'}
            </button>
          ))}
        </div>
      </div>

      {pending !== null && (
        <form
          className="space-y-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            {t('terminal.choice.confirm', { option: optionLabel(pending, mode), steps: pending - 1 })}
          </p>
          <input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setPending(null); }}
            placeholder={t('terminal.choice.textPlaceholder')}
            className="w-full rounded-lg border border-slate-500/20 bg-white/60 px-2 py-1.5 text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 dark:bg-slate-950/40 dark:text-slate-100"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={disabled || busy}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-fuchsia-500 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {t('terminal.choice.send', { option: optionLabel(pending, mode) })}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              title={t('common.cancel')}
              aria-label={t('common.cancel')}
              className="inline-flex items-center justify-center rounded-lg px-2 text-slate-500 hover:bg-slate-500/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
