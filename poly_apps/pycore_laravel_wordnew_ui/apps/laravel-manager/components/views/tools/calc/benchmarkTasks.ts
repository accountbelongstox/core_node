/** Browser micro-benchmark tasks and the timing loop (performance.now, cooperative yielding). */

export interface BenchTask {
  key: string;
  setup: () => unknown;
  run: (context: never) => unknown;
}

export interface BenchOutcome { runs: number; opsPerSecond: number; avgMs: number }

const SLICE_MS = 40;
const WARMUP_RUNS = 3;
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const LCG_MODULUS = 2 ** 32;

let sink = 0;

const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => { state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS; return state / LCG_MODULUS; };
};

export const BENCH_TASKS: readonly BenchTask[] = [
  {
    key: 'sort',
    setup: () => { const rnd = seeded(1); return Array.from({ length: 5000 }, () => rnd()); },
    run: (data: number[]) => { const copy = data.slice(); copy.sort((x, y) => x - y); sink += copy[0]; },
  },
  {
    key: 'json',
    setup: () => { const rnd = seeded(2); return Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`key${i}`, { id: i, value: rnd(), tags: ['a', 'b', 'c'], nested: { ok: true } }])); },
    run: (obj: object) => { sink += Object.keys(JSON.parse(JSON.stringify(obj))).length; },
  },
  {
    key: 'math',
    setup: () => null,
    run: () => { let sum = 0; for (let i = 1; i <= 10000; i += 1) sum += Math.sqrt(i) * Math.sin(i); sink += sum; },
  },
  {
    key: 'string',
    setup: () => Array.from({ length: 1000 }, (_, i) => `item-${i}`),
    run: (parts: string[]) => { sink += parts.join(',').replace(/item/g, 'x').split(',').length; },
  },
  {
    key: 'regex',
    setup: () => ({ lines: Array.from({ length: 300 }, (_, i) => `2026-10-${String(i % 28 + 1).padStart(2, '0')} user${i}@example.com GET /path/${i}?q=${i * 7} 200`), pattern: /(\d{4})-(\d{2})-(\d{2}) (\S+)@(\S+) (GET|POST) (\S+) (\d{3})/ }),
    run: (ctx: { lines: string[]; pattern: RegExp }) => { for (const line of ctx.lines) { const m = ctx.pattern.exec(line); if (m) sink += m.length; } },
  },
  {
    key: 'map',
    setup: () => null,
    run: () => { const map = new Map<number, number>(); for (let i = 0; i < 10000; i += 1) map.set(i, i * 2); let sum = 0; for (let i = 0; i < 10000; i += 1) sum += map.get(i) ?? 0; sink += sum; },
  },
  {
    key: 'array',
    setup: () => Array.from({ length: 10000 }, (_, i) => i),
    run: (data: number[]) => { sink += data.map((x) => x * 2).filter((x) => x % 3 === 0).reduce((s, x) => s + x, 0); },
  },
  {
    key: 'typed',
    setup: () => new Float64Array(100000),
    run: (buffer: Float64Array) => { for (let i = 0; i < buffer.length; i += 1) buffer[i] = i * 0.5; let sum = 0; for (let i = 0; i < buffer.length; i += 1) sum += buffer[i]; sink += sum; },
  },
  {
    key: 'objects',
    setup: () => null,
    run: () => { const list: Array<{ id: number; name: string }> = []; for (let i = 0; i < 10000; i += 1) list.push({ id: i, name: 'n' }); sink += list.length; },
  },
  {
    key: 'sha256',
    setup: () => crypto.getRandomValues(new Uint8Array(65536)),
    run: async (data: Uint8Array) => { const digest = await crypto.subtle.digest('SHA-256', data); sink += new Uint8Array(digest)[0]; },
  },
];

const yieldToUi = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

export const benchSink = (): number => sink;

export async function measureTask(task: BenchTask, budgetMs: number, isCancelled: () => boolean): Promise<BenchOutcome | null> {
  const context = task.setup() as never;
  for (let i = 0; i < WARMUP_RUNS; i += 1) await task.run(context);
  let runs = 0;
  let busy = 0;
  let sliceStart = performance.now();
  while (busy + (performance.now() - sliceStart) < budgetMs) {
    if (isCancelled()) return null;
    const outcome = task.run(context);
    if (outcome instanceof Promise) await outcome;
    runs += 1;
    const now = performance.now();
    if (now - sliceStart > SLICE_MS) {
      busy += now - sliceStart;
      await yieldToUi();
      sliceStart = performance.now();
    }
  }
  busy += performance.now() - sliceStart;
  return { runs, opsPerSecond: runs / (busy / 1000), avgMs: busy / runs };
}
