/** Base64 text converter: live dual-pane with URL-safe, padding and line-wrap options. */
import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { base64ToBytes, bytesToBase64, bytesToUtf8, looksLikeBase64, toUrlSafeBase64, utf8ToBytes, wrapLines } from './convertCodecs';
import {
  attempt, ConvertPage, DualPane, errorMessage, formatBytes, Notice, prefillOf, SkyChips, StatChip, SwapButton, TextPane, ToggleField, Toolbar, ToolbarGroup,
  useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

type Mode = 'encode' | 'decode';
type WrapWidth = 0 | 64 | 76;

interface Base64Input {
  mode: Mode;
  text: string;
  urlSafe: boolean;
  padding: boolean;
  wrap: WrapWidth;
}

const WRAP_WIDTHS: WrapWidth[] = [0, 64, 76];
const VARIANT_MODES: Record<string, Mode> = { base64EncoderV2: 'encode', base64DecoderV2: 'decode' };

const Base64Workbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<Base64Input>(lastRun);
  const [mode, setMode] = useState<Mode>(VARIANT_MODES[variant] ?? prefill.mode ?? 'encode');
  const [text, setText] = useState(prefill.text ?? '');
  const [urlSafe, setUrlSafe] = useState(prefill.urlSafe ?? false);
  const [padding, setPadding] = useState(prefill.padding ?? true);
  const [wrap, setWrap] = useState<WrapWidth>(prefill.wrap ?? 0);
  const record = useRecorder(tool.id, variant);

  const { value: output, error } = useMemo(() => attempt(() => {
    if (!text) return '';
    if (mode === 'decode') return bytesToUtf8(base64ToBytes(text));
    let encoded = bytesToBase64(utf8ToBytes(text));
    if (urlSafe) encoded = toUrlSafeBase64(encoded, padding);
    else if (!padding) encoded = encoded.replace(/=+$/, '');
    return wrapLines(encoded, wrap);
  }), [mode, text, urlSafe, padding, wrap]);

  const snapshot: Base64Input = { mode, text, urlSafe, padding, wrap };
  useDebouncedRecord(tool.id, variant, snapshot, output, Boolean(text && output && !error));

  const swap = (): void => {
    if (output && !error) setText(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };
  const suggestDecode = mode === 'encode' && looksLikeBase64(text);
  const inputBytes = mode === 'encode' ? utf8ToBytes(text).length : text.replace(/\s+/g, '').length;
  const outputBytes = mode === 'encode' ? output.length : utf8ToBytes(output).length;

  return (
    <ConvertPage>
      <Toolbar>
        <ToolbarGroup>
          <SkyChips value={mode} onChange={setMode} label={tc('common.mode')} options={[{ value: 'encode', label: tc('common.encode') }, { value: 'decode', label: tc('common.decode') }]} />
        </ToolbarGroup>
        {mode === 'encode' && (
          <>
            <ToggleField label={tc('base64.url_safe')} on={urlSafe} onChange={setUrlSafe} />
            <ToggleField label={tc('base64.padding')} on={padding} onChange={setPadding} />
            <ToolbarGroup label={tc('base64.wrap')}>
              <SkyChips value={wrap} onChange={setWrap} options={WRAP_WIDTHS.map((width) => ({ value: width, label: width === 0 ? tc('common.off') : String(width) }))} />
            </ToolbarGroup>
          </>
        )}
      </Toolbar>
      {suggestDecode && (
        <Notice tone="info">
          <span>{tc('base64.looks_encoded')}</span>{' '}
          <button type="button" className="inline-flex items-center gap-1 font-semibold underline" onClick={() => setMode('decode')}>
            {tc('base64.switch_decode')}<ArrowRight className="h-3 w-3" />
          </button>
        </Notice>
      )}
      <DualPane
        left={(
          <TextPane
            label={mode === 'encode' ? tc('base64.plain_text') : tc('base64.encoded')}
            value={text}
            onChange={setText}
            placeholder={mode === 'encode' ? tc('base64.placeholder_plain') : tc('base64.placeholder_encoded')}
            footer={text ? <StatChip>{formatBytes(inputBytes)}</StatChip> : null}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={(
          <TextPane
            label={mode === 'encode' ? tc('base64.encoded') : tc('base64.plain_text')}
            value={output}
            invalid={Boolean(error)}
            onCopied={() => record(snapshot, output)}
            footer={output ? (
              <>
                <StatChip>{formatBytes(outputBytes)}</StatChip>
                {mode === 'encode' && inputBytes > 0 && <StatChip title={tc('base64.overhead')}>{`${Math.round((outputBytes / inputBytes) * 100)}%`}</StatChip>}
              </>
            ) : null}
          />
        )}
      />
      {error ? <Notice>{errorMessage(tc, error)}</Notice> : null}
    </ConvertPage>
  );
};

export default Base64Workbench;
