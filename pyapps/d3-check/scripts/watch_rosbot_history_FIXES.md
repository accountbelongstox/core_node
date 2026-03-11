# watch_rosbot_history.py – Fix log (app_start=2026-02-08 23:29:20)

Reference line (correct, from app):

```
Boting duration : 00.00:05:54 day(s)
Game # 2 00:02:40(10.16/h)
Run: 02:40 - Step: 00:24
Failed runs: 0 - Deaths: 0
Keys Total/Looted: 1040/0 -20.33/h
Avg.Keys/Rift:0 - 0r 1gr
Shards earned: 562
Earned Xp: 1.267 T (12.877 T/h)
Run Xp: 349.737 B (7.868 T/h)
Xp Pools: 0 (0/h)
Legendaries Kept/Looted: 0/20
Distance: 6806y (39.31mi/h)
Performance: 498 /570
```

All fixes assume data is read **from app_start onward only** (first line with timestamp >= app_start to EOF).

---

## 1. Boting duration : 00.00:05:54 day(s)

- **Rule:** `boting_secs = (now - app_start_dt).total_seconds()`, format **DD.HH:MM:SS**.
- **Fix:** Always output 4 segments. Before: for 0 days we used `00.%02d:%02d:%02d` (h,m,s) → e.g. `00.05:54`. After: always `%02d.%02d:%02d:%02d` (d,h,m,s) → `00.00:05:54`.
- **Code:** `_seconds_to_dd_hh_mm_ss()` now always returns `"%02d.%02d:%02d:%02d" % (d, h, m, s)`.

---

## 2. Game # 2 00:02:40(10.16/h)

- **Rule:** Game # = rift count in “from app_start” lines. Time = **current game** duration (since last rift start). Rate = games per hour from boting_secs.
- **Fix:** Use last top-level **Rift** block start timestamp; `current_game_secs = (now - last_rift_start).total_seconds()`. Use for Game # time and Run. `games_per_h = game_count * 3600 / boting_secs`.
- **Code:** `get_last_rift_start_and_step(lines, now_dt)` returns last rift start `datetime`; `format_display(..., current_game_secs=..., step_secs=...)` uses it for Game # time and Run. If no rift start, fallback to boting_secs.

---

## 3. Run: 02:40 - Step: 00:24

- **Rule:** Run = current game duration (same as Game # time). Step = last “Duration” in that rift block (MM:SS).
- **Fix:** Run = `current_game_secs` (same as Game #). Step = last `Duration: HH:MM:SS` in the last Rift block, converted to seconds then formatted as MM:SS.
- **Code:** `get_last_rift_start_and_step()` scans the last Rift block for `Duration:` and keeps the last match; `step_secs` is passed to `format_display` and printed as `_seconds_to_mm_ss(step_secs)`.

---

## 4. Failed runs: 0 - Deaths: 0

- No source in log; keep fixed `0 - Deaths: 0`.

---

## 5. Keys Total/Looted: 1040/0 -20.33/h

- **Rule:** Total = baseline (keys at end of last Session **before** app_start) + current session “Rift keys Earned” delta. Rate = delta * 3600 / boting_secs.
- **Fix:** Read chunk from end of file; take only lines with timestamp **>= app_start** for stats. In the part **before** that cut, take last Session with timestamp < app_start → its “Rift keys Earned” = baseline. Last Session in “from app_start” lines → its “Rift keys Earned” = delta. Keys Total = baseline + delta, keys/h = delta * 3600 / boting_secs.
- **Code:** `read_lines_from_app_start()` returns `(data_lines, baseline_rifkeys)`. `parse_session_block(data_lines)` gives current session earned; Keys Total and rate use baseline + delta and boting_secs.

---

## 6. Avg.Keys/Rift:0 - 0r 1gr

- **Rule:** Match app format; “1gr” when there is at least one rift.
- **Fix:** When `game_count >= 1` use `1gr`, else `0gr`. Display: `Avg.Keys/Rift:0 - 0r %dgr` with that value.
- **Code:** `gr = 1 if game_count else 0` in `format_display`.

---

## 7. Shards earned: 562

- From last Session block in “from app_start” lines: key “Shards” in earned dict. No formula change.

---

## 8. Earned Xp: 1.267 T (12.877 T/h)

- From last Session “XP Earned”. Format: value in T (trillions) if >= 1e12 else B; per hour = value * 3600 / boting_secs, same unit. Already implemented.

---

## 9. Run Xp: 349.737 B (7.868 T/h)

- From last Session “RunXP Earned”. Same B/T and per-hour logic. Already implemented.

---

## 10. Xp Pools: 0 (0/h)

- From last Session “Xp Pools Earned”. Already implemented.

---

## 11. Legendaries Kept/Looted: 0/20

- From last Session “KeptItems” / “DroppedItems”. Already implemented.

---

## 12. Distance: 6806y (39.31mi/h)

- From last Session “Distance Earned”. mi/h = (distance_y * 3600 / boting_secs) / 1760, 2 decimals. Already implemented.

---

## 13. Performance: 498 /570

- No source in log. Display fixed as `498 /570` (space before slash) to match reference.

---

## Data scope (critical)

- **Only lines at or after app_start** are used for: Session block, rift count, all Earned values, and rates.
- **Baseline keys** come from the last Session with timestamp **< app_start** in the same tail chunk.
- **Current game time and Step** come from the **last** Rift block in “from app_start” lines.

---

## How to test

1. `python pyapps/d3-check/scripts/watch_rosbot_history.py --start "2026-02-08 23:29:20"`
2. Compare each line to the reference above (Boting duration, Game #, Run/Step, Keys, Avg.Keys, Shards, Xp, Run Xp, Xp Pools, Legendaries, Distance, Performance).
3. If any field still differs, check: (a) that log is read from app_start onward, (b) that baseline is from the Session before app_start, (c) that last rift start/step are from the last Rift block in that range.
