/** `value` limited to the inclusive range min..max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whole-number share of `part` in `whole`, limited to 0..100 (0 when `whole` is not positive). */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? clamp(Math.round((part / whole) * 100), 0, 100) : 0;
}
