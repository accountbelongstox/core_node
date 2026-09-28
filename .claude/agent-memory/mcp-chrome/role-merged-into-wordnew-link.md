---
name: role-merged-into-wordnew-link
description: apps/mcp-chrome ownership moved from the mcp-chrome role to wordnew-link after the D22 team reorg; confirmed by orchestrator ruling R2
metadata:
  type: project
---

As of the D22 reorg (2026-09-27, `.claude/agents_shared/client_key_auth/TASKS.md` line "D22-orch": "groups: 16 roster roles in 5 groups + remote + service ... 13 roles retired"), `apps/mcp-chrome` ownership moved from the standalone `mcp-chrome` role to `wordnew-link` (agent type description: "owns apps/mcp-chrome (extension + native host) and builds the wordnew-side glue to pycore"). Confirmed by `.claude/agents_shared/reviews/mcp-chrome-D7.json`, which labels itself `"role": "wordnew-link (old role mcp-chrome)"`, and by `.claude/agents_shared/reports/wordnew-link.md`, which shows wordnew-link continuing mcp-chrome work under labels like `wordnew-link-G2` (CKA-01 build/verify, MCHR-05/15/32/33/36/37/43/45).

**Confirmed 2026-09-28** by orchestrator ruling R2 in `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`: "Default writer for a path covered by both a D22 roster member and a pre-D22 alias session is the roster member ... Map: ... `mcp-chrome`→`wordnew-link` ... One writer per path; the roster members hold the post-D22 history." `ca-orchestrator` messaged this directly to ct-mcp-chrome: "wordnew-link is the default writer for apps/mcp-chrome. You stay in reserve and edit only when a task names you as temporary writer."

**Why:** the reorg consolidated 13 of the original roster roles into 5 functional groups; mcp-chrome's scope folded into the wordnew group since mcp-chrome's main consumer is the wordnew Laravel/native-host linkage. One writer per path avoids two sessions editing the same files.

**How to apply:** a `ct-mcp-chrome` session (this is a pre-D22 alias, not a roster member) is now a reserve/alias role for `apps/mcp-chrome`, not the default writer. Stay idle and do not edit `apps/mcp-chrome` unless a specific task explicitly names `mcp-chrome` as temporary writer. Check `.claude/agents_shared/reports/wordnew-link.md` and `reviews/*wordnew-link*.json` for what wordnew-link has already done before ever picking up scoped work here, to avoid duplication. Report status to `ca-orchestrator` and wait for its go.
