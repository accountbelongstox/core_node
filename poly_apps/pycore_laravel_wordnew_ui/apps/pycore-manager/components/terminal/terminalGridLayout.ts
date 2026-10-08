const TILE_MIN_WIDTH_PX = 220;
const MIN_BASE_COLUMNS = 2;
const MAX_BASE_COLUMNS = 4;
const MAX_EXTRA_COLUMNS = 2;

export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridRow<T> {
  columns: number;
  items: T[];
}

/** Columns of an ordinary row: as many minimum-width tiles as the width holds, within the base range. */
export function baseGridColumns(width: number): number {
  return Math.min(MAX_BASE_COLUMNS, Math.max(MIN_BASE_COLUMNS, Math.floor(width / TILE_MIN_WIDTH_PX)));
}

/** Terminals that share a screen band, left to right; bands run top to bottom. */
function spatialBands<T extends { rect: GridRect }>(items: T[]): T[][] {
  const sorted = [...items].sort((left, right) => (
    left.rect.y - right.rect.y || left.rect.x - right.rect.x
  ));
  const bands: Array<{ top: number; bottom: number; items: T[] }> = [];
  for (const item of sorted) {
    const centerY = item.rect.y + item.rect.height / 2;
    const band = bands.find((candidate) => centerY >= candidate.top && centerY <= candidate.bottom);
    if (band) {
      band.items.push(item);
      band.top = Math.min(band.top, item.rect.y);
      band.bottom = Math.max(band.bottom, item.rect.y + item.rect.height);
    } else {
      bands.push({ top: item.rect.y, bottom: item.rect.y + item.rect.height, items: [item] });
    }
  }
  return bands.map((band) => band.items.sort((left, right) => left.rect.x - right.rect.x));
}

function splitEvenly<T>(items: T[], rowCount: number): T[][] {
  const rows: T[][] = [];
  const size = Math.floor(items.length / rowCount);
  const remainder = items.length % rowCount;
  let offset = 0;
  for (let index = 0; index < rowCount; index += 1) {
    const count = size + (index < remainder ? 1 : 0);
    rows.push(items.slice(offset, offset + count));
    offset += count;
  }
  return rows;
}

/**
 * Grid rows that keep the terminals' on-screen order without overlap. Screen bands that fit the base
 * column count share rows with their neighbours; a crowded band (up to two more than the base) gets
 * extra, narrower columns; a longer band is split evenly over several rows.
 */
export function layoutTerminalRows<T extends { rect: GridRect }>(items: T[], baseColumns: number): GridRow<T>[] {
  const rows: GridRow<T>[] = [];
  let pending: T[] = [];
  const flush = () => {
    if (pending.length) rows.push({ columns: baseColumns, items: pending });
    pending = [];
  };
  for (const band of spatialBands(items)) {
    if (band.length > baseColumns) {
      flush();
      const rowCount = Math.ceil(band.length / (baseColumns + MAX_EXTRA_COLUMNS));
      for (const chunk of splitEvenly(band, rowCount)) {
        rows.push({ columns: Math.max(baseColumns, chunk.length), items: chunk });
      }
    } else if (pending.length + band.length <= baseColumns) {
      pending = [...pending, ...band];
    } else {
      flush();
      pending = band;
    }
  }
  flush();
  return rows;
}
