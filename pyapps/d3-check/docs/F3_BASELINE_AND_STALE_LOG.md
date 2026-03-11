# F3 baseline and stale-log behavior (ROSBOT_FLOW_MERMAID)

## Intended behavior (from ROSBOT_FLOW_MERMAID F3_Baseline)

- **Baseline when log exists (current run):** Use log last-modified time. New log activity resets the timeout.
- **Baseline when just started (no log from this run yet):** Use `started_at` (UI duration / when ROSBOT was started). Timeout = configured minutes from `started_at`.
- **Only when D3 and ROSBOT are both present and we have seen log from this run** do we use **log time** as baseline. Until then, use **start time** as baseline.

So: **just started → baseline = started_at (timeout from start). Only after we have current-run log → baseline = last_log_ts (timeout from last log).**

## Unreasonable behavior (bug)

Previously the code did:

1. If `last_log_ts >= started_at` → baseline = last_log_ts (log-based). OK.
2. Else if **fresh-start window** `(now - started_at) < 60s` → baseline = started_at. OK.
3. Else if `last_log_ts > 0` → **"stale log" → f4 (kill D3 and ROSBOT)**.

So **after 60 seconds from `started_at`**, if the log file had not been written in this run yet (`last_log_ts` still from a previous run, i.e. `last_log_ts < started_at`), we immediately treated it as "stale log" and went to f4. That caused a **false timeout right after startup**: we killed D3 and ROSBOT even though we had just entered F3 and should use **start time** as baseline for the full timeout window (e.g. 30 min).

## Correct logic

- **If we have log from current run** (`last_log_ts >= started_at`): baseline = last_log_ts. Timeout = configured minutes from last log.
- **Else if we have `started_at`** (ROSBOT was started this run): baseline = started_at. Timeout = configured minutes from `started_at`. Do **not** treat "log from previous run" as stale and go f4; keep using start-based baseline until we see current-run log.
- **Only if we have no valid baseline** (`started_at == 0` and no current-run log): then "stale log" or "no log mtime" → f4.

So: **just started = use started_at until log is current; only then use log time.**
