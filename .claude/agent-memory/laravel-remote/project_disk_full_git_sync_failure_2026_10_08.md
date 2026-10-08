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

**Round 2 (same incident, user asked to find more — excluding laravel DB and audio data explicitly):** freed another ~6.6G (95%→84% used, 3.1G→9.7G free):
- `rm -rf /var/_core_node/cache/pip/http-v2` (2.6G) — this project's own pip HTTP cache dir (separate from `~/.cache/pip`; check `pip config list` / `PIP_CACHE_DIR` env — the project routes pip cache under `/var/_core_node/cache/pip`), safe, pip redownloads wheels on demand.
- Cargo re-downloadable parts only, toolchain kept (matches the repo's own policy in `scripts/shells/linux/dd_helper/dev_cache_cleanup.sh`): `rm -rf /root/.cargo/registry/{cache,src}/* /root/.cargo/git/checkouts /root/.rustup/downloads` (~250M). **Do not remove `/root/.rustup/toolchains` itself** — that script explicitly keeps installed toolchains, only cleans downloads/registry cache/src/checkouts.
- `/root/.codex/packages/standalone`, `.tmp/plugins`, `plugins/cache`, `cache/remote_plugin_catalog` (~570M) — Codex CLI's own redownloadable package/plugin caches.
- `/root/.local/share/cursor-agent/versions/*` — cursor-agent self-update keeps every old version; safe to delete all but the newest (check `readlink -f $(command -v cursor-agent)` or the newest-dated dir) (~783M freed, one dir kept).
- `/root/.local/share/gem/ruby/*/doc/*` (239M) — Ruby gem documentation (ri/rdoc), gems still work without it; keep `gems/`, `extensions/`, `cache/` siblings.
- pnpm global store, two locations: `/root/.local/share/pnpm` and `/var/_core_node/cache/xdg/pnpm` (~1.5G combined) — safe, pnpm repopulates content-addressable store from registry on next install.
- Headless Chrome cache `/var/_core_node/cache/xdg/google-chrome-headless` (103M) — only safe if confirmed not running (`ps aux | grep chrome`); it was idle in this incident.
- `git gc --aggressive --prune=now` on `/www/programing/core_node/.git` shrank it from 2.4G → 1.1G (~1.3G freed). Verified safe afterward with `git fsck --full` (clean) and `git status` (clean, in sync with origin). Safe to re-run anytime the repo's `.git` looks bloated — this repo churns a lot of history via frequent auto-sync commits.

**Confirmed LIVE / do-not-touch (verified via `ps aux` / mount, not just guessed):** `/www/_debian_12/postgresql/data` — actual Postgres `-D` data dir, a live `postgres` process uses it (this is the laravel DB — always excluded per user instruction). `/www/_debian_13/python3_venv` — has a live process (`rustdesk_dashboard/app.py`) running out of it. All `*audio*` dirs live under `/www/wwwroot/laravel_db/` (`worker_audio`, `agent_history_audio`, `tts_data/audio`, `static/app_qy_v1/audio`) — always excluded per user instruction (audio data).

**Still NOT touched (identified but deferred — ambiguous risk/ownership, flagged to user instead of deleting):** `/www/wwwroot/.tmp` (294M, owned by `lighthouse` user, looks like aapanel/BT panel installer temp dirs from Sep–Dec 2025, outside core_node scope); `/root/.rustup/toolchains` itself (1.4G, kept per project policy above); `/www/_debian_12` and `/www/_debian_13` non-postgres/venv subdirs (bun/go/node/pipx/omp, several hundred MB each) — these are the panel's per-OS sandboxed runtime installs, not caches, left alone since ownership/usage outside core_node wasn't fully verified; `/root/.codex/sessions` (364M AI session history logs) — not a cache, deferred rather than deleted.

**How to apply:** If a future git push/pull on this server fails with "No space left on device" or an unexplained non-fast-forward rejection, check `df -h /` first — it is very likely disk space, not a real conflict. Run both rounds of the cache-cleanup recipe above before troubleshooting git itself, then `git gc --aggressive --prune=now` on `.git` if it's grown large. Always verify a path is not live (`ps aux`, `mount`) before deleting anything outside `~/.cache`-style dirs, and always exclude `/www/wwwroot/laravel_db` (DB + audio data) unless the user says otherwise.
