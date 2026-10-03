/** JSON diff: two editors and a colored structural change list (added / removed / changed paths). */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Eraser, FileDiff, Minus, Plus, Repeat, Replace, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CodeEditor, CopyBtn, Notice, Pane, WebPage, lastInput, pickString, useDebounced, useToolRecord } from './kit/webKit';
import { diffJson, parseJson, toJsonPatch, type DiffKind, type JsonDiffEntry, type JsonValue } from './logic/json';

type Filter = 'all' | DiffKind;

const DEBOUNCE_MS = 200;
const PREVIEW_CHARS = 120;
const SAMPLE_A = '{"name":"core_node","version":"1.0.0","tags":["a","b","c"],"config":{"debug":false,"retries":3},"legacy":true}';
const SAMPLE_B = '{"name":"core_node","version":"1.1.0","tags":["a","x"],"config":{"debug":false,"retries":5,"timeout":30},"owner":{"id":7}}';
const FILTERS: Filter[] = ['all', 'added', 'removed', 'changed', 'type'];

const KIND_STYLE: Record<DiffKind, { bar: string; chip: string; icon: typeof Plus }> = {
  added: { bar: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', icon: Plus },
  removed: { bar: 'bg-rose-500', chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', icon: Minus },
  changed: { bar: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', icon: Replace },
  type: { bar: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', icon: Repeat },
};

const compact = (value: JsonValue | undefined): string => {
  const text = JSON.stringify(value);
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
};

const ValueBox: React.FC<{ value: JsonValue | undefined; tone: string; expanded: boolean }> = ({ value, tone, expanded }) => (
  <pre className={`min-w-0 whitespace-pre-wrap break-all rounded-md px-2 py-1 font-mono text-[11px] leading-5 ${tone}`}>
    {expanded ? JSON.stringify(value, null, 2) : compact(value)}
  </pre>
);

const JsonDiffWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [left, setLeft] = useState(pickString(prefill, 'json1', ''));
  const [right, setRight] = useState(pickString(prefill, 'json2', ''));
  const [filter, setFilter] = useState<Filter>('all');
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const a = useDebounced(left, DEBOUNCE_MS);
  const b = useDebounced(right, DEBOUNCE_MS);

  const parsedA = useMemo(() => parseJson(a), [a]);
  const parsedB = useMemo(() => parseJson(b), [b]);
  const entries = useMemo<JsonDiffEntry[] | null>(() => (parsedA.ok && parsedB.ok ? diffJson(parsedA.value, parsedB.value) : null), [parsedA, parsedB]);
  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: 0, added: 0, removed: 0, changed: 0, type: 0 };
    (entries ?? []).forEach((entry) => { result.all++; result[entry.kind]++; });
    return result;
  }, [entries]);
  const visible = (entries ?? []).filter((entry) => filter === 'all' || entry.kind === filter);
  const errorA = !parsedA.ok && a.trim() ? parsedA.error : null;
  const errorB = !parsedB.ok && b.trim() ? parsedB.error : null;
  const patch = useMemo(() => (entries ? JSON.stringify(toJsonPatch(entries), null, 2) : ''), [entries]);
  const report = () => visible.map((entry) => `${entry.kind}\t${entry.path}`).join('\n');
  const recordRun = () => record({ json1: left, json2: right }, { differences: counts.all });
  const toggleRow = (key: string) => setOpenRows((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const editor = (side: 'a' | 'b') => {
    const value = side === 'a' ? left : right;
    const error = side === 'a' ? errorA : errorB;
    return (
      <Pane
        title={t(side === 'a' ? 'toolsWeb.jsonDiff.original' : 'toolsWeb.jsonDiff.modified')}
        icon={FileDiff}
        className="h-[34vh] min-h-[220px]"
        bodyClassName="flex flex-col"
        actions={<Btn icon={Eraser} disabled={!value} onClick={() => (side === 'a' ? setLeft('') : setRight(''))} title={t('uiTools.common.clear')} />}
        footer={error ? <span className="text-rose-500">{t('toolsWeb.json.error_at', { line: error.line, column: error.column })}</span> : value.trim() ? t('toolsWeb.jsonDiff.valid') : t('toolsWeb.jsonDiff.waiting')}
      >
        <CodeEditor value={value} onChange={side === 'a' ? setLeft : setRight} language="json" errorLine={error?.line ?? null} placeholder={t('toolsWeb.jsonDiff.placeholder')} className="min-h-0 flex-1" />
      </Pane>
    );
  };

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-2">
        <Btn icon={Wand2} onClick={() => { setLeft(SAMPLE_A); setRight(SAMPLE_B); }}>{t('toolsWeb.common.sample')}</Btn>
        <Btn icon={ArrowLeftRight} onClick={() => { setLeft(right); setRight(left); }} disabled={!left && !right}>{t('toolsWeb.jsonDiff.swap')}</Btn>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">{editor('a')}{editor('b')}</div>

      {(errorA || errorB) && (
        <Notice tone="error" icon={AlertTriangle}>
          {errorA && <div>{t('toolsWeb.jsonDiff.error_side', { side: t('toolsWeb.jsonDiff.original'), message: t(`toolsWeb.json.errors.${errorA.code}`, { char: errorA.char }) })}</div>}
          {errorB && <div>{t('toolsWeb.jsonDiff.error_side', { side: t('toolsWeb.jsonDiff.modified'), message: t(`toolsWeb.json.errors.${errorB.code}`, { char: errorB.char }) })}</div>}
        </Notice>
      )}

      {entries && (
        <Pane
          title={t('toolsWeb.jsonDiff.changes')}
          icon={FileDiff}
          actions={(
            <>
              <CopyBtn getText={report} label={t('toolsWeb.jsonDiff.copy_report')} disabled={!visible.length} />
              <CopyBtn getText={() => patch} onCopied={recordRun} label={t('toolsWeb.jsonDiff.copy_patch')} disabled={!entries.length} />
            </>
          )}
        >
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 p-3 dark:border-slate-800">
            {FILTERS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setFilter(kind)}
                aria-pressed={filter === kind}
                className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] font-bold transition-colors ${filter === kind ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300 text-slate-600 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-300'}`}
              >
                {t(`toolsWeb.jsonDiff.filter_${kind}`)} {counts[kind]}
              </button>
            ))}
          </div>
          {!entries.length ? (
            <div className="p-3"><Notice tone="ok" icon={CheckCircle2}>{t('toolsWeb.jsonDiff.identical')}</Notice></div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((entry, index) => {
                const style = KIND_STYLE[entry.kind];
                const Icon = style.icon;
                const key = `${entry.kind}:${entry.pointer}:${index}`;
                const expanded = openRows.has(key);
                return (
                  <li key={key}>
                    <button type="button" onClick={() => toggleRow(key)} className="flex w-full cursor-pointer items-stretch text-left hover:bg-slate-50 dark:hover:bg-slate-800/40" aria-expanded={expanded}>
                      <span className={`w-1 shrink-0 ${style.bar}`} />
                      <span className="grid min-w-0 flex-1 gap-1 px-3 py-2 md:grid-cols-[minmax(0,14rem)_1fr] md:gap-3">
                        <span className="flex min-w-0 items-start gap-2">
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${style.chip}`}><Icon className="h-3 w-3" aria-hidden />{t(`toolsWeb.jsonDiff.kind_${entry.kind}`)}</span>
                          <span className="min-w-0 break-all font-mono text-xs font-semibold text-cyan-700 dark:text-cyan-300">{entry.path}</span>
                        </span>
                        <span className="grid min-w-0 gap-1 sm:grid-cols-2">
                          {'before' in entry && <ValueBox value={entry.before} expanded={expanded} tone="bg-rose-500/10 text-rose-800 dark:text-rose-200" />}
                          {'after' in entry && <ValueBox value={entry.after} expanded={expanded} tone="bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" />}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Pane>
      )}
    </WebPage>
  );
};

export default JsonDiffWorkbench;
