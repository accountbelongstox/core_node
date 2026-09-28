---
name: feedback-opus-everywhere
description: Model policy for the core_node team: latest models only (Opus 5.5 or Sonnet 5, never an old one). The current guide §2 and frontmatter put roles on sonnet/high, and the lead on opus/medium. Built-in agent types silently default to old Haiku.
metadata:
  type: feedback
---

Only the newest models run in the team, never an old one. Use aliases (`opus`, `sonnet`), not pinned IDs, so the roles follow new releases.

**Current state (checked 2026-09-28):**
- Guide §2 and the frontmatter: the lead (orchestrator) runs `claude-opus-5-5` at medium effort.
- Every coding role runs `sonnet` at high effort, except pycore-architect, which runs `opus`.
- Complex architecture or root-cause work: name `opus` in that teammate's spawn prompt.
- This replaced the 2026-09-27 D11/D13 setup, where the thinking roles ran opus at xhigh; the rework was unrecorded.
- Trust the current frontmatter and guide over this note.

**Why:** On 2026-09-27 the user saw built-in `claude-code-guide` agents on Haiku 4.5 and asked for Opus 5.5 everywhere (D11). Later that day it refined the rule (D13): Opus for long thinking; a fast model is fine for coding, but it "must be latest, never old".

**How to apply:**
- In Workflow scripts, pass `model` explicitly on every agent: the role's frontmatter model for custom types, and `'opus'` for the built-ins (claude-code-guide, Explore, Plan, general-purpose). Otherwise workflow agents inherit the lead's model.
- Check the models afterwards via `"model":` in `subagents/workflows/<run>/agent-*.jsonl`. The run wf_dbfee9ab-4e1 confirmed that an explicit `model` applies.
- Launch workflows only while the shell cwd is the repo root. A cwd of `.claude/agents` made the harness create empty `.claude/agents/.claude/agent-memory/<role>` dirs, and a role then reported a false memory-path defect.

Related: [[remote-role-messaging]], [[parallel-user-sessions]], [[stuck-onboarding-panes]].
