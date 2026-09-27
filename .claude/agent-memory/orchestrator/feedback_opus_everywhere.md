---
name: feedback-opus-everywhere
description: Model policy for the core_node team — latest models only (opus = Opus 5.5 for thinking roles, sonnet = Sonnet 5 allowed for coding roles); built-in agent types silently default to old Haiku
metadata:
  type: feedback
---

Only the newest models run in the team, never an old one:
- The thinking roles (orchestrator, reviewer, the laravel and pycore coordinators, pycore-architect, laravel-remote) use `model: opus`, which is Opus 5.5 today.
- The coding roles may use `model: sonnet` (Sonnet 5).
- Every role has `effort: xhigh`, because Opus 5.5 defaults to medium.
- Use aliases, not pinned IDs, so the roles follow new releases.

**Why:** On 2026-09-27 the user saw built-in `claude-code-guide` agents on Haiku 4.5 and asked for Opus 5.5 everywhere (D11). Later the same day it refined the rule (D13): Opus for long thinking; a fast model is fine for coding, but it "must be latest, never old".

**How to apply:**
- The per-role model lives in the `.claude/agents/*.md` frontmatter.
- In Workflow scripts, pass `model: 'opus'` on every built-in agentType (claude-code-guide, Explore, Plan, general-purpose). Workflow agents inherit the lead's model unless `model` is given; custom-type frontmatter was not observed to apply inside workflows.
- Check models via `"model":` in `subagents/workflows/<run>/agent-*.jsonl`.

Related: [[remote-role-messaging]], [[parallel-user-sessions]].
