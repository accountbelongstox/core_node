/** XML formatter: DOMParser validation, pretty / minify output and an XPath tester. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Braces, CheckCircle2, Download, Eraser, FileCode, Search, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CodeEditor, CopyBtn, Metric, Notice, Pane, Seg, WEB_MONO_INPUT_CLASS, WebPage, downloadText, formatBytes, lastInput, pickOption, pickString, useDebounced, useToolRecord, utf8Length } from './kit/webKit';
import { evaluateXPath, formatXml, type XmlAttrWrap } from './logic/xml';

type Mode = 'format' | 'minify';
type Indent = 2 | 4 | 'tab';

const INDENTS: readonly Indent[] = [2, 4, 'tab'];
const WRAPS: readonly XmlAttrWrap[] = ['never', 'long', 'always'];
const DEBOUNCE_MS = 200;
const SAMPLE = '<?xml version="1.0" encoding="UTF-8"?><catalog xmlns:i="urn:inventory"><book id="bk101" lang="en"><title>XML Developer\'s Guide</title><price currency="USD">44.95</price><i:stock count="12"/></book><book id="bk102" lang="en"><title>Midnight Rain</title><price currency="USD">5.95</price></book><!-- more books --></catalog>';
const SAMPLE_XPATH = '//book[price < 10]/title';
const KIND_CLASS: Record<string, string> = {
  element: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  attribute: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  text: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  comment: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  other: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
};

const lineOffset = (text: string, line: number, column: number): number => {
  let offset = 0;
  for (let i = 1; i < line; i++) {
    const next = text.indexOf('\n', offset);
    if (next < 0) return text.length;
    offset = next + 1;
  }
  return Math.min(offset + Math.max(0, column - 1), text.length);
};

const XmlFormatterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [input, setInput] = useState(pickString(prefill, 'xml', ''));
  const [mode, setMode] = useState<Mode>(pickOption<Mode>(prefill, 'mode', ['format', 'minify'], 'format'));
  const [indent, setIndent] = useState<Indent>(pickOption<Indent>(prefill, 'indent', INDENTS, 2));
  const [attrWrap, setAttrWrap] = useState<XmlAttrWrap>(pickOption<XmlAttrWrap>(prefill, 'attrWrap', WRAPS, 'long'));
  const [xpath, setXpath] = useState('');
  const [jump, setJump] = useState<{ offset: number; seq: number } | null>(null);
  const source = useDebounced(input, DEBOUNCE_MS);
  const expression = useDebounced(xpath, DEBOUNCE_MS);

  const result = useMemo(() => (source.trim() ? formatXml(source, { indent, minify: mode === 'minify', attrWrap }) : null), [source, indent, mode, attrWrap]);
  const output = result?.ok ? result.output : '';
  const error = result && !result.ok ? result.error : null;
  const xpathResult = useMemo(() => (expression.trim() && result?.ok ? evaluateXPath(source, expression.trim()) : null), [expression, source, result]);
  const recordRun = () => record({ xml: input, mode, indent, attrWrap }, { length: output.length });

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Seg value={mode} onChange={setMode} ariaLabel={t('toolsWeb.xml.mode')} options={[
          { value: 'format', label: t('toolsWeb.xml.mode_format') },
          { value: 'minify', label: t('toolsWeb.xml.mode_minify') },
        ]} />
        {mode === 'format' && (
          <>
            <Seg value={indent} onChange={setIndent} ariaLabel={t('toolsWeb.xml.indent')} options={INDENTS.map((value) => ({ value, label: value === 'tab' ? t('toolsWeb.xml.indent_tab') : String(value) }))} />
            <Seg value={attrWrap} onChange={setAttrWrap} ariaLabel={t('toolsWeb.xml.attr_wrap')} options={WRAPS.map((value) => ({ value, label: t(`toolsWeb.xml.wrap_${value}`) }))} />
          </>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title={t('toolsWeb.xml.input')}
          icon={FileCode}
          className="h-[44vh] min-h-[260px] lg:h-[58vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={Wand2} onClick={() => { setInput(SAMPLE); setXpath(SAMPLE_XPATH); }}>{t('toolsWeb.common.sample')}</Btn>
              <Btn icon={Eraser} disabled={!input} onClick={() => setInput('')} title={t('uiTools.common.clear')} />
            </>
          )}
          footer={formatBytes(utf8Length(input))}
        >
          <CodeEditor value={input} onChange={setInput} language="xml" placeholder={t('toolsWeb.xml.placeholder')} errorLine={error?.line ?? null} jumpTo={jump} className="min-h-0 flex-1" />
        </Pane>
        <Pane
          title={t('toolsWeb.xml.output')}
          icon={CheckCircle2}
          className="h-[44vh] min-h-[260px] lg:h-[58vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={ArrowLeftRight} title={t('toolsWeb.xml.use_as_input')} disabled={!output} onClick={() => setInput(output)} />
              <CopyBtn getText={() => output} onCopied={recordRun} disabled={!output} />
              <Btn icon={Download} title={t('uiTools.common.download')} disabled={!output} onClick={() => { downloadText(output, 'data.xml', 'application/xml'); recordRun(); }} />
            </>
          )}
          footer={`${formatBytes(utf8Length(output))} · ${t('toolsWeb.common.lines', { count: output ? output.split('\n').length : 0 })}`}
        >
          <CodeEditor value={output} readOnly language="xml" className="min-h-0 flex-1" />
        </Pane>
      </div>

      {error && (
        <Notice tone="error" icon={AlertTriangle}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {error.line !== null && <span className="font-mono font-bold">{t('toolsWeb.json.error_at', { line: error.line, column: error.column ?? 1 })}</span>}
            <span>{error.message}</span>
            {error.line !== null && (
              <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setJump({ offset: lineOffset(input, error.line as number, error.column ?? 1), seq: (jump?.seq ?? 0) + 1 })}>{t('toolsWeb.json.go_to_error')}</button>
            )}
          </div>
        </Notice>
      )}

      {result?.ok && (
        <div className="grid gap-3 lg:grid-cols-[14rem_1fr]">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <Metric label={t('toolsWeb.xml.stat_elements')} value={result.stats.elements} tone="text-cyan-600 dark:text-cyan-300" />
            <Metric label={t('toolsWeb.xml.stat_attributes')} value={result.stats.attributes} />
            <Metric label={t('toolsWeb.xml.stat_depth')} value={result.stats.depth} />
          </div>
          <Pane title={t('toolsWeb.xml.xpath')} icon={Search} bodyClassName="space-y-2 p-3">
            <input value={xpath} onChange={(event) => setXpath(event.target.value)} placeholder={t('toolsWeb.xml.xpath_placeholder')} spellCheck={false} aria-label={t('toolsWeb.xml.xpath')} className={`${WEB_MONO_INPUT_CLASS} text-xs`} />
            {xpathResult && !xpathResult.ok && <Notice tone="error" icon={AlertTriangle}>{xpathResult.message}</Notice>}
            {xpathResult?.ok && xpathResult.scalar !== null && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-700"><Braces className="h-3.5 w-3.5 text-cyan-500" aria-hidden />{xpathResult.scalar}</div>
            )}
            {xpathResult?.ok && xpathResult.scalar === null && (
              <>
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{t('toolsWeb.xml.xpath_matches', { count: xpathResult.items.length })}</p>
                <ul className="max-h-64 space-y-1 overflow-auto">
                  {xpathResult.items.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${KIND_CLASS[item.kind]}`}>{t(`toolsWeb.xml.kind_${item.kind}`)}</span>
                      <span className="min-w-0 break-all font-mono text-xs text-slate-700 dark:text-slate-200">{item.preview}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!xpathResult && <p className="text-xs text-slate-500 dark:text-slate-400">{t('toolsWeb.xml.xpath_hint')}</p>}
          </Pane>
        </div>
      )}
    </WebPage>
  );
};

export default XmlFormatterWorkbench;
