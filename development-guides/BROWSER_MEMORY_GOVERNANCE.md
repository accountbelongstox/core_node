# Browser Memory Governance (Linux)

## The abnormal state this design resolves (recorded 2026-07-04)
On a no-swap box BOTH naive options fail — this is the trap to never regress into:
- **Unlimited browser** → Chrome/Edge quickly fill ALL RAM → the whole system freezes.
- **Tight cgroup caps + no swap** (old: Chrome 2G / Edge 500M hard) → the browser is unusable.
  Measured (Kali, 14GiB/32c, temp profile, 4 heavy tabs): `memory.events high=35042`,
  `memory.pressure full avg10≈75%` (tree stalled in reclaim 75% of the time),
  `workingset_refault_file=39837`, memory pinned at the 2G cap. CPU quota was NOT the
  trigger (`nr_throttled=1`).

Root cause: cgroup `MemoryHigh` with zero swap has no pageout target for anonymous
memory, so it evicts the browser's own file/code pages → refault storm = "high CPU +
frozen browser". Firefox felt fine only because it is not wrapped. It is **NOT a
Kali-vs-Chrome issue**: no evidence exists that Chrome/Edge run worse on Kali; both are
merely "unsupported-but-compatible" there (Debian derivative).

## Design — defense in depth (order matters)
1. **zram swap** (zstd, 50% RAM, prio 100) + zram-tuned sysctls (`vm.swappiness=180`,
   `page-cluster=0`, `watermark_scale_factor=125`, `watermark_boost_factor=0`) —
   gives reclaim a graceful destination. `common/memory_governance.sh::ensure_zram_swap`
   (never restarts an ACTIVE device: swapoff decompresses into RAM → OOM).
2. **Per-browser scope** (baked by installers 30/35 via `APP_*` env, machine-relative):
   `MemoryMax=min(62% RAM, 16G)`, `MemoryHigh=73% of Max (≈45% RAM)`,
   `CPUQuota=nproc*100%` (inert — a hard CPU quota on the primary app causes
   throttle-latency; contention is handled by slice `CPUWeight=80`).
   Never pass `--mem/--high/--cpu` for browsers: those bake absolute numbers.
3. **No-swap launch gate** (wrapper template in `common/app_resource_limit.sh`):
   if `SwapTotal=0`, `MemoryHigh` collapses onto `MemoryMax` — one renderer OOM
   beats a tree-wide thrash stall.
4. **Aggregate slice** `corenode-apps.slice` = 78% / 65% of RAM for ALL wrapped apps
   together (lowered from 85/72: the zram pool is kernel memory charged to no cgroup).
5. **systemd-oomd backstop** (`ensure_systemd_oomd`): wrapper opts the slice in with
   `ManagedOOMMemoryPressure=kill` / limit 50% — sustained PSI kills the fattest scope
   instead of freezing the box.
6. **In-browser discard**: Chrome Memory Saver / Edge Sleeping Tabs via managed policy
   JSON (`/etc/opt/{chrome,edge}/policies/managed/corenode_memory.json`; browsers show
   "Managed by your organization"; Edge policy is Windows/macOS-documented, best-effort
   on Linux). Complements — does not replace — the caps (browsers watch SYSTEM memory,
   not their cgroup).

Non-browser wrapped apps (vscode/cursor/antigravity) keep the `min(1G, 20% RAM)` default;
they inherit the no-swap gate + slice changes on their next installer re-run.

## Knobs (env, all machine-relative)
| Env | Default | Browser (30/35) | Meaning |
|---|---|---|---|
| `APP_MEM_PCT` / `APP_MEM_CAP_MB` | 20 / 1024 | 62 / 16384 | MemoryMax = min(cap, pct% RAM) |
| `APP_HIGH_PCT` | 90 | 73 | MemoryHigh = pct% of MemoryMax |
| `APP_CPU_PCT` | 10 | 100 | CPUQuota = pct% × nproc |
| `APP_AGG_MEM_PCT` / `APP_AGG_HIGH_PCT` | 78 / 65 | same | shared slice Max/High (% RAM) |
| `ZRAM_PERCENT` / `ZRAM_PRIORITY` | 50 / 100 | same | zram size %RAM / swap priority |

Verify on a live box: `cat /sys/fs/cgroup/user.slice/user-*.slice/user@*.service/corenode.slice/corenode-apps.slice/run-*.scope/{memory.max,memory.high,memory.events,memory.pressure}` — `high` counter exploding + `full` PSI above ~20% means the caps are thrashing again.
