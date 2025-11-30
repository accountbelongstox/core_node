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

export { lighten, darken, setOpacity };

const clampHex = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function lighten(color: string, amount: number): string {
  const alpha = color.length === 9 ? color.slice(7) : '';
  const num = Number.parseInt(color.slice(1, 7), 16);

  const r = clampHex(((num >> 16) & 255) + amount);
  const g = clampHex(((num >> 8) & 255) + amount);
  const b = clampHex((num & 255) + amount);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}${alpha}`;
}

function darken(color: string, amount: number): string {
  return lighten(color, -amount);
}

function setOpacity(color: string, opacity: number): string {
  const alpha = clampHex(Math.round(opacity * 255))
    .toString(16)
    .padStart(2, '0');

  if (color.length === 7) {
    return `${color}${alpha}`;
  }

  if (color.length === 9) {
    return `${color.slice(0, 7)}${alpha}`;
  }
  throw new Error('Invalid hex color');
}
