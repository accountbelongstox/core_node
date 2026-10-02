import React, { useState } from 'react';
import { ListChecks, Pencil } from 'lucide-react';
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

/** Answers an AI agent's choice menu in one tap: Down to the chosen row, then Enter (optional text is typed first). */
export const PcTerminalChoicePicker: React.FC<PcTerminalChoicePickerProps> = ({ disabled, busy, onChoose }) => {
  const { t } = useTranslation('pc');
  const [mode, setMode] = useState<OptionLabelMode>(() => (
    StorageManager.getRaw(StorageKeys.PYCORE_TERMINAL_CHOICE_LABELS) === 'letter' ? 'letter' : 'number'
  ));
  const [textOpen, setTextOpen] = useState(false);
  const [text, setText] = useState('');

  const switchMode = () => {
    const next: OptionLabelMode = mode === 'number' ? 'letter' : 'number';
    setMode(next);
    StorageManager.setRaw(StorageKeys.PYCORE_TERMINAL_CHOICE_LABELS, next);
  };

  // The optional text is used for one answer, then cleared.
  const choose = async (position: number) => {
    if (await onChoose(position, text.trim())) {
      setText('');
      setTextOpen(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <ListChecks className="h-3.5 w-3.5 shrink-0 text-fuchsia-500" aria-label={t('terminal.choice.title')} />
        <div className="grid flex-1 grid-cols-6 gap-0.5">
          {Array.from({ length: OPTION_COUNT }, (_, offset) => offset + 1).map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => void choose(position)}
              disabled={disabled || busy}
              title={t('terminal.choice.pick', { option: optionLabel(position, mode) })}
              aria-label={t('terminal.choice.pick', { option: optionLabel(position, mode) })}
              className="h-7 rounded-md font-mono text-xs font-bold text-fuchsia-600 hover:bg-fuchsia-500/10 disabled:opacity-40 dark:text-fuchsia-400"
            >
              {optionLabel(position, mode)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={switchMode}
          title={t(`terminal.choice.mode.${mode === 'number' ? 'letter' : 'number'}`)}
          className="h-6 shrink-0 rounded-md border border-slate-500/25 px-1 font-mono text-[10px] font-bold text-slate-500"
        >
          {mode === 'number' ? '12' : 'AB'}
        </button>
        <button
          type="button"
          onClick={() => setTextOpen((value) => !value)}
          aria-pressed={textOpen || Boolean(text)}
          title={t('terminal.choice.textPlaceholder')}
          aria-label={t('terminal.choice.textPlaceholder')}
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
            text ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-400 hover:bg-slate-500/10'
          }`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      {textOpen && (
        <input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('terminal.choice.textPlaceholder')}
          className="w-full rounded-md border border-slate-500/20 bg-white/60 px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 dark:bg-slate-950/40 dark:text-slate-100"
        />
      )}
    </div>
  );
};
