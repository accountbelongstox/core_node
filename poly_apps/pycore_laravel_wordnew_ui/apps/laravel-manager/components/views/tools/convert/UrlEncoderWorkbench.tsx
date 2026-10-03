/** URL percent-encoder/decoder: live dual-pane with component/full/form scope and a parsed URL breakdown. */
import React, { useMemo, useState } from 'react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { parseUrlParts, urlDecode, urlEncode, type UrlScope } from './convertCodecs';
import {
  attempt, ConvertPage, DualPane, errorMessage, LABEL_CLASS, Notice, Panel, prefillOf, SkyChips, StatChip, SwapButton, TextPane, Toolbar, ToolbarGroup,
  useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

type Mode = 'encode' | 'decode';

interface UrlInput {
  mode: Mode;
  scope: UrlScope;
  text: string;
}

const SCOPES: UrlScope[] = ['component', 'full', 'form'];

const UrlEncoderWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<UrlInput>(lastRun);
  const [mode, setMode] = useState<Mode>(variant === 'urlDecoder' ? 'decode' : prefill.mode ?? 'encode');
  const [scope, setScope] = useState<UrlScope>(prefill.scope ?? 'component');
  const [text, setText] = useState(prefill.text ?? '');
  const record = useRecorder(tool.id, variant);

  const { value: output, error } = useMemo(() => attempt(() => (text ? (mode === 'encode' ? urlEncode(text, scope) : urlDecode(text, scope)) : '')), [mode, scope, text]);
  const plainUrl = mode === 'encode' ? text : output;
  const parts = useMemo(() => (plainUrl ? parseUrlParts(plainUrl.trim()) : null), [plainUrl]);

  const snapshot: UrlInput = { mode, scope, text };
  useDebouncedRecord(tool.id, variant, snapshot, output, Boolean(text && output && !error));

  const swap = (): void => {
    if (output && !error) setText(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };

  return (
    <ConvertPage>
      <Toolbar>
        <SkyChips value={mode} onChange={setMode} label={tc('common.mode')} options={[{ value: 'encode', label: tc('common.encode') }, { value: 'decode', label: tc('common.decode') }]} />
        <ToolbarGroup label={tc('url.scope')}>
          <SkyChips value={scope} onChange={setScope} options={SCOPES.map((id) => ({ value: id, label: tc(`url.scope_${id}`), title: tc(`url.scope_${id}_hint`) }))} />
        </ToolbarGroup>
      </Toolbar>
      <DualPane
        left={(
          <TextPane
            label={mode === 'encode' ? tc('url.plain') : tc('url.encoded')}
            value={text}
            onChange={setText}
            placeholder={mode === 'encode' ? tc('url.placeholder_plain') : tc('url.placeholder_encoded')}
            footer={text ? <StatChip>{text.length}</StatChip> : null}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={(
          <TextPane
            label={mode === 'encode' ? tc('url.encoded') : tc('url.plain')}
            value={output}
            invalid={Boolean(error)}
            onCopied={() => record(snapshot, output)}
            footer={output ? <StatChip>{output.length}</StatChip> : null}
          />
        )}
      />
      {error ? <Notice>{errorMessage(tc, error)}</Notice> : null}
      {parts && (
        <Panel className="space-y-2 p-3">
          <div className={LABEL_CLASS}>{tc('url.breakdown')}</div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-500 dark:text-slate-400">{tc('url.origin')}</dt>
            <dd className="break-all font-mono text-slate-800 dark:text-slate-100">{parts.origin}</dd>
            <dt className="text-slate-500 dark:text-slate-400">{tc('url.path')}</dt>
            <dd className="break-all font-mono text-slate-800 dark:text-slate-100">{parts.path}</dd>
            {parts.hash && (
              <>
                <dt className="text-slate-500 dark:text-slate-400">{tc('url.hash')}</dt>
                <dd className="break-all font-mono text-slate-800 dark:text-slate-100">{parts.hash}</dd>
              </>
            )}
          </dl>
          {parts.params.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr><th className="px-3 py-1.5 font-semibold">{tc('url.param_key')}</th><th className="px-3 py-1.5 font-semibold">{tc('url.param_value')}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-700/50">
                  {parts.params.map(([key, value], index) => (
                    <tr key={`${key}:${index}`}>
                      <td className="break-all px-3 py-1.5 text-sky-700 dark:text-sky-300">{key}</td>
                      <td className="break-all px-3 py-1.5 text-slate-800 dark:text-slate-100">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </ConvertPage>
  );
};

export default UrlEncoderWorkbench;
