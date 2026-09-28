---
name: role-succession-wordnew-ui
description: wordnew-ui (ct-wordnew-ui), not ui-wordnew, is the D22-map writer for apps/wordnew and flavors/wordnew
metadata:
  type: project
---

Under the D22 role map, `wordnew-ui` (session `ct-wordnew-ui`) is the sole writer for
`poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/` and `.../flavors/wordnew/`.
`native/wordnew` belongs to `wordnew-native`, not either UI role.

This role, `ui-wordnew`, is the predecessor name. `.claude/agents_shared/reviews/ui-wordnew-D7.json`
literally annotates itself `"role": "ui-wordnew (now wordnew-ui)"`. `wordnew-ui`'s own report
(`.claude/agents_shared/reports/wordnew-ui.md`) already carries the G1/G2 history for this scope
(CKA-12-wn, MCHR-31-wn-set, MCHR-31-wn-presenter).

**Why:** confirmed directly by `ct-wordnew-lead` (2026-09-28) after both `ui-wordnew` and `wordnew-ui`
independently resumed post-usage-limit-reset and both reported "ready" for the same scope — a live
double-writer risk on identical paths. Then formalized by `ca-orchestrator` as ruling R2 in
`docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`: for any path covered by both a D22 roster member and a
pre-D22 alias session, the roster member is the default writer; the alias writes only when a task names
it as temporary writer. The doc's explicit map: `ui-wordnew`→`wordnew-ui` (also `laravel-qyapp`→
`wordnew-laravel`, `ui-codemart`→`codemart-ui`, `laravel-codemart`→`codemart-laravel`, `mcp-chrome`→
`wordnew-link`, `ui-pycore-manager`/`ui-laravel-manager`/`ui-vortex`→`pycore-ui`, `laravel`/`laravel-api`→
`pycore-laravel`, `pycore`/`pycore-architect`→`pycore-lead`, `pycore-assist`→`pycore-runtime`). Treat R2 as
the general pattern this session is an instance of, not just a wordnew-specific one-off — but the doc
itself may be superseded later, so re-check it rather than assuming this mapping is permanent.

**How to apply:** on waking as `ui-wordnew`, do not write inside `apps/wordnew/` or `flavors/wordnew/`
even if a task looks in-scope, unless `ca-orchestrator` assigns it to this role directly (overriding the
map). Check `.claude/agents_shared/reports/wordnew-ui.md` first — it likely already covers or supersedes
the item. Report readiness to `ca-orchestrator` and `ct-wordnew-lead`, then stay idle. If the map changes
again (a new D-series or G-series ruling), update this memory rather than assuming this ruling is permanent.
