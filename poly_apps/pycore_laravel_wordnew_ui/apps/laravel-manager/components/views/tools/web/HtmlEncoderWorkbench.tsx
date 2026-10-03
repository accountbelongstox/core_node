/** HTML entity encoder / decoder: live two-way conversion with a changed-character inspector. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Eraser, Wand2, FileCode2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CodeEditor, CopyBtn, Metric, Pane, Seg, WebPage, lastInput, pickOption, pickString, useDebounced, useToolRecord } from './kit/webKit';
import { countEntities, decodeHtml, encodeHtml, type EntityScope, type EntityStyle } from './logic/htmlEntities';

type Mode = 'encode' | 'decode';

const SAMPLE_PLAIN = '<a href="/search?q=café&lang=fr">Café © 2026 — “quoted”</a>';
const REFERENCE: Array<[string, string]> = [
  ['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], ['"', '&quot;'], ['\u00a0', '&nbsp;'], ['©', '&copy;'], ['®', '&reg;'], ['€', '&euro;'],
  ['…', '&hellip;'], ['—', '&mdash;'], ['→', '&rarr;'], ['≤', '&le;'],
];
const STYLES: EntityStyle[] = ['named', 'decimal', 'hex'];
const SCOPES: EntityScope[] = ['minimal', 'nonascii', 'all'];
const DEBOUNCE_MS = 120;
const VISIBLE_STATS = 24;

const visibleChar = (char: string): string => (char === '\u00a0' ? 'NBSP' : char);

const HtmlEncoderWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [mode, setMode] = useState<Mode>(variant === 'htmlDecoder' ? 'decode' : pickOption<Mode>(prefill, 'mode', ['encode', 'decode'], 'encode'));
  const [style, setStyle] = useState<EntityStyle>(pickOption<EntityStyle>(prefill, 'style', STYLES, 'named'));
  const [scope, setScope] = useState<EntityScope>(pickOption<EntityScope>(prefill, 'scope', SCOPES, 'nonascii'));
  const [input, setInput] = useState(pickString(prefill, 'text', ''));
  const source = useDebounced(input, DEBOUNCE_MS);

  const result = useMemo(() => {
    if (mode === 'encode') return encodeHtml(source, { style, scope });
    return { output: decodeHtml(source), stats: [] };
  }, [mode, source, style, scope]);
  const changed = mode === 'encode' ? result.stats.reduce((sum, stat) => sum + stat.count, 0) : countEntities(source);
  const recordRun = () => record({ text: input, mode, style, scope }, { length: result.output.length });
  const swap = () => {
    setInput(result.output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };
  const insert = ([char, entity]: [string, string]) => setInput((prev) => prev + (mode === 'encode' ? char : entity));

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Seg value={mode} onChange={setMode} ariaLabel={t('toolsWeb.html.mode')} options={[
          { value: 'encode', label: t('toolsWeb.html.mode_encode') },
          { value: 'decode', label: t('toolsWeb.html.mode_decode') },
        ]} />
        {mode === 'encode' && (
          <>
            <Seg value={style} onChange={setStyle} ariaLabel={t('toolsWeb.html.style')} options={STYLES.map((value) => ({ value, label: t(`toolsWeb.html.style_${value}`) }))} />
            <Seg value={scope} onChange={setScope} ariaLabel={t('toolsWeb.html.scope')} options={SCOPES.map((value) => ({ value, label: t(`toolsWeb.html.scope_${value}`), title: t(`toolsWeb.html.scope_${value}_hint`) }))} />
          </>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title={t(mode === 'encode' ? 'toolsWeb.html.plain' : 'toolsWeb.html.encoded')}
          icon={FileCode2}
          className="h-[34vh] min-h-[220px]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={Wand2} onClick={() => { setInput(mode === 'encode' ? SAMPLE_PLAIN : encodeHtml(SAMPLE_PLAIN, { style: 'named', scope: 'nonascii' }).output); }}>{t('toolsWeb.common.sample')}</Btn>
              <Btn icon={Eraser} disabled={!input} onClick={() => setInput('')} title={t('uiTools.common.clear')} />
            </>
          )}
          footer={t('toolsWeb.common.chars', { count: input.length })}
        >
          <CodeEditor value={input} onChange={setInput} language={mode === 'encode' ? 'html' : 'text'} placeholder={t(mode === 'encode' ? 'toolsWeb.html.placeholder_plain' : 'toolsWeb.html.placeholder_encoded')} className="min-h-0 flex-1" />
        </Pane>
        <Pane
          title={t(mode === 'encode' ? 'toolsWeb.html.encoded' : 'toolsWeb.html.plain')}
          icon={FileCode2}
          className="h-[34vh] min-h-[220px]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={ArrowLeftRight} title={t('toolsWeb.html.use_as_input')} onClick={swap} disabled={!result.output} />
              <CopyBtn getText={() => result.output} onCopied={recordRun} disabled={!result.output} />
            </>
          )}
          footer={t('toolsWeb.common.chars', { count: result.output.length })}
        >
          <CodeEditor value={result.output} readOnly language={mode === 'encode' ? 'text' : 'html'} className="min-h-0 flex-1" />
        </Pane>
      </div>

      <div className="grid gap-3 lg:grid-cols-[14rem_1fr]">
        <Metric label={t(mode === 'encode' ? 'toolsWeb.html.stat_encoded' : 'toolsWeb.html.stat_decoded')} value={changed} tone="text-cyan-600 dark:text-cyan-300" />
        <Pane title={t(mode === 'encode' ? 'toolsWeb.html.changed_chars' : 'toolsWeb.html.reference')} bodyClassName="flex flex-wrap gap-1.5 p-3">
          {mode === 'encode' && result.stats.slice(0, VISIBLE_STATS).map((stat) => (
            <span key={stat.char} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-100">{visibleChar(stat.char)}</span>
              <span className="text-cyan-700 dark:text-cyan-300">{stat.entity}</span>
              <span className="text-slate-400">×{stat.count}</span>
            </span>
          ))}
          {mode === 'encode' && !result.stats.length && <span className="text-xs text-slate-500 dark:text-slate-400">{t('toolsWeb.html.nothing_changed')}</span>}
          {mode === 'decode' && REFERENCE.map((pair) => (
            <button key={pair[1]} type="button" onClick={() => insert(pair)} title={`${pair[0]} = ${pair[1]}`} className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-cyan-700 hover:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-300">
              {pair[1]}
            </button>
          ))}
        </Pane>
      </div>
    </WebPage>
  );
};

export default HtmlEncoderWorkbench;
