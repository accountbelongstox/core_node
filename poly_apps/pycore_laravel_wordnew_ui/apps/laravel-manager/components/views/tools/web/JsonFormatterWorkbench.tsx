/** JSON formatter: live beautify / minify with error pointer, tree view and size delta. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, ChevronsDownUp, ChevronsUpDown, Download, Eraser, FileJson, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CodeEditor, Btn, CopyBtn, Metric, Notice, Pane, Seg, Toggle, WebPage, downloadText, formatBytes, lastInput, pickBool, pickOption, pickString, useDebounced, useToolRecord, utf8Length } from './kit/webKit';
import { JsonTree } from './kit/JsonTree';
import { countNodes, parseJson, sortKeysDeep, stringifyJson, type JsonIndent, type JsonValue } from './logic/json';

type Mode = 'format' | 'minify';
type View = 'text' | 'tree';

const INDENTS: readonly JsonIndent[] = [2, 4, 8, 'tab'];
const SAMPLE = '{"name":"core_node","version":"1.0.0","tags":["tools","json"],"nested":{"enabled":true,"ratio":0.75,"items":[{"id":1,"label":"first"},{"id":2,"label":null}]}}';
const DEBOUNCE_MS = 150;
const TREE_OPEN_LEVEL = 2;
const TREE_ALL = 99;

const depthOf = (value: JsonValue): number => {
  if (Array.isArray(value)) return 1 + value.reduce<number>((max, item) => Math.max(max, depthOf(item)), 0);
  if (value && typeof value === 'object') return 1 + Object.values(value).reduce<number>((max, item) => Math.max(max, depthOf(item)), 0);
  return 0;
};

const JsonFormatterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [input, setInput] = useState(pickString(prefill, 'json', ''));
  const [mode, setMode] = useState<Mode>(variant === 'jsonMinifier' ? 'minify' : pickOption<Mode>(prefill, 'mode', ['format', 'minify'], 'format'));
  const [indent, setIndent] = useState<JsonIndent>(pickOption<JsonIndent>(prefill, 'indent', INDENTS, 2));
  const [sortKeys, setSortKeys] = useState(pickBool(prefill, 'sortKeys', false));
  const [view, setView] = useState<View>('text');
  const [treeLevel, setTreeLevel] = useState({ open: TREE_OPEN_LEVEL, seq: 0 });
  const [jump, setJump] = useState<{ offset: number; seq: number } | null>(null);
  const source = useDebounced(input, DEBOUNCE_MS);

  const parsed = useMemo(() => parseJson(source), [source]);
  const output = useMemo(() => {
    if (!parsed.ok) return '';
    const value = sortKeys ? sortKeysDeep(parsed.value) : parsed.value;
    return stringifyJson(value, mode === 'minify' ? 0 : indent);
  }, [parsed, sortKeys, mode, indent]);
  const stats = useMemo(() => {
    if (!parsed.ok) return null;
    const before = utf8Length(source);
    const after = utf8Length(output);
    return { before, after, change: before ? Math.round(((after - before) / before) * 100) : 0, nodes: countNodes(parsed.value), depth: depthOf(parsed.value) };
  }, [parsed, source, output]);

  const empty = !source.trim();
  const error = parsed.ok === false && !empty ? parsed.error : null;
  const recordRun = () => record({ json: input, mode, indent, sortKeys }, { bytes: output.length });
  const setTree = (open: number) => setTreeLevel((prev) => ({ open, seq: prev.seq + 1 }));

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Seg value={mode} onChange={setMode} ariaLabel={t('toolsWeb.json.mode')} options={[
          { value: 'format', label: t('toolsWeb.json.mode_format') },
          { value: 'minify', label: t('toolsWeb.json.mode_minify') },
        ]} />
        {mode === 'format' && (
          <Seg value={indent} onChange={setIndent} ariaLabel={t('toolsWeb.json.indent')} options={INDENTS.map((value) => ({ value, label: value === 'tab' ? t('toolsWeb.json.indent_tab') : String(value) }))} />
        )}
        <Toggle on={sortKeys} onChange={setSortKeys} label={t('toolsWeb.json.sort_keys')} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title={t('toolsWeb.json.input')}
          icon={FileJson}
          className="h-[44vh] min-h-[260px] lg:h-[62vh]"
          actions={(
            <>
              <Btn icon={Wand2} onClick={() => setInput(SAMPLE)}>{t('toolsWeb.common.sample')}</Btn>
              <Btn icon={Eraser} onClick={() => setInput('')} disabled={!input}>{t('uiTools.common.clear')}</Btn>
            </>
          )}
          footer={`${formatBytes(utf8Length(input))} · ${t('toolsWeb.common.lines', { count: input ? input.split('\n').length : 0 })}`}
          bodyClassName="flex flex-col"
        >
          <CodeEditor value={input} onChange={setInput} language="json" placeholder={t('toolsWeb.json.placeholder')} errorLine={error?.line ?? null} jumpTo={jump} className="min-h-0 flex-1" />
        </Pane>

        <Pane
          title={t('toolsWeb.json.output')}
          icon={CheckCircle2}
          className="h-[44vh] min-h-[260px] lg:h-[62vh]"
          actions={(
            <>
              <Seg value={view} onChange={setView} options={[
                { value: 'text', label: t('toolsWeb.json.view_text') },
                { value: 'tree', label: t('toolsWeb.json.view_tree') },
              ]} />
              {view === 'tree' && parsed.ok && (
                <>
                  <Btn icon={ChevronsUpDown} title={t('toolsWeb.json.expand_all')} onClick={() => setTree(TREE_ALL)} />
                  <Btn icon={ChevronsDownUp} title={t('toolsWeb.json.collapse_all')} onClick={() => setTree(0)} />
                </>
              )}
              <Btn icon={ArrowLeftRight} title={t('toolsWeb.json.use_as_input')} onClick={() => setInput(output)} disabled={!output} />
              <CopyBtn getText={() => output} onCopied={recordRun} disabled={!output} />
              <Btn icon={Download} title={t('uiTools.common.download')} disabled={!output} onClick={() => { downloadText(output, mode === 'minify' ? 'data.min.json' : 'data.json', 'application/json'); recordRun(); }} />
            </>
          )}
          footer={stats ? `${formatBytes(stats.before)} → ${formatBytes(stats.after)}` : t('toolsWeb.json.waiting')}
          bodyClassName="flex flex-col"
        >
          {parsed.ok && view === 'tree'
            ? <div className="min-h-0 flex-1"><JsonTree key={treeLevel.seq} value={parsed.value} openLevel={treeLevel.open} /></div>
            : <CodeEditor value={output} readOnly language="json" className="min-h-0 flex-1" />}
        </Pane>
      </div>

      {error && (
        <Notice tone="error" icon={AlertTriangle}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono font-bold">{t('toolsWeb.json.error_at', { line: error.line, column: error.column })}</span>
            <span>{t(`toolsWeb.json.errors.${error.code}`, { char: error.char })}</span>
            <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setJump({ offset: error.offset, seq: (jump?.seq ?? 0) + 1 })}>{t('toolsWeb.json.go_to_error')}</button>
          </div>
        </Notice>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label={t('toolsWeb.json.stat_before')} value={formatBytes(stats.before)} />
          <Metric label={t('toolsWeb.json.stat_after')} value={formatBytes(stats.after)} tone="text-cyan-600 dark:text-cyan-300" />
          <Metric label={t('toolsWeb.json.stat_change')} value={`${stats.change > 0 ? '+' : ''}${stats.change}%`} tone={stats.change < 0 ? 'text-emerald-600 dark:text-emerald-400' : undefined} />
          <Metric label={t('toolsWeb.json.stat_nodes')} value={stats.nodes} />
          <Metric label={t('toolsWeb.json.stat_depth')} value={stats.depth} />
        </div>
      )}
    </WebPage>
  );
};

export default JsonFormatterWorkbench;
