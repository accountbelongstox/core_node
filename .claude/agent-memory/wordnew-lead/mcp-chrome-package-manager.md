---
name: mcp-chrome-package-manager
description: mcp-chrome uses bun workspaces; pnpm-workspace.yaml was removed on purpose; both lockfiles are git-ignored; stale native dist pitfall
metadata:
  type: project
---

apps/mcp-chrome is a bun monorepo: the root package.json has "workspaces" and bun scripts. f853d9489 (the pnpm to bun migration) deleted pnpm-workspace.yaml on purpose. `bun.lock` and `pnpm-lock.yaml` are git-ignored by the root .gitignore (`**/*.lock`, `apps/**/pnpm-lock.yaml`). pnpm ignores package.json workspaces, so regenerating `pnpm-lock.yaml` needs a temporary pnpm-workspace.yaml. The user's sweep commits pick up such temporary files, so delete it in the same step.

The native host runs `app/native-server/dist`. A source change reaches it only after `build:shared`, then native, then extension. Check dist mtimes against the src changes before trusting the running host.

**Why:** learned while reviewing mcp-chrome-D7 CKA-01 (2026-09-27). A pnpm-workspace.yaml deletion with no record turned out to be the member's own temporary file. The 03:13 dist still required @fastify/cors and had no K7 guard.

**How to apply:** do not restore pnpm-workspace.yaml as a "lost" file. Verify lockfiles with a grep plus a workspace-to-package.json compare. Require a rebuild before any install that prunes a dependency the stale dist still requires.
