// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import _ from 'lodash';

export { computeAverage, computeVariance, arrayToMarkdownTable };

function computeAverage({ data }: { data: number[] }) {
  if (data.length === 0) {
    return 0;
  }

  return _.sum(data) / data.length;
}

function computeVariance({ data }: { data: number[] }) {
  const mean = computeAverage({ data });

  const squaredDiffs = data.map(value => (value - mean) ** 2);

  return computeAverage({ data: squaredDiffs });
}

function arrayToMarkdownTable({ data, headerMap = {} }: { data: Record<string, unknown>[]; headerMap?: Record<string, string> }) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(obj => Object.values(obj));

  const headerRow = `| ${headers.map(header => headerMap[header] ?? header).join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(row => `| ${row.join(' | ')} |`).join('\n');

  return `${headerRow}\n${separatorRow}\n${dataRows}`;
}
