---
name: bash-exec-optimization-erases-test-argv
description: When live-testing a --name/-n (or any /proc/PID/cmdline argv-matching) bash function in WSL, a naive `sleep 300 --name X &` or `bash -c 'sleep 300' extra --name X &` background job loses the extra argv — bash tail-call-execs into the final simple command, replacing its own image
metadata:
  type: project
---

Testing `claude_team_named_pid()` (matches `--name`/`-n <session>` in a live process's `/proc/PID/cmdline`, used for the D13 launcher idempotency rule) needs a background process whose *own* argv literally contains `--name ct-session` or `-n ct-session`, imitating a real `claude --name ct-role ...` invocation. Two naive attempts failed silently:
- `sleep 300 --name ct-testrole1 &` — `sleep` itself rejects the unrecognized `--name` option and exits immediately, so there's no live PID to find at all.
- `bash -c 'sleep 300' extra --name ct-testrole1 &` — bash's argv for the `bash` process invocation *does* include `-c`, `sleep 300`, `extra`, `--name`, `ct-testrole1`, but when a `bash -c` command string's sole/last statement is a single simple external command, bash tail-call-execs directly into it (replacing its own process image without forking), so `/proc/PID/cmdline` ends up showing only `sleep|300`, not the original bash argv.

**Why:** this cost two failed test rounds before finding a reliable pattern; worth keeping so a future test of this exact function (or anything else that greps `/proc/PID/cmdline` for a marker) doesn't repeat the same detour.

**How to apply:** to keep a wrapper process's own argv visible in `/proc/PID/cmdline` while it stays alive, make the wrapper explicitly *not* be a single tail-callable command — background the real work and `wait` on it: a script containing `sleep 300 & child=$!; trap 'kill $child' EXIT; wait "$child"`, invoked as `./wrapper.sh --name ct-testrole1 &`, keeps the wrapper's own bash process alive (with `--name ct-testrole1` genuinely in its `/proc/PID/cmdline`) while `sleep` runs as its child. Then `pgrep -f -- "(--name|-n) <session>"` plus an `awk` token check on that PID's cmdline can be tested for real, in both the `--name` and `-n` forms, without needing the actual `claude` binary.
