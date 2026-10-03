/** SQL formatter: live clause-aware pretty printer and minifier in the browser. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Database, Download, Eraser, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CodeEditor, CopyBtn, Metric, Pane, Seg, WebPage, downloadText, formatBytes, lastInput, pickOption, pickString, useDebounced, useToolRecord, utf8Length } from './kit/webKit';
import { countStatements, formatSql, minifySql, type SqlKeywordCase } from './logic/sql';

type Mode = 'format' | 'minify';
type Indent = 2 | 4 | 'tab';

const INDENTS: readonly Indent[] = [2, 4, 'tab'];
const CASES: readonly SqlKeywordCase[] = ['upper', 'lower', 'preserve'];
const DEBOUNCE_MS = 150;
const SAMPLE = "select u.id, u.name, count(o.id) as orders, sum(o.total) total from users u left join orders o on o.user_id = u.id and o.status = 'paid' where u.active = 1 and (u.role = 'admin' or u.role in ('editor','owner')) group by u.id, u.name having count(o.id) > 2 order by orders desc limit 20;";

const SqlFormatterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [input, setInput] = useState(pickString(prefill, 'sql', ''));
  const [mode, setMode] = useState<Mode>(pickOption<Mode>(prefill, 'mode', ['format', 'minify'], 'format'));
  const [indent, setIndent] = useState<Indent>(pickOption<Indent>(prefill, 'indent', INDENTS, 2));
  const [keywordCase, setKeywordCase] = useState<SqlKeywordCase>(pickOption<SqlKeywordCase>(prefill, 'keywordCase', CASES, 'upper'));
  const source = useDebounced(input, DEBOUNCE_MS);

  const output = useMemo(() => {
    if (!source.trim()) return '';
    return mode === 'minify' ? minifySql(source) : formatSql(source, { indent, keywordCase });
  }, [source, mode, indent, keywordCase]);
  const statements = useMemo(() => countStatements(source), [source]);
  const recordRun = () => record({ sql: input, mode, indent, keywordCase }, { length: output.length });

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Seg value={mode} onChange={setMode} ariaLabel={t('toolsWeb.sql.mode')} options={[
          { value: 'format', label: t('toolsWeb.sql.mode_format') },
          { value: 'minify', label: t('toolsWeb.sql.mode_minify') },
        ]} />
        {mode === 'format' && (
          <>
            <Seg value={indent} onChange={setIndent} ariaLabel={t('toolsWeb.sql.indent')} options={INDENTS.map((value) => ({ value, label: value === 'tab' ? t('toolsWeb.sql.indent_tab') : String(value) }))} />
            <Seg value={keywordCase} onChange={setKeywordCase} ariaLabel={t('toolsWeb.sql.keyword_case')} options={CASES.map((value) => ({ value, label: t(`toolsWeb.sql.case_${value}`) }))} />
          </>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title={t('toolsWeb.sql.input')}
          icon={Database}
          className="h-[44vh] min-h-[260px] lg:h-[62vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={Wand2} onClick={() => setInput(SAMPLE)}>{t('toolsWeb.common.sample')}</Btn>
              <Btn icon={Eraser} disabled={!input} onClick={() => setInput('')} title={t('uiTools.common.clear')} />
            </>
          )}
          footer={formatBytes(utf8Length(input))}
        >
          <CodeEditor value={input} onChange={setInput} language="sql" placeholder={t('toolsWeb.sql.placeholder')} className="min-h-0 flex-1" />
        </Pane>
        <Pane
          title={t('toolsWeb.sql.output')}
          icon={Database}
          className="h-[44vh] min-h-[260px] lg:h-[62vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={ArrowLeftRight} title={t('toolsWeb.sql.use_as_input')} disabled={!output} onClick={() => setInput(output)} />
              <CopyBtn getText={() => output} onCopied={recordRun} disabled={!output} />
              <Btn icon={Download} title={t('uiTools.common.download')} disabled={!output} onClick={() => { downloadText(output, 'query.sql', 'application/sql'); recordRun(); }} />
            </>
          )}
          footer={`${formatBytes(utf8Length(output))} · ${t('toolsWeb.common.lines', { count: output ? output.split('\n').length : 0 })}`}
        >
          <CodeEditor value={output} readOnly language="sql" className="min-h-0 flex-1" />
        </Pane>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label={t('toolsWeb.sql.stat_statements')} value={statements} tone="text-cyan-600 dark:text-cyan-300" />
        <Metric label={t('toolsWeb.sql.stat_lines')} value={output ? output.split('\n').length : 0} />
        <Metric label={t('toolsWeb.sql.stat_before')} value={formatBytes(utf8Length(source))} />
        <Metric label={t('toolsWeb.sql.stat_after')} value={formatBytes(utf8Length(output))} />
      </div>
    </WebPage>
  );
};

export default SqlFormatterWorkbench;
