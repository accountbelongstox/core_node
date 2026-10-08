/**
 * OrchClipTable - the resolve state of every resource of a plan, one byte per
 * resource. The plan's resource array is the mapping (index = position in
 * `plan.resources`, `indexOf` maps a key back): no text and no per-item objects
 * are kept or copied, so tens of thousands of clips cost tens of KB and a
 * snapshot is the bytes as base64.
 *
 * Byte layout (2 bits each):
 *   bits 0-1  state       queued | loading | done | missing
 *   bits 2-3  origin      - | device | pycore | laravel
 *   bits 4-5  via         - | pycore | relay | laravel    (channel it came over)
 *   bits 6-7  generating  - | pycore | relay | laravel    (channel asked to generate it)
 * Byte progress of the few items on the wire lives in `loading` (index -> [loaded, total]).
 * `version` changes on every write (views re-read on a new version; nothing is copied).
 */
import type { OrchChannelId, OrchClipOrigin, OrchResolveCounts } from './orchTypes';

export type OrchClipState = 'queued' | 'loading' | 'done' | 'missing';

const STATES: readonly OrchClipState[] = ['queued', 'loading', 'done', 'missing'];
const ORIGINS: readonly (OrchClipOrigin | null)[] = [null, 'device', 'pycore', 'laravel'];
const CHANNELS: readonly (OrchChannelId | null)[] = [null, 'pycore', 'relay', 'laravel'];

const STATE_MASK = 0b11;
const ORIGIN_SHIFT = 2;
const VIA_SHIFT = 4;
const GENERATING_SHIFT = 6;

export interface OrchClipEntry {
  state: OrchClipState;
  origin: OrchClipOrigin | null;
  via: OrchChannelId | null;
  generating: OrchChannelId | null;
}

/** Counts per channel the views show (all derived from the bytes). */
export interface OrchClipTableCounts extends OrchResolveCounts {
  /** Delivered over the relay (part of `pycore`). */
  relay: number;
  generatingBy: Record<OrchChannelId, number>;
}

