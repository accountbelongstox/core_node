---
name: feedback-opus-everywhere
description: User requires Claude Opus 5.5 for every role session, teammate, subagent and workflow agent; built-in agent types (claude-code-guide, Explore) silently default to Haiku
metadata:
  type: feedback
---

Every session and agent in the core_node team runs Claude Opus 5.5 (`claude-opus-5-5`): the lead, the teammates, the subagents including the built-in types, the workflow agents and the remote role.

**Why:** 2026-09-27 (D11). The user saw the docs-check workflow's `claude-code-guide` agents running on Haiku 4.5 in /workflows and asked for Opus 5.5 everywhere, set by default in claudeteam/claudeagents.

**How to apply:** In Workflow scripts, pass `model: 'opus'` on every `agent()` call whose agentType is a built-in type (claude-code-guide, Explore, Plan, general-purpose), or on every call to be safe. With the Agent tool, pass `model: "opus"` for built-in types. Custom role types inherit the lead's model unless their frontmatter pins one. After launching, check the model in the transcripts: grep `"model":` in `subagents/workflows/<run>/agent-*.jsonl`. Related: [[remote-role-messaging]].
