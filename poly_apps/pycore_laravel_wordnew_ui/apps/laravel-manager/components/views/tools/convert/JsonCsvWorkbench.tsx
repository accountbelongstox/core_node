/** JSON <-> CSV: live dual-pane with delimiter chips, table preview and file download. */
import React, { useMemo, useRef, useState } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import {
  CSV_DELIMITERS, csvRowsToJson, detectDelimiter, jsonToTable, parseCsv, tableFromRows, tableToCsv, type CsvDelimiter, type CsvTable,
} from './convertCsv';
import { ConvertError } from './convertCodecs';
import type { JsonValue } from './structuredYaml';
import {
  ConvertPage, DualPane, errorMessage, ICON_BUTTON_CLASS, LABEL_CLASS, Notice, Panel, PRIMARY_BUTTON_CLASS, prefillOf, SkyChips, StatChip, SwapButton, TextPane,
  ToggleField, Toolbar, ToolbarGroup, useConvertT, useDebouncedRecord, useRecorder,
} from './convertKit';

type Direction = 'toCsv' | 'toJson';

interface CsvInput {
  direction: Direction;
  text: string;
  delimiter: CsvDelimiter;
  headers: boolean;
  flatten: boolean;
  typed: boolean;
}

interface Outcome {
  output: string;
  table: CsvTable | null;
  error: unknown;
}

const PREVIEW_ROWS = 100;
const BOM = '\ufeff';
const DELIMITER_KEYS: Record<CsvDelimiter, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

const compute = (input: CsvInput): Outcome => {
  if (!input.text.trim()) return { output: '', table: null, error: null };
  try {
    if (input.direction === 'toCsv') {
      let value: JsonValue;
      try {
        value = JSON.parse(input.text) as JsonValue;
      } catch (error) {
        throw new ConvertError('json_invalid', error instanceof Error ? error.message : '');
      }
      const table = jsonToTable(value, input.flatten);
      return { output: tableToCsv(table, input.delimiter, input.headers), table, error: null };
    }
    const rows = parseCsv(input.text, input.delimiter);
    return { output: JSON.stringify(csvRowsToJson(rows, input.headers, input.typed), null, 2), table: tableFromRows(rows, input.headers), error: null };
  } catch (error) {
    return { output: '', table: null, error };
  }
};

const JsonCsvWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<CsvInput>(lastRun);
  const [direction, setDirection] = useState<Direction>(prefill.direction ?? 'toCsv');
  const [text, setText] = useState(prefill.text ?? '');
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(prefill.delimiter ?? ',');
  const [headers, setHeaders] = useState(prefill.headers ?? true);
  const [flatten, setFlatten] = useState(prefill.flatten ?? true);
  const [typed, setTyped] = useState(prefill.typed ?? true);
  const [bom, setBom] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const record = useRecorder(tool.id, variant);

  const snapshot: CsvInput = { direction, text, delimiter, headers, flatten, typed };
  const { output, table, error } = useMemo(() => compute(snapshot), [direction, text, delimiter, headers, flatten, typed]);
  useDebouncedRecord(tool.id, variant, snapshot, output, Boolean(text.trim() && output && !error));

  const onText = (next: string): void => {
    if (direction === 'toJson' && text === '' && next) setDelimiter(detectDelimiter(next));
    setText(next);
  };

  const swap = (): void => {
    const nextDirection: Direction = direction === 'toCsv' ? 'toJson' : 'toCsv';
    if (output && !error) setText(output);
    setDirection(nextDirection);
  };

  const download = (): void => {
    const csv = direction === 'toCsv';
    downloadAsFile(csv ? (bom ? BOM + output : output) : output, csv ? 'data.csv' : 'data.json', csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    record(snapshot, output);
  };

  const openFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const content = await file.text();
    if (/\.(csv|tsv)$/i.test(file.name)) {
      setDirection('toJson');
      setDelimiter(detectDelimiter(content));
    } else if (/\.json$/i.test(file.name)) setDirection('toCsv');
    setText(content);
  };

  const toCsv = direction === 'toCsv';
  const shownRows = table ? table.rows.slice(0, PREVIEW_ROWS) : [];
  const columnCount = table ? Math.max(table.headers?.length ?? 0, ...table.rows.map((row) => row.length), 0) : 0;

  return (
    <ConvertPage wide>
      <Toolbar>
        <SkyChips value={direction} onChange={setDirection} label={tc('common.mode')} options={[{ value: 'toCsv', label: tc('csv.json_to_csv') }, { value: 'toJson', label: tc('csv.csv_to_json') }]} />
        <ToolbarGroup label={tc('csv.delimiter')}>
          <SkyChips value={delimiter} onChange={setDelimiter} options={CSV_DELIMITERS.map((id) => ({ value: id, label: tc(`csv.delimiter_${DELIMITER_KEYS[id]}`) }))} />
        </ToolbarGroup>
        <ToggleField label={tc('csv.headers')} on={headers} onChange={setHeaders} />
        {toCsv ? <ToggleField label={tc('csv.flatten')} on={flatten} onChange={setFlatten} /> : <ToggleField label={tc('csv.typed')} on={typed} onChange={setTyped} />}
      </Toolbar>
      <DualPane
        left={(
          <TextPane
            label={toCsv ? 'JSON' : 'CSV'}
            value={text}
            onChange={onText}
            placeholder={toCsv ? tc('csv.placeholder_json') : tc('csv.placeholder_csv')}
            rows={12}
            wrap={false}
            invalid={Boolean(error)}
            actions={(
              <>
                <button type="button" className={ICON_BUTTON_CLASS} onClick={() => fileInput.current?.click()} title={tc('csv.open_file')}><FolderOpen className="h-3.5 w-3.5" />{tc('csv.open_file')}</button>
                <input ref={fileInput} type="file" accept=".json,.csv,.tsv,.txt,text/*" className="hidden" onChange={(event) => { void openFile(event.target.files?.[0]); event.target.value = ''; }} />
              </>
            )}
          />
        )}
        center={<SwapButton onClick={swap} title={tc('common.swap')} />}
        right={(
          <TextPane
            label={toCsv ? 'CSV' : 'JSON'}
            value={output}
            rows={12}
            wrap={false}
            onCopied={() => record(snapshot, output)}
            actions={(
              <button type="button" className={ICON_BUTTON_CLASS} disabled={!output} onClick={download} title={tc('common.download')}><Download className="h-3.5 w-3.5" />{tc('common.download')}</button>
            )}
          />
        )}
      />
      {error ? <Notice>{errorMessage(tc, error)}</Notice> : null}
      {toCsv && (
        <div className="flex items-center justify-end gap-2">
          <ToggleField label={tc('csv.bom')} on={bom} onChange={setBom} />
        </div>
      )}
      {table && columnCount > 0 && (
        <Panel className="space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={LABEL_CLASS}>{tc('csv.preview')}</span>
            <div className="flex items-center gap-1.5">
              <StatChip>{tc('csv.size', { rows: table.rows.length, columns: columnCount })}</StatChip>
              {table.rows.length > PREVIEW_ROWS && <StatChip>{tc('csv.preview_limit', { count: PREVIEW_ROWS })}</StatChip>}
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!output} onClick={download}><Download className="h-3.5 w-3.5" />{toCsv ? '.csv' : '.json'}</button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700/60">
            <table className="w-full min-w-max text-left text-xs">
              {table.headers && (
                <thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-1.5 text-right font-normal text-slate-400">#</th>
                    {Array.from({ length: columnCount }, (_v, index) => <th key={index} className="whitespace-nowrap px-3 py-1.5 font-semibold">{table.headers?.[index] ?? ''}</th>)}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-700/50">
                {shownRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="text-slate-800 dark:text-slate-100">
                    <td className="px-2 py-1 text-right text-slate-400">{rowIndex + 1}</td>
                    {Array.from({ length: columnCount }, (_v, index) => <td key={index} className="max-w-[18rem] truncate px-3 py-1" title={row[index] ?? ''}>{row[index] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </ConvertPage>
  );
};

export default JsonCsvWorkbench;
