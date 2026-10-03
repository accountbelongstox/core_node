/** YAML formatter: structure-preserving re-indent with a clickable lint list. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, Eraser, FileCog, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CodeEditor, CopyBtn, Metric, Notice, Pane, Seg, Toggle, WebPage, downloadText, lastInput, pickBool, pickOption, pickString, useDebounced, useToolRecord } from './kit/webKit';
import { formatYaml } from './logic/yaml';

type Indent = 2 | 4;

const INDENTS: readonly Indent[] = [2, 4];
const DEBOUNCE_MS = 150;
const SAMPLE = 'version: "3.8"\nservices:\n    web:\n          image: nginx:latest\n          ports:\n              - "80:80"\n          environment:\n          - KEY=value   \n    db:\n        image: postgres\n\n\n\n        command: |\n            echo start\n              indented\n';

const lineOffset = (text: string, line: number): number => {
  let offset = 0;
  for (let i = 1; i < line; i++) {
    const next = text.indexOf('\n', offset);
    if (next < 0) return text.length;
    offset = next + 1;
  }
  return offset;
};

const YamlFormatterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [input, setInput] = useState(pickString(prefill, 'yaml', ''));
  const [indent, setIndent] = useState<Indent>(pickOption<Indent>(prefill, 'indent', INDENTS, 2));
  const [trimTrailing, setTrimTrailing] = useState(pickBool(prefill, 'trimTrailing', true));
  const [collapseBlank, setCollapseBlank] = useState(pickBool(prefill, 'collapseBlank', true));
  const [finalNewline, setFinalNewline] = useState(pickBool(prefill, 'finalNewline', true));
  const [jump, setJump] = useState<{ offset: number; seq: number } | null>(null);
  const source = useDebounced(input, DEBOUNCE_MS);

  const result = useMemo(() => (source.trim() ? formatYaml(source, { indent, trimTrailing, collapseBlank, finalNewline }) : null), [source, indent, trimTrailing, collapseBlank, finalNewline]);
  const output = result?.output ?? '';
  const issues = result?.issues ?? [];
  const firstIssueLine = issues[0]?.line ?? null;
  const recordRun = () => record({ yaml: input, indent, trimTrailing, collapseBlank, finalNewline }, { lines: output.split('\n').length, issues: issues.length });

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Seg value={indent} onChange={setIndent} ariaLabel={t('toolsWeb.yaml.indent')} options={INDENTS.map((value) => ({ value, label: String(value) }))} />
        <Toggle on={trimTrailing} onChange={setTrimTrailing} label={t('toolsWeb.yaml.trim_trailing')} />
        <Toggle on={collapseBlank} onChange={setCollapseBlank} label={t('toolsWeb.yaml.collapse_blank')} />
        <Toggle on={finalNewline} onChange={setFinalNewline} label={t('toolsWeb.yaml.final_newline')} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title={t('toolsWeb.yaml.input')}
          icon={FileCog}
          className="h-[44vh] min-h-[260px] lg:h-[58vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={Wand2} onClick={() => setInput(SAMPLE)}>{t('toolsWeb.common.sample')}</Btn>
              <Btn icon={Eraser} disabled={!input} onClick={() => setInput('')} title={t('uiTools.common.clear')} />
            </>
          )}
          footer={t('toolsWeb.common.lines', { count: input ? input.split('\n').length : 0 })}
        >
          <CodeEditor value={input} onChange={setInput} language="yaml" placeholder={t('toolsWeb.yaml.placeholder')} errorLine={firstIssueLine} jumpTo={jump} className="min-h-0 flex-1" />
        </Pane>
        <Pane
          title={t('toolsWeb.yaml.output')}
          icon={CheckCircle2}
          className="h-[44vh] min-h-[260px] lg:h-[58vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={ArrowLeftRight} title={t('toolsWeb.yaml.use_as_input')} disabled={!output} onClick={() => setInput(output)} />
              <CopyBtn getText={() => output} onCopied={recordRun} disabled={!output} />
              <Btn icon={Download} title={t('uiTools.common.download')} disabled={!output} onClick={() => { downloadText(output, 'data.yaml', 'application/yaml'); recordRun(); }} />
            </>
          )}
          footer={t('toolsWeb.common.lines', { count: output ? output.split('\n').length : 0 })}
        >
          <CodeEditor value={output} readOnly language="yaml" className="min-h-0 flex-1" />
        </Pane>
      </div>

      {result && (
        <div className="grid gap-3 lg:grid-cols-[14rem_1fr]">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <Metric label={t('toolsWeb.yaml.stat_changed')} value={result.changedLines} tone="text-cyan-600 dark:text-cyan-300" />
            <Metric label={t('toolsWeb.yaml.stat_issues')} value={issues.length} tone={issues.length ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} />
          </div>
          <Pane title={t('toolsWeb.yaml.lint')} icon={AlertTriangle} bodyClassName="p-3">
            {!issues.length ? (
              <Notice tone="ok" icon={CheckCircle2}>{t('toolsWeb.yaml.no_issues')}</Notice>
            ) : (
              <ul className="space-y-1.5">
                {issues.map((issue, index) => (
                  <li key={`${issue.code}:${issue.line}:${index}`}>
                    <button type="button" onClick={() => setJump({ offset: lineOffset(input, issue.line), seq: (jump?.seq ?? 0) + 1 })} className="flex w-full cursor-pointer items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-left text-xs text-amber-900 hover:border-amber-500 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <span className="shrink-0 font-mono font-bold">{t('toolsWeb.yaml.line', { line: issue.line })}</span>
                      <span className="min-w-0 break-words">{t(`toolsWeb.yaml.issues.${issue.code}`, { key: issue.key ?? '' })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Pane>
        </div>
      )}
    </WebPage>
  );
};

export default YamlFormatterWorkbench;
