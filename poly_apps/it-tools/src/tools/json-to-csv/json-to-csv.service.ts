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

export { getHeaders, convertArrayToCsv };

function getHeaders({ array }: { array: Record<string, unknown>[] }): string[] {
  const headers = new Set<string>();

  array.forEach(item => Object.keys(item).forEach(key => headers.add(key)));

  return Array.from(headers);
}

function serializeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return '';
  }

  const valueAsString = String(value).replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/"/g, '\\"');

  if (valueAsString.includes(',')) {
    return `"${valueAsString}"`;
  }

  return valueAsString;
}

function convertArrayToCsv({ array }: { array: Record<string, unknown>[] }): string {
  const headers = getHeaders({ array });

  const rows = array.map(item => headers.map(header => serializeValue(item[header])));

  return [headers.join(','), ...rows].join('\n');
}
