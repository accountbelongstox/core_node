# TEST: clip scheduler drills (chain order, gating, idempotency, switching)

Rules under test: `development-guides/WORDNEW_GUIDE.md` section 1 (R1-R12; R12 is a planner rule outside the stage chain: `buildAssignment` is a pure function of the roster, the direct host and the plan languages, checked by hand: nodes sized by items/h x horizon, the direct host takes `assignment_direct_fraction` of its machine's window, a lane without nodes keeps the default head share). Design: `docs_fix/DESIGN_WORDNEW_CLIENT.md`.
Runs the real `shared/orchestration` scheduler (`buildOrchClipSchedule`), resolver (`resolveOrchClips`), bundle resolver,
clip table and transfer limiter with fake channels (no network, no device). Run with bun from
`poly_apps/pycore_laravel_wordnew_ui`: save a script below as `<scratch>/drill.ts` and run `bun run <scratch>/drill.ts`.
Any change to R1-R12 updates this script in the same step; S1-S8 and the randomized rounds must report 0 violations.

Pass criteria:
- Order (R1): `schedule.stages` follows `ORCH_CLIP_STAGE_ORDER`
  (native: device > transfer:pycore > transfer:laravel > generate:pycore > transfer:relay > generate:relay >
  generate:laravel; web: the same order without device); any other order throws `ORCH_CLIP_SCHEDULE_ORDER_VIOLATION`.
- S1 all online: pycore transfer, then Laravel transfer, then pycore generation (relay and Laravel generation not called).
- S2 re-run: the device answers what was delivered; only the missing clip is asked again (idempotent).
- S3 / S5: without a direct pycore (from the start, or dropping mid-run) the relay transfers and generates.
- S4: no pycore reachable: Laravel generates.
- S6: web (no device store): the same order starting at pycore direct.
- S7: nothing is called when no channel is usable.
- S8: a clip generated meanwhile is found and transferred; `recheckGenerating` reports it.
- Randomized (300 rounds of random availability, holdings, device store present or not, mid-run switches, aborts):
  violations=0. Invariants: relay only while no direct pycore and the relay is usable; Laravel generation only
  without any pycore and with Laravel usable; pycore generation only while pycore is usable; every item ends `done`
  or `missing`; `generating` only on missing items; no clip delivered twice; nothing left pending.
- Cursor and scale (`cursor_perf.ts`, 29,403 resources, 17,571 on the device): run 1 asks every non-device clip
  (47 bundles of 256 per transfer stage) and flags the next 200 for generation; the table snapshot (~39 KB) round-trips
  exactly; run 2 with the kept cursors sends 0 transfer requests (each transfer stage reports `known` 11,832) and
  generation skips the 200 already flagged. Both runs finish well under a second.

Last run (2026-10-02): S1-S8 as above; randomized 300 rounds, violations=0; cursor run 1: 94 requests, snapshot
39,204 bytes, restored identical; run 2: 0 requests.

## drill.ts

```ts
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k), key: () => null, length: 0, clear: () => mem.clear() };
import { buildOrchClipSchedule, type OrchClipChannel } from '/www/programing/core_node/poly_apps/pycore_laravel_wordnew_ui/shared/orchestration/orchClipScheduler';
import { resolveOrchClips } from '/www/programing/core_node/poly_apps/pycore_laravel_wordnew_ui/shared/orchestration/orchClipResolver';

type Res = { key: string; kind: 'word' | 'sentence'; language: string; text: string; laravelUrl: null; contentId: string; resourceId: string };
const res = (key: string, kind: 'word' | 'sentence' = 'sentence'): Res => ({ key, kind, language: 'en', text: key, laravelUrl: null, contentId: key, resourceId: key });
const log: string[] = [];
const device = new Set<string>();

function channel(id: 'pycore' | 'relay' | 'laravel', holds: Set<string>, online: { v: boolean }): OrchClipChannel {
  return {
    id, available: async () => online.v,
    bundle: {
      origin: id === 'laravel' ? 'laravel' : 'pycore', via: id, maxItems: 2, baseUrl: () => `https://${id}.test`,
      fetch: async (batch) => {
        log.push(`${id}:bundle(${batch.map((r) => r.key).join(',')})`);
        return { supported: true, entries: batch.map((r, index) => ({ index, hit: holds.has(r.key), sent: holds.has(r.key), bytes: holds.has(r.key) ? 3 : 0, meaning: '', data: holds.has(r.key) ? new Uint8Array([1, 2, 3]) : null, written: false })) };
      },
    },
    generate: async (kind, rs) => { log.push(`${id}:generate(${rs.map((r) => r.key).join(',')})`); return true; },
    holds: async (rs) => new Set(rs.filter((r) => holds.has(r.key)).map((r) => r.key)),
  };
}

