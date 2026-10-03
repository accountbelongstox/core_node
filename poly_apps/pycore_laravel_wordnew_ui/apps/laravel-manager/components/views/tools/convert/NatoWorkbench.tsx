/** NATO phonetic alphabet: live spelling tiles (letter over code word) and reverse decoding. */
import React, { useMemo, useState } from 'react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { NATO_SPACE, natoToText, textToNatoTokens } from './convertCodecs';
import {
  ConvertPage, DualPane, Notice, Panel, prefillOf, SkyChips, StatChip, SwapButton, TextPane, Toolbar, useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

type Mode = 'encode' | 'decode';

interface NatoInput {
  mode: Mode;
  text: string;
}

const NatoWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<NatoInput>(lastRun);
  const [mode, setMode] = useState<Mode>(prefill.mode ?? 'encode');
  const [text, setText] = useState(prefill.text ?? '');
  const record = useRecorder(tool.id, variant);

  const tokens = useMemo(() => (mode === 'encode' ? textToNatoTokens(text) : []), [mode, text]);
  const decoded = useMemo(() => (mode === 'decode' ? natoToText(text) : { text: '', unknown: [] as string[] }), [mode, text]);
  const output = mode === 'encode'
    ? tokens.map((token) => (token.word ?? token.char)).join(' ')
    : decoded.text;

  const snapshot: NatoInput = { mode, text };
  useDebouncedRecord(tool.id, variant, snapshot, output, Boolean(text && output));

  const swap = (): void => {
    if (output) setText(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };

  return (
    <ConvertPage>
      <Toolbar>
        <SkyChips value={mode} onChange={setMode} label={tc('common.mode')} options={[{ value: 'encode', label: tc('nato.text_to_nato') }, { value: 'decode', label: tc('nato.nato_to_text') }]} />
      </Toolbar>
      <DualPane
        left={(
          <TextPane
            label={mode === 'encode' ? tc('nato.text') : tc('nato.words')}
            value={text}
            onChange={setText}
            placeholder={mode === 'encode' ? tc('nato.placeholder_text') : tc('nato.placeholder_words')}
            rows={6}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={(
          <TextPane
            label={mode === 'encode' ? tc('nato.words') : tc('nato.text')}
            value={output}
            rows={6}
            onCopied={() => record(snapshot, output)}
            footer={mode === 'encode' && tokens.length > 0 ? <StatChip>{tc('nato.letters', { count: tokens.filter((token) => token.word).length })}</StatChip> : null}
          />
        )}
      />
      {decoded.unknown.length > 0 && <Notice tone="warning">{tc('nato.unknown_words', { words: decoded.unknown.join(', ') })}</Notice>}
      {mode === 'encode' && tokens.length > 0 && (
        <Panel className="p-3">
          <div className="flex flex-wrap gap-1.5">
            {tokens.map((token, index) => (token.char === NATO_SPACE ? (
              <span key={index} className="w-4" aria-hidden />
            ) : (
              <div key={index} className="flex min-w-[3.6rem] flex-col items-center rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 text-center dark:border-sky-500/30 dark:bg-sky-500/10">
                <span className="font-mono text-lg font-bold text-sky-700 dark:text-sky-300">{token.char.toUpperCase()}</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{token.word ?? '\u00b7'}</span>
              </div>
            )))}
          </div>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default NatoWorkbench;
