/** Multi-codec text encoder/decoder: codec chips over a live dual-pane (Base64, Base32, hex, URL, HTML, quoted-printable, escapes). */
import React, { useMemo, useState } from 'react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { TEXT_CODEC_IDS, TEXT_CODECS, utf8ToBytes, type TextCodecId } from './convertCodecs';
import {
  attempt, ConvertPage, DualPane, errorMessage, formatBytes, Notice, prefillOf, SkyChips, StatChip, SwapButton, TextPane, Toolbar, ToolbarGroup,
  useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

type Mode = 'encode' | 'decode';

interface TextEncoderInput {
  mode: Mode;
  codec: TextCodecId;
  text: string;
}

const TextEncoderWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<TextEncoderInput>(lastRun);
  const [mode, setMode] = useState<Mode>(variant === 'textDecoder' ? 'decode' : prefill.mode ?? 'encode');
  const [codec, setCodec] = useState<TextCodecId>(prefill.codec && TEXT_CODECS[prefill.codec] ? prefill.codec : 'base64');
  const [text, setText] = useState(prefill.text ?? '');
  const record = useRecorder(tool.id, variant);

  const { value: output, error } = useMemo(() => attempt(() => (text ? TEXT_CODECS[codec][mode](text) : '')), [codec, mode, text]);

  const snapshot: TextEncoderInput = { mode, codec, text };
  useDebouncedRecord(tool.id, variant, snapshot, output, Boolean(text && output && !error));

  const swap = (): void => {
    if (output && !error) setText(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };
  const plainLabel = tc('encoder.plain');
  const codedLabel = tc(`encoder.codec_${codec}`);

  return (
    <ConvertPage>
      <Toolbar>
        <SkyChips value={mode} onChange={setMode} label={tc('common.mode')} options={[{ value: 'encode', label: tc('common.encode') }, { value: 'decode', label: tc('common.decode') }]} />
      </Toolbar>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40">
        <ToolbarGroup label={tc('encoder.codec')}>
          <SkyChips value={codec} onChange={setCodec} options={TEXT_CODEC_IDS.map((id) => ({ value: id, label: tc(`encoder.codec_${id}`) }))} />
        </ToolbarGroup>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{tc(`encoder.hint_${codec}`)}</p>
      </div>
      <DualPane
        left={(
          <TextPane
            label={mode === 'encode' ? plainLabel : codedLabel}
            value={text}
            onChange={setText}
            placeholder={tc('encoder.placeholder')}
            footer={text ? <StatChip>{formatBytes(utf8ToBytes(text).length)}</StatChip> : null}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={(
          <TextPane
            label={mode === 'encode' ? codedLabel : plainLabel}
            value={output}
            invalid={Boolean(error)}
            onCopied={() => record(snapshot, output)}
            footer={output ? <StatChip>{formatBytes(utf8ToBytes(output).length)}</StatChip> : null}
          />
        )}
      />
      {error ? <Notice>{errorMessage(tc, error)}</Notice> : null}
    </ConvertPage>
  );
};

export default TextEncoderWorkbench;