const deviceSource = { origin: 'device' as const, async resolve(rs: any[], _c: any, found: any) { rs.forEach((r) => { if (device.has(r.key)) found(r, { key: r.key, url: 'file://' + r.key, origin: 'device', meaning: '' }); }); } };
const sink = { persist: async (r: any) => { device.add(r.key); return 'file://' + r.key; } };

async function run(name: string, opts: { pycore: boolean; relay: boolean; laravel?: boolean; web?: boolean; flipPycoreAfterTransfer?: boolean; abortAfterMs?: number }, have: { pycore: string[]; relay: string[]; laravel: string[] }, keys: string[]) {
  log.length = 0;
  const online = { pycore: { v: opts.pycore }, relay: { v: opts.relay }, laravel: { v: opts.laravel ?? true } };
  const pycore = channel('pycore', new Set(have.pycore), online.pycore);
  if (opts.flipPycoreAfterTransfer) {
    const fetch = pycore.bundle.fetch;
    pycore.bundle.fetch = async (b, s) => { const a = await fetch(b, s); online.pycore.v = false; return a; };
  }
  const schedule = buildOrchClipSchedule({ device: opts.web ? undefined : deviceSource as any, sink, pycore, relay: channel('relay', new Set(have.relay), online.relay), laravel: channel('laravel', new Set(have.laravel), online.laravel) });
  const controller = new AbortController();
  if (opts.abortAfterMs !== undefined) setTimeout(() => controller.abort(), opts.abortAfterMs);
  const result = await resolveOrchClips(keys.map((k) => res(k)) as any, schedule.sources, { meaningOf: () => '', signal: controller.signal });
  const items = result.table.keys.map((key: string, index: number) => { const i = result.table.entry(index); return `${key}=${i.state}${i.via ? '/' + i.via : i.origin === 'device' ? '/device' : ''}${i.generating ? '/gen:' + i.generating : ''}`; }).join(' ');
  const recheck = [...(await schedule.recheckGenerating(keys.map((k) => res(k)) as any))].join(',');
  console.log(`\n## ${name}\n  stages: ${schedule.stages.join(' > ')}\n  calls: ${log.join(' | ')}\n  items: ${items}\n  counts: ${JSON.stringify(result.table.counts())}\n  recheck(holds now): [${recheck}]`);
  return result;
}

const keys = ['A', 'B', 'C', 'D'];
device.add('A');
await run('S1 all online (device A, pycore B, Laravel C, D nowhere)', { pycore: true, relay: true }, { pycore: ['B'], relay: ['B'], laravel: ['C'] }, keys);
await run('S2 idempotent re-run (B, C now on the device)', { pycore: true, relay: true }, { pycore: ['B'], relay: ['B'], laravel: ['C'] }, keys);
device.clear(); device.add('A');
await run('S3 pycore down, relay up (relay holds B)', { pycore: false, relay: true }, { pycore: ['B'], relay: ['B'], laravel: ['C'] }, keys);
device.clear(); device.add('A');
await run('S4 no pycore at all (direct down, relay unpaired)', { pycore: false, relay: false }, { pycore: ['B'], relay: ['B'], laravel: ['C'] }, keys);
device.clear(); device.add('A');
await run('S5 pycore drops right after its transfer (switch mid-run)', { pycore: true, relay: true, flipPycoreAfterTransfer: true }, { pycore: ['B'], relay: [], laravel: ['C'] }, keys);
device.clear(); device.add('A');
await run('S6 web order (no device store; same order as the app)', { pycore: true, relay: true, web: true }, { pycore: ['B', 'C'], relay: [], laravel: ['C'] }, keys);
device.clear();
await run('S7 everything offline incl. Laravel', { pycore: false, relay: false, laravel: false }, { pycore: [], relay: [], laravel: ['C'] }, keys);
await run('S8 generated clip appears on pycore (recheck)', { pycore: true, relay: false }, { pycore: ['D'], relay: [], laravel: [] }, ['D']);

