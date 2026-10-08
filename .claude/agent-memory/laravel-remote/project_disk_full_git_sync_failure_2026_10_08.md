---
name: disk-full-git-sync-failure
description: Root disk hit 99% full, broke git pull/push on core_node with "No space left on device"; safe cache cleanup recipe that restored it to 95%
metadata:
  type: project
---

On 2026-10-08, `/` on VM-0-2-debian hit 99% full (59G used, 687M free), which broke `git pull`/`git push` in `/www/programing/core_node`: fetch received objects from GitHub but failed `unable to write loose object file: No space left on device` → `unpack-objects failed` → pull aborted → subsequent push rejected as non-fast-forward ("fetch first"), even though the real cause was disk space, not a real divergence.

**Why:** This repo auto-syncs very frequently (gitsync pushes commits every ~5min from multiple machines, see recent commit log pattern `*-pycore-auto-gitsync`), so a full disk here will recur and silently break every machine's sync until someone frees space. `/var`, `/boot`, and PG data are NOT the big consumers on this host — `/www` (33G, incl. `/www/wwwroot/laravel_db` 15G and `/www/programing` 11G) and `/root` (8.5G, almost entirely regenerable tool caches) are.

**Safe cleanup recipe (all regenerable caches, verified safe — none touch running services or [[project_relay]] data):**
- `rm -rf /root/.npm/_cacache` (~465M) — npm redownloads on demand
- `rm -rf /root/.cache/{pnpm,composer,node-gyp,code-server,electron,go-build,node}/*` (~800M combined) — all rebuild/redownload lazily
- `apt-get autoremove -y && apt-get clean` — drops stale kernel headers (e.g. old `linux-headers-6.1.0-37-*` when running 6.12.x) and unused libs
- `journalctl --vacuum-time=2d` — usually frees ~0 here since journal is small (140M), not worth prioritizing
- Freed ~2.5G total (99%→95% used, 687M→3.1G free) in this incident without touching anything live.

**NOT touched / NOT safe without more investigation:** `/root/.rustup` (1.4G toolchains), `/root/.cargo/registry` (218M), `/root/.codex` (1.2G sessions+packages), `/www/wwwroot/.tmp` (294M, owned by `lighthouse` user — looks like aapanel/BT installer temp dirs, outside core_node scope, left alone per no-overreach), `/www/_debian_12/postgresql` (4.8G, live DB data).

**How to apply:** If a future git push/pull on this server fails with "No space left on device" or an unexplained non-fast-forward rejection, check `df -h /` first — it is very likely disk space, not a real conflict. Run the cache-cleanup recipe above before troubleshooting git itself. If recipe is insufficient, next safe targets to investigate (not yet verified in this incident): old rustup toolchain versions, codex old session logs, laravel_db / laravel app log rotation under `/www/wwwroot`.
