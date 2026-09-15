# A7A7 Post-175 field scan, enrollment convergence, and transport resets

## Task scope (user, 2026-09-16)

1. 175 script was run by the operator; scan the live host to verify self-healing.
2. UI Relay still shows `machines (0 online)`; a Windows pyservice started from
   latest code still does not join.
3. pyservice parameter design: no argument -> mode 1 (local model); argument 2 ->
   mode 2; the argument must be cached into the user data store by the Python
   side so a bare `pycore` restart (no shell wrapper) reuses the cached mode;
   a shell launch without arguments must pass 1 explicitly to overwrite the cache.
4. All six AI clients report "The coordinator returned no available devices for
   this Pycore group"; functionality still unusable.
5. New BUG: `POST /api/worker/tasks/{type}/accept` fails after ~19.27s with
   `ConnectionResetError(10054)` on the Windows client.
6. New BUG2: Mercure subscriber `Read timed out` against
   `https://api.si.12gm.com/.well-known/mercure`; relay subscriber state flips
   to `offline`.

## Field scan log (incremental, 2026-09-16 ~02:05 CST)

- `ncore-laravel-frankenphp.service` active since 2026-09-15 20:31:45 CST
  (ExecMainStart). FrankenPHP run + `schedule:work` processes alive.
- Live binary `/usr/bin/frankenphp list-modules` contains
  `http.handlers.mercure` (+ health/bolt/local) — A7A6 probe would pass.
- On-disk Caddyfile now carries the `mercure` directive (heartbeat 20s,
  write_timeout 0s, subscriptions) and the `stream_close_delay 5m` block on
  both the localhost HTTPS mercure proxy and every domain route file
  (`routes/12gm.com.caddy` included). Finding A7A6-5b is healed.
- External reachability: `/.well-known/mercure` returns 401 (auth enforced,
  route live), `https://12gm.com/` 200, `https://api.si.12gm.com/api/health`
  200.
- ANOMALY: `schedule:work` log shows the `octane-timer-heartbeat` task stalling
  for 34-51 seconds repeatedly (gaps at 18:01:30->18:02:02, 18:02:05->18:02:56
  UTC). The scheduler loop is being blocked by long-running work roughly once
  per minute. This coincides with the ~19.3s client-side connection resets and
  must be traced (DB lock / cache store / HTTP call inside a scheduled task).
