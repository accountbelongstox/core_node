/** Structured data hub: every format parses to a JSON value and stringifies from it, so any pair converts. */
import { ConvertError } from './convertCodecs';
import { parseToml, stringifyToml } from './structuredToml';
import { parseXml, stringifyXml } from './structuredXml';
import { parseYaml, stringifyYaml, type JsonValue } from './structuredYaml';

export type { JsonValue } from './structuredYaml';
export type DataFormat = 'json' | 'yaml' | 'toml' | 'xml';
export type IndentChoice = '2' | '4' | 'tab';

export interface StructuredOptions {
  indent: IndentChoice;
  typedXml: boolean;
}

export interface StructuredResult {
  text: string;
  nullsOmitted: boolean;
}

export const DATA_FORMATS: DataFormat[] = ['json', 'yaml', 'toml', 'xml'];
export const INDENT_CHOICES: IndentChoice[] = ['2', '4', 'tab'];
export const DEFAULT_STRUCTURED_OPTIONS: StructuredOptions = { indent: '2', typedXml: true };
export const VARIANT_PRESETS: Record<string, { from: DataFormat; to: DataFormat }> = {
  jsonToYaml: { from: 'json', to: 'yaml' },
  yamlToJson: { from: 'yaml', to: 'json' },
  jsonToToml: { from: 'json', to: 'toml' },
  tomlToJson: { from: 'toml', to: 'json' },
  tomlToYaml: { from: 'toml', to: 'yaml' },
  yamlToToml: { from: 'yaml', to: 'toml' },
  jsonToXml: { from: 'json', to: 'xml' },
  xmlToJson: { from: 'xml', to: 'json' },
};
export const SAMPLE_VALUE: JsonValue = {
  project: {
    name: 'core_node',
    version: '1.2.0',
    tags: ['api', 'tools'],
    server: { host: 'localhost', port: 8080, tls: false },
    owners: [{ name: 'Ada', admin: true }, { name: 'Lin', admin: false }],
  },
};

const indentUnit = (indent: IndentChoice): string => (indent === 'tab' ? '\t' : ' '.repeat(Number(indent)));

export const parseData = (format: DataFormat, text: string, options: StructuredOptions): JsonValue => {
  if (format === 'json') {
    try {
      return JSON.parse(text) as JsonValue;
    } catch (error) {
      throw new ConvertError('json_invalid', error instanceof Error ? error.message : '');
    }
  }
  if (format === 'yaml') return parseYaml(text);
  if (format === 'toml') return parseToml(text);
  return parseXml(text, options.typedXml);
};

export const stringifyData = (format: DataFormat, value: JsonValue, options: StructuredOptions): StructuredResult => {
  if (format === 'json') return { text: JSON.stringify(value, null, options.indent === 'tab' ? '\t' : Number(options.indent)), nullsOmitted: false };
  if (format === 'yaml') return { text: stringifyYaml(value, options.indent === 'tab' ? 2 : Number(options.indent)), nullsOmitted: false };
  if (format === 'toml') return stringifyToml(value);
  return { text: stringifyXml(value, indentUnit(options.indent)), nullsOmitted: false };
};

export const convertData = (from: DataFormat, to: DataFormat, text: string, options: StructuredOptions): StructuredResult => {
  if (!text.trim()) return { text: '', nullsOmitted: false };
  return stringifyData(to, parseData(from, text, options), options);
};
