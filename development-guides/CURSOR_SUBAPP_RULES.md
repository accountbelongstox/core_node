# Cursor rules: multiple sub-apps (key points)

- **One rule file per sub-app.** Under `.cursor/rules/`, add `<app>.mdc` with frontmatter:
  - `description`: one-line summary
  - `globs: pyapps/<AppName>/**` (scope to that app only)
  - `alwaysApply: false`
- **No cross-app glob.** Each rule applies only to its own `pyapps/<AppName>/` tree; other pyapps are unaffected.
- **Canonical in app.** Sub-app keeps canonical standards in its own repo (e.g. `docs/PROJECT_STANDARDS.md` or `docs/CODE_STANDARDS.md`). Rule/skill/AGENTS.md reference it; avoid duplicating full text.
- **Optional AGENTS.md.** In sub-app root, `AGENTS.md` can point to canonical doc and `.cursor/rules/<app>.mdc` for agent instructions.
- **Optional skill.** For long instructions, `.cursor/skills/<app>/SKILL.md`; rule file stays short and references skill by section.
- **Shared conventions** (e.g. pycore third_party, imports at top) may be repeated per app or referenced from this guide; each app can add app-specific clauses.

**Using pycore:** Sub-apps that import pycore must add the path containing the `pycore` package to `sys.path` before any pycore import (e.g. walk up from `__file__` until a directory named `pycore` exists, then `sys.path.insert(0, that_dir)`). This ensures imports succeed when the process is started from the sub-app or a tool entry point.

Existing: `pyapps/d3-check` → `.cursor/rules/d3-check.mdc`, `pyapps/GameAISDK` → `.cursor/rules/game-aisdk.mdc`.
