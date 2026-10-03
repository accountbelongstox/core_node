/** JSON <-> CSV conversion (RFC 4180 quoting, dotted flattening, type detection). */
import { ConvertError } from './convertCodecs';
import type { JsonValue } from './structuredYaml';

export type CsvDelimiter = ',' | ';' | '\t' | '|';

export interface CsvTable {
  headers: string[] | null;
  rows: string[][];
}

export const CSV_DELIMITERS: CsvDelimiter[] = [',', ';', '\t', '|'];

const NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const BOM = '\ufeff';

const isObject = (value: JsonValue): value is { [key: string]: JsonValue } => typeof value === 'object' && value !== null && !Array.isArray(value);

const cellText = (value: JsonValue | undefined): string => {
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const flattenInto = (value: { [key: string]: JsonValue }, prefix: string, out: Record<string, JsonValue>): void => {
  Object.entries(value).forEach(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(item) && Object.keys(item).length > 0) flattenInto(item, path, out);
    else out[path] = item;
  });
};

export const jsonToTable = (value: JsonValue, flatten: boolean): CsvTable => {
  const list: JsonValue[] = Array.isArray(value) ? value : [value];
  if (list.length === 0) return { headers: [], rows: [] };
  if (list.every((item) => Array.isArray(item))) return { headers: null, rows: list.map((item) => (item as JsonValue[]).map(cellText)) };
  if (list.every((item) => !isObject(item) && !Array.isArray(item))) {
    if (!Array.isArray(value)) throw new ConvertError('csv_shape');
    return { headers: ['value'], rows: list.map((item) => [cellText(item)]) };
  }
  if (!list.every(isObject)) throw new ConvertError('csv_shape');
  const records = list.map((item) => {
    if (!flatten) return item as { [key: string]: JsonValue };
    const flat: Record<string, JsonValue> = {};
    flattenInto(item as { [key: string]: JsonValue }, '', flat);
    return flat;
  });
  const headers: string[] = [];
  const seen = new Set<string>();
  records.forEach((record) => Object.keys(record).forEach((key) => {
    if (!seen.has(key)) {
      seen.add(key);
      headers.push(key);
    }
  }));
  return { headers, rows: records.map((record) => headers.map((key) => cellText(record[key]))) };
};

const quoteCell = (cell: string, delimiter: string): string => (cell.includes(delimiter) || /["\r\n]/.test(cell) || /^\s|\s$/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);

export const tableToCsv = (table: CsvTable, delimiter: CsvDelimiter, includeHeaders: boolean): string => {
  const lines: string[] = [];
  if (includeHeaders && table.headers) lines.push(table.headers.map((cell) => quoteCell(cell, delimiter)).join(delimiter));
  table.rows.forEach((row) => lines.push(row.map((cell) => quoteCell(cell, delimiter)).join(delimiter)));
  return lines.join('\n');
};

export const parseCsv = (input: string, delimiter: CsvDelimiter): string[][] => {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let touched = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
      touched = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
      touched = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      if (touched || cell !== '') {
        row.push(cell);
        rows.push(row);
      }
      row = [];
      cell = '';
      touched = false;
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new ConvertError('csv_unterminated_quote');
  if (touched || cell !== '') {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

export const detectDelimiter = (text: string): CsvDelimiter => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = CSV_DELIMITERS.map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }));
  return counts.reduce((best, item) => (item.count > best.count ? item : best), counts[0]).delimiter;
};

const typedCell = (cell: string): JsonValue => {
  if (cell === '') return null;
  if (cell === 'true') return true;
  if (cell === 'false') return false;
  if (NUMERIC.test(cell) && String(Number(cell)) === cell) return Number(cell);
  return cell;
};

export const csvRowsToJson = (rows: string[][], firstRowHeaders: boolean, typed: boolean): JsonValue => {
  const convert = (cell: string): JsonValue => (typed ? typedCell(cell) : cell);
  if (!firstRowHeaders) return rows.map((row) => row.map(convert));
  if (rows.length === 0) return [];
  const used = new Map<string, number>();
  const headers = rows[0].map((raw, index) => {
    const base = raw.trim() || `column${index + 1}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
  return rows.slice(1).map((row) => {
    const record: { [key: string]: JsonValue } = {};
    headers.forEach((header, index) => {
      record[header] = convert(row[index] ?? '');
    });
    return record;
  });
};

export const tableFromRows = (rows: string[][], firstRowHeaders: boolean): CsvTable => (firstRowHeaders && rows.length > 0 ? { headers: rows[0], rows: rows.slice(1) } : { headers: null, rows });
