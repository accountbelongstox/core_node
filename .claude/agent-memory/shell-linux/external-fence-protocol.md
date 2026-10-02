---
name: external-fence-protocol
description: a root/bridge session can run its own parallel workflow and fence shell-linux's own files (incl. linux.md); ca-orchestrator relays fence/release notices via docs_fix/TASK_*.md
metadata:
  type: project
---

Besides the normal `ca-orchestrator` (this team's leader), there can be a separate, higher-privilege "root lead" bridge session running its own workflow on the same repo (seen 2026-09-28: `wf_2f18793a-cd6` then `wf_f94596c0-150`/`wf_32047550-fd9`/`wf_32076b56-56a`, root lead session uid 0, task "finish the unfinished items of an earlier claudeteam-roles workflow"). It can fence any path, including ones normally in shell-linux's own write scope — `scripts/shells/linux/common/claude_team_common.sh`, `scripts/ai_shtools/claude_code_install.sh`, `scripts/linuxenvs/claude*.sh`, even `.claude/agents_shared/shell_parity/linux.md` itself (my own ledger).

`ca-orchestrator` relays both the fence and the release as plain cross-session messages, each pointing at a `docs_fix/TASK_YYYYMMDD_*.md` record with a ruling id (seen: R6 fence, in `docs_fix/DESIGN_CLAUDE_TEAM.md`; release detailed in `docs_fix/DESIGN_CLAUDE_TEAM.md`). The root lead can do real, reviewer-approved, multi-round work in that window and land it **uncommitted** (it does not run git write ops on its own — matches the standing "no git write without the user's own request" rule) with new parity-ledger rows already added in shell-linux's own row format/voice.

**Why:** two parallel "teams" (this debian-uid session set, and a root-uid session set) can be running against the same working tree at once. Without the fence, both could write the same launcher/ledger files and collide.

**How to apply:**
- On a fence notice: stop editing every named path immediately, including the parity ledger, even mid-edit. Any in-flight edit of mine gets forwarded to the other lead rather than clobbered.
- On a release notice: re-`Read` every previously-fenced file before any further edit — don't assume it's still what I last wrote. Check the reviews dir for new `orch-wf*-*.json` verdicts (already-approved work needs no re-verification, just absorption) and diff the ledger for new row ids so a next edit doesn't collide (seen: it renumbered a ledger row I'd just fixed, from SPL-123 to SPL-126, for its own consistency).
- Per R4 in these events: a fence release does not itself authorize new work — carried backlog stays on hold for the user's actual next task. Sync understanding, update the report/memory, and wait; don't proactively "finish" open findings just because the files are writable again.
- See also [[launcher-generator-parity]] and [[claudeteam-cross-os-contract]] — this fence most often lands on exactly those same launcher files.
