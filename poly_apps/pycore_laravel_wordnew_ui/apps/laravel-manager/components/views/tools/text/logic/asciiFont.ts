/** ASCII art engine: 3x5 pixel font rendered with selectable fill characters, scale, spacing, shadow and frame. */
const GLYPH_ROWS = 5;
const GLYPH_COLS = 3;

const raw = (rows: string): string[] => rows.split(' ');

const GLYPHS: Record<string, string[]> = {
  A: raw('.#. #.# ### #.# #.#'), B: raw('##. #.# ##. #.# ##.'), C: raw('.## #.. #.. #.. .##'), D: raw('##. #.# #.# #.# ##.'),
  E: raw('### #.. ##. #.. ###'), F: raw('### #.. ##. #.. #..'), G: raw('.## #.. #.# #.# .##'), H: raw('#.# #.# ### #.# #.#'),
  I: raw('### .#. .#. .#. ###'), J: raw('..# ..# ..# #.# .#.'), K: raw('#.# #.# ##. #.# #.#'), L: raw('#.. #.. #.. #.. ###'),
  M: raw('#.# ### ### #.# #.#'), N: raw('##. #.# #.# #.# #.#'), O: raw('.#. #.# #.# #.# .#.'), P: raw('##. #.# ##. #.. #..'),
  Q: raw('.#. #.# #.# ##. .##'), R: raw('##. #.# ##. #.# #.#'), S: raw('.## #.. .#. ..# ##.'), T: raw('### .#. .#. .#. .#.'),
  U: raw('#.# #.# #.# #.# ###'), V: raw('#.# #.# #.# #.# .#.'), W: raw('#.# #.# ### ### #.#'), X: raw('#.# #.# .#. #.# #.#'),
  Y: raw('#.# #.# .#. .#. .#.'), Z: raw('### ..# .#. #.. ###'),
  0: raw('### #.# #.# #.# ###'), 1: raw('.#. ##. .#. .#. ###'), 2: raw('##. ..# .#. #.. ###'), 3: raw('##. ..# .#. ..# ##.'),
  4: raw('#.# #.# ### ..# ..#'), 5: raw('### #.. ##. ..# ##.'), 6: raw('.## #.. ### #.# ###'), 7: raw('### ..# .#. .#. .#.'),
  8: raw('### #.# ### #.# ###'), 9: raw('### #.# ### ..# ##.'),
  ' ': raw('... ... ... ... ...'), '!': raw('.#. .#. .#. ... .#.'), '?': raw('##. ..# .#. ... .#.'), '.': raw('... ... ... ... .#.'),
  ',': raw('... ... ... .#. #..'), '-': raw('... ... ### ... ...'), _: raw('... ... ... ... ###'), ':': raw('... .#. ... .#. ...'),
  "'": raw('.#. .#. ... ... ...'), '"': raw('#.# #.# ... ... ...'), '+': raw('... .#. ### .#. ...'), '=': raw('... ### ... ### ...'),
  '/': raw('..# ..# .#. #.. #..'), '*': raw('... #.# .#. #.# ...'), '#': raw('#.# ### #.# ### #.#'), '@': raw('### #.# ##. #.. ###'),
  '(': raw('.#. #.. #.. #.. .#.'), ')': raw('.#. ..# ..# ..# .#.'),
};

export const FILL_PRESETS = ['█', '#', '@', '*', '▓', '■', '●', '$'] as const;
export const FRAME_STYLES = ['none', 'single', 'double', 'hash'] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

export interface AsciiOptions {
  fill: string;
  scale: number;
  spacing: number;
  shadow: boolean;
  frame: FrameStyle;
  wide: boolean;
}

export interface AsciiResult {
  art: string;
  unsupported: string[];
  width: number;
  height: number;
}

const FRAME_CHARS: Record<Exclude<FrameStyle, 'none'>, string[]> = {
  single: ['┌', '┐', '└', '┘', '─', '│'],
  double: ['╔', '╗', '╚', '╝', '═', '║'],
  hash: ['#', '#', '#', '#', '#', '#'],
};

const glyphFor = (char: string): { rows: string[]; supported: boolean } => {
  const key = char.toUpperCase();
  const rows = GLYPHS[key];
  return rows ? { rows, supported: true } : { rows: GLYPHS['?'], supported: false };
};

const renderLine = (line: string, options: AsciiOptions, unsupported: Set<string>): string[] => {
  const chars = Array.from(line);
  const gridRows = GLYPH_ROWS * options.scale;
  const pixels: boolean[][] = Array.from({ length: gridRows }, () => []);
  chars.forEach((char, index) => {
    const { rows, supported } = glyphFor(char);
    if (!supported && char.trim()) unsupported.add(char);
    for (let row = 0; row < GLYPH_ROWS; row += 1) {
      for (let col = 0; col < GLYPH_COLS; col += 1) {
        for (let dx = 0; dx < options.scale; dx += 1) {
          for (let dy = 0; dy < options.scale; dy += 1) pixels[row * options.scale + dy].push(rows[row][col] === '#');
        }
      }
      if (index < chars.length - 1) for (let gap = 0; gap < options.spacing * options.scale; gap += 1) for (let dy = 0; dy < options.scale; dy += 1) pixels[row * options.scale + dy].push(false);
    }
  });
  const cell = (on: boolean, shadowed: boolean): string => {
    const glyph = on ? options.fill : shadowed ? '░' : ' ';
    return options.wide ? glyph.repeat(2) : glyph;
  };
  return pixels.map((row, y) => row.map((on, x) => {
    const shadowed = options.shadow && !on && (pixels[y - 1]?.[x - 1] ?? false);
    return cell(on, shadowed);
  }).join('').replace(/\s+$/, ''));
};

const applyFrame = (lines: string[], style: FrameStyle): string[] => {
  if (style === 'none') return lines;
  const [tl, tr, bl, br, horizontal, vertical] = FRAME_CHARS[style];
  const width = Math.max(...lines.map((line) => Array.from(line).length), 0);
  const body = lines.map((line) => `${vertical} ${line}${' '.repeat(width - Array.from(line).length)} ${vertical}`);
  return [`${tl}${horizontal.repeat(width + 2)}${tr}`, ...body, `${bl}${horizontal.repeat(width + 2)}${br}`];
};

export const renderAscii = (text: string, options: AsciiOptions): AsciiResult => {
  const unsupported = new Set<string>();
  const blocks = text.replace(/^\n+|\n+$/g, '').split('\n').map((line) => (line ? renderLine(line, options, unsupported) : ['']));
  const lines = blocks.flatMap((block, index) => (index < blocks.length - 1 ? [...block, ''] : block));
  const framed = applyFrame(lines, options.frame);
  return {
    art: framed.join('\n'),
    unsupported: Array.from(unsupported),
    width: Math.max(...framed.map((line) => Array.from(line).length), 0),
    height: framed.length,
  };
};