// ---- randomized drill: availability flips, holdings, mid-run switches, aborts ----
let violations = 0;
const rand = (n: number) => Math.floor(Math.random() * n);
for (let round = 0; round < 300; round += 1) {
  log.length = 0;
  device.clear();
  const all = Array.from({ length: 8 }, (_, i) => `R${i}`);
  all.forEach((k) => { if (rand(4) === 0) device.add(k); });
  const holdP = new Set(all.filter(() => rand(3) === 0));
  const holdR = new Set(all.filter(() => rand(3) === 0));
  const holdL = new Set(all.filter(() => rand(3) === 0));
  const online = { pycore: { v: rand(2) === 0 }, relay: { v: rand(2) === 0 }, laravel: { v: rand(4) !== 0 } };
  const pycore = channel('pycore', holdP, online.pycore);
  const relay = channel('relay', holdR, online.relay);
  const laravel = channel('laravel', holdL, online.laravel);
  // Mid-run switch: after any bundle, a channel may go offline / come online.
  for (const [ch, flag] of [[pycore, online.pycore], [relay, online.relay], [laravel, online.laravel]] as const) {
    const fetch = ch.bundle.fetch;
    ch.bundle.fetch = async (b, s) => { const a = await fetch(b, s); if (rand(3) === 0) flag.v = !flag.v; return a; };
  }
  const calls: Array<{ call: string; pycore: boolean; relay: boolean; laravel: boolean }> = [];
  const tap = (ch: OrchClipChannel, name: string) => {
    const fetch = ch.bundle.fetch; const generate = ch.generate!;
    ch.bundle.fetch = async (b, s) => { calls.push({ call: `${name}:bundle`, pycore: online.pycore.v, relay: online.relay.v, laravel: online.laravel.v }); return fetch(b, s); };
    ch.generate = async (k, rs) => { calls.push({ call: `${name}:generate`, pycore: online.pycore.v, relay: online.relay.v, laravel: online.laravel.v }); return generate(k, rs); };
  };
  tap(pycore, 'pycore'); tap(relay, 'relay'); tap(laravel, 'laravel');
  const schedule = buildOrchClipSchedule({ device: rand(2) === 0 ? undefined : deviceSource as any, sink, pycore, relay, laravel });
  const controller = new AbortController();
  const aborting = rand(10) === 0;
  if (aborting) setTimeout(() => controller.abort(), 0);
  const delivered = new Map<string, number>();
  const result = await resolveOrchClips(all.map((k) => res(k)) as any, schedule.sources.map((s: any) => ({ ...s, resolve: (rs: any, c: any, f: any) => s.resolve(rs, c, (r: any, clip: any) => { delivered.set(r.key, (delivered.get(r.key) ?? 0) + 1); f(r, clip); }) })), { meaningOf: () => '', signal: controller.signal });
  const fail = (why: string) => { violations += 1; if (violations <= 5) console.log(`VIOLATION round ${round}: ${why}`); };
  for (const c of calls) {
    // A stage runs only while its gate held at its start; the gate is re-read per stage, so a
    // call is legal when its channel was usable (state as observed when it ran).
    if (c.call === 'relay:bundle' || c.call === 'relay:generate') { if (c.pycore) fail(`${c.call} while pycore direct online`); if (!c.relay) fail(`${c.call} while relay unpaired`); }
    if (c.call === 'laravel:generate' && (c.pycore || c.relay || !c.laravel)) fail(`laravel:generate with pycore=${c.pycore} relay=${c.relay} laravel=${c.laravel}`);
    if (c.call === 'pycore:generate' && !c.pycore) fail('pycore:generate while pycore offline');
  }
  // R8: with no backend answer this run, unresolved clips stay queued for the next run.
  const answered = Object.keys(result.endpoints).length > 0;
  result.table.keys.forEach((key: string, index: number) => {
    const item = result.table.entry(index);
    const settled = item.state === 'done' || item.state === 'missing' || (!answered && item.state === 'queued');
    if (!settled) fail(`${key} ended ${item.state}`);
    if (item.generating && item.state !== 'missing') fail(`${key} generating but ${item.state}`);
  });
  delivered.forEach((n, k) => { if (n > 1) fail(`${k} delivered ${n} times`); });
  if (answered && result.table.counts().pending !== 0) fail('pending left');
}
console.log(`\nrandomized drill: 300 rounds, violations=${violations}`);
```

## cursor_perf.ts

```ts
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k), key: () => null, length: 0, clear: () => mem.clear() };
const root = '/www/programing/core_node/poly_apps/pycore_laravel_wordnew_ui/shared/orchestration';
const { buildOrchClipSchedule } = await import(`${root}/orchClipScheduler.ts`);
const { resolveOrchClips, OrchCursorBook } = await import(`${root}/orchClipResolver.ts`);
const { OrchClipTable } = await import(`${root}/orchClipTable.ts`);
const res = (k: string) => ({ key: k, kind: 'sentence', language: 'en', text: k, laravelUrl: null, contentId: k, resourceId: k });
let requests = 0;
const channel = (id: any, holds: Set<string>) => ({
  id, available: async () => true,
  bundle: { origin: id === 'laravel' ? 'laravel' : 'pycore', via: id, maxItems: 256, baseUrl: () => `https://${id}.test`,
    fetch: async (batch: any[]) => { requests += 1; return { supported: true, entries: batch.map((r, index) => ({ index, hit: holds.has(r.key), sent: holds.has(r.key), bytes: 3, meaning: '', data: holds.has(r.key) ? new Uint8Array(3) : null, written: false })) }; } },
  generate: async () => true,
});
const N = 29403;
const keys = Array.from({ length: N }, (_, i) => `K${i}`);
const device = new Set(keys.slice(0, 17571));
const deviceSource = { origin: 'device', resolve: async (rs: any[], ctx: any, found: any) => { ctx.stage('device', { state: 'running', asked: rs.length }); rs.forEach((r) => { if (device.has(r.key)) found(r, { key: r.key, url: 'file://x', origin: 'device', meaning: '' }); }); } };
const schedule = buildOrchClipSchedule({ device: deviceSource, sink: { persist: async () => 'blob:x' }, pycore: channel('pycore', new Set()), laravel: channel('laravel', new Set()) });
let reports = 0;
// Run 1 (fresh): every non-device clip is asked.
let t = performance.now();
const book = new OrchCursorBook();
const r1 = await resolveOrchClips(keys.map(res), schedule.sources, { meaningOf: () => '', cursors: book, onProgress: () => { reports += 1; } });
const run1 = { ms: Math.round(performance.now() - t), requests, reports, counts: r1.table.counts(), stages: Object.fromEntries(Object.entries(r1.stages).map(([k, v]: any) => [k, `${v.batchesDone}/${v.batches} asked ${v.asked} known ${v.known}`])) };
// Persist + restore like the progress store: table snapshot and cursors.
const snapshot = r1.table.snapshot();
const restored = OrchClipTable.fromSnapshot(keys, snapshot);
// Run 2 (resume within the window): stages start at their cursors - nothing is asked again.
requests = 0;
t = performance.now();
const r2 = await resolveOrchClips(keys.map(res), schedule.sources, { meaningOf: () => '', cursors: new OrchCursorBook(r1.cursors.toJSON()) });
const run2 = { ms: Math.round(performance.now() - t), requests, stages: Object.fromEntries(Object.entries(r2.stages).map(([k, v]: any) => [k, `asked ${v.asked} known ${v.known}`])) };
console.log(JSON.stringify({ run1, snapshotBytes: snapshot.length, restoredSame: restored.snapshot() === snapshot, cursors: r1.cursors.toJSON(), run2 }, null, 1));
```