/** States and the generating channel of one group of clips (see `OrchClipTable.tally`). */
export interface OrchClipTableTally {
  total: number;
  queued: number;
  loading: number;
  done: number;
  missing: number;
  /** Missing clips a channel was asked to generate. */
  generating: Record<OrchChannelId, number>;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export class OrchClipTable {
  readonly bytes: Uint8Array;
  readonly indexOf: ReadonlyMap<string, number>;
  readonly loading = new Map<number, [number, number]>();
  version = 0;

  /** `keys`: the plan's resource keys in plan order. */
  constructor(readonly keys: readonly string[], bytes?: Uint8Array) {
    this.bytes = bytes && bytes.length === keys.length ? bytes : new Uint8Array(keys.length);
    this.indexOf = new Map(keys.map((key, index) => [key, index]));
  }

  /** A table from a snapshot of the same plan (another size gives an empty table); in-flight items restart queued. */
  static fromSnapshot(keys: readonly string[], snapshot: string): OrchClipTable {
    const table = new OrchClipTable(keys, fromBase64(snapshot));
    table.bytes.forEach((byte, index) => {
      if ((byte & STATE_MASK) === STATES.indexOf('loading')) table.bytes[index] = byte & ~STATE_MASK;
    });
    return table;
  }

  get size(): number {
    return this.keys.length;
  }

  entry(index: number): OrchClipEntry {
    const byte = this.bytes[index] ?? 0;
    return {
      state: STATES[byte & STATE_MASK],
      origin: ORIGINS[(byte >> ORIGIN_SHIFT) & STATE_MASK],
      via: CHANNELS[(byte >> VIA_SHIFT) & STATE_MASK],
      generating: CHANNELS[(byte >> GENERATING_SHIFT) & STATE_MASK],
    };
  }

  state(index: number): OrchClipState {
    return STATES[(this.bytes[index] ?? 0) & STATE_MASK];
  }

  set(index: number, patch: Partial<OrchClipEntry>): void {
    if (index < 0 || index >= this.bytes.length) return;
    const current = this.entry(index);
    const next = { ...current, ...patch };
    this.bytes[index] = STATES.indexOf(next.state)
      | (ORIGINS.indexOf(next.origin) << ORIGIN_SHIFT)
      | (CHANNELS.indexOf(next.via) << VIA_SHIFT)
      | (CHANNELS.indexOf(next.generating) << GENERATING_SHIFT);
    if (next.state !== 'loading') this.loading.delete(index);
    this.version += 1;
  }

  /** Byte progress of an item on the wire. */
  progress(index: number, loaded: number, total: number): void {
    this.loading.set(index, [loaded, total]);
    this.version += 1;
  }

  counts(): OrchClipTableCounts {
    const counts: OrchClipTableCounts = {
      total: this.size, device: 0, pycore: 0, laravel: 0, missing: 0, generating: 0, pending: 0, relay: 0,
      generatingBy: { pycore: 0, relay: 0, laravel: 0 },
    };
    // Bit operations only: this runs on every publish over the whole plan.
    const done = STATES.indexOf('done');
    const missing = STATES.indexOf('missing');
    for (let index = 0; index < this.bytes.length; index += 1) {
      const byte = this.bytes[index];
      const state = byte & STATE_MASK;
      if (state === done) {
        const origin = ORIGINS[(byte >> ORIGIN_SHIFT) & STATE_MASK];
        if (origin) counts[origin] += 1;
        if (CHANNELS[(byte >> VIA_SHIFT) & STATE_MASK] === 'relay') counts.relay += 1;
      } else if (state === missing) {
        counts.missing += 1;
        const generating = CHANNELS[(byte >> GENERATING_SHIFT) & STATE_MASK];
        if (generating) {
          counts.generating += 1;
          counts.generatingBy[generating] += 1;
        }
      } else {
        counts.pending += 1;
      }
    }
    return counts;
  }

  /**
   * Counts per group (`groupOf` maps an index to 0..groups-1; the monitor groups by clip kind): states, and for
   * missing clips the channel asked to generate them. Bit operations only, no per-item objects.
   */
  tally(groupOf: (index: number) => number, groups: number): OrchClipTableTally[] {
    const tallies: OrchClipTableTally[] = Array.from({ length: groups }, () => ({
      total: 0, queued: 0, loading: 0, done: 0, missing: 0, generating: { pycore: 0, relay: 0, laravel: 0 },
    }));
    for (let index = 0; index < this.bytes.length; index += 1) {
      const tally = tallies[groupOf(index)];
      if (!tally) continue;
      const byte = this.bytes[index];
      const state = STATES[byte & STATE_MASK];
      tally.total += 1;
      tally[state] += 1;
      if (state === 'missing') {
        const generating = CHANNELS[(byte >> GENERATING_SHIFT) & STATE_MASK];
        if (generating) tally.generating[generating] += 1;
      }
    }
    return tallies;
  }

  /** Indices in `state`, plan order, at most `limit`. */
  indicesIn(state: OrchClipState, limit = Number.POSITIVE_INFINITY): number[] {
    const code = STATES.indexOf(state);
    const found: number[] = [];
    for (let index = 0; index < this.bytes.length && found.length < limit; index += 1) {
      if ((this.bytes[index] & STATE_MASK) === code) found.push(index);
    }
    return found;
  }

  /** Missing indices a channel was asked to generate. */
  generatingIndices(): number[] {
    const found: number[] = [];
    this.bytes.forEach((byte, index) => {
      if ((byte & STATE_MASK) === STATES.indexOf('missing') && (byte >> GENERATING_SHIFT) & STATE_MASK) found.push(index);
    });
    return found;
  }

  snapshot(): string {
    return toBase64(this.bytes);
  }
}
