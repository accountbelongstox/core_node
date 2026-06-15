# How to Update Cursor AI Rules and Specifications

This guide explains where Cursor rules live, how to edit them, and how to avoid conflicts. Canonical rules location: `.cursor/rules/`. Cursor CLI `/rules` command: see [Cursor CLI Agent Skill](../.agents/skills/cursor-agent/SKILL.md) (project skill under `.agents/skills/cursor-agent/`).

---

## 1. Where Cursor Loads Rules

Cursor loads rules from:

- **`.cursor/rules/`** – Project rules (`.mdc` files with optional globs).
- **`AGENTS.md`** – Optional project-level agent instructions.
- **`CLAUDE.md`** – Optional project-level instructions.

Rules under `.cursor/rules/` are the main place to define project-specific behavior (e.g. dot, dot-ui, pycore, d3-check).

---

## 2. Rule File Format (`.mdc`)

Each rule file should have **YAML frontmatter** and body:

```yaml
---
description: "Short one-line summary for Cursor."
globs: "path/pattern/**"    # Optional: limit to certain paths (e.g. dotapps/**)
alwaysApply: false         # Optional: true = always on; false = only when matching glob/context
---

# Rule title

Body text: what the AI must follow. Prefer referencing a canonical doc instead of pasting long text.
```

- **description:** Shown in rule list; keep it one line.
- **globs:** Limit rule to files under that path (e.g. `dotapps/**`, `dotcore/**`, `pyapps/d3-check/**`). Omit to apply project-wide when the rule is selected.
- **alwaysApply:** `false` = rule applies when context matches glob or user invokes it; `true` = always applied (use sparingly).

---

## 3. How to Edit Rules

- **Manual:** Edit files under `.cursor/rules/*.mdc` in the repo. Commit changes so the whole team gets the same rules.
- **From Cursor CLI:** In an interactive agent session, use the **`/rules`** command to create or edit rules (see Cursor docs for current CLI behavior).

After editing, Cursor will pick up changes when the rule is next loaded (e.g. open a file under the rule’s glob or start a new chat).

---

## 4. Keeping One Source of Truth (Avoid Duplication)

- Put **long or detailed specs** in `development-guides/` (e.g. `DOT_ARCHITECTURE.md`, `DOT_ARCHITECTURE.md`).
- **Rule files** (.mdc): state scope (globs), point to the canonical doc, and list a few bullet points. Do not copy the full spec into the rule.
- **Other documents**: When a doc describes UI or Presentation layer structure, **reference** the canonical spec (DOT_ARCHITECTURE.md); do not duplicate or redefine folder layout, naming, or Fluent 2 rules there.
- **Conflict resolution**: Any document that conflicts with or duplicates UI/Presentation content must be **updated to defer** to `DOT_ARCHITECTURE.md` and `.cursor/rules/dot-ui.mdc` (e.g. replace in-place definitions with "UI layer: see DOT_ARCHITECTURE.md").
- Sub-apps can keep their own canonical doc (e.g. `docs/PROJECT_STANDARDS.md`) and have a rule that references it (see [CURSOR_SUBAPP_RULES.md](CURSOR_SUBAPP_RULES.md)).

---

## 5. Avoiding Conflicts Between Rules

- **One concern per rule.** Examples: `dot.mdc` = layout + language for dotcore/dotapps; `dot-ui.mdc` = UI layer (Clean Architecture, MVVM, Fluent 2) for dotapps; `d3-check.mdc` = d3-check app only.
- **Scope by glob.** Use `globs` so each rule applies only to the relevant paths (e.g. `dotapps/**` for dot-ui, `pyapps/d3-check/**` for d3-check). This reduces overlap and conflict.
- **Precedence for UI/Presentation:** If any document or rule conflicts with `DOT_ARCHITECTURE.md` or `.cursor/rules/dot-ui.mdc` on UI structure, Fluent 2, or Presentation layer, **DOT_UI_PROJECT_SPECIFICATION and dot-ui.mdc win**; do not add alternative UI rules elsewhere.
- **General:** When two rules could conflict, the more **specific** glob wins for that path. Prefer stating in the rule: "In case of conflict with dot.mdc, follow DOT_ARCHITECTURE for layout/language; follow this rule for UI structure only."

---

## 6. Updating or Adding a .NET UI (or Other) Specification

1. **Write or update the canonical doc** in `development-guides/` (e.g. `DOT_ARCHITECTURE.md`). Put all detailed rules there.
2. **Add or update a rule** in `.cursor/rules/` (e.g. `dot-ui.mdc`):
   - Set `description` and `globs` (e.g. `dotapps/**`).
   - Set `alwaysApply: false` unless you want it always on.
   - In the body, reference the canonical doc and summarize the main obligations (layers, naming, design system).
3. **Resolve conflicts:** If the new spec overlaps with an existing rule (e.g. dot.mdc), clarify in the new rule that base layout/language come from DOT_ARCHITECTURE/dot.mdc, and this rule only adds UI/Presentation conventions.
4. **Commit** the doc and the `.mdc` file so everyone uses the same Cursor behavior.

**When DOT_ARCHITECTURE.md changes:** (1) Update the canonical doc in `development-guides/DOT_ARCHITECTURE.md`. (2) Update `.cursor/rules/dot-ui.mdc`: keep the body as a short summary that reflects the spec (layers, structure, naming, Fluent 2); do not copy the full spec. (3) Any other document that describes UI or Presentation layer structure must defer to this canonical spec; do not duplicate or contradict it (e.g. "UI layer: see DOT_ARCHITECTURE.md").

---

## 7. Quick Reference

| Goal                         | Action |
|-----------------------------|--------|
| Change what AI does in dotapps | Edit `development-guides/DOT_ARCHITECTURE.md` or `DOT_ARCHITECTURE.md`, then `.cursor/rules/dot.mdc` or `dot-ui.mdc`. |
| Change UI/Presentation spec   | Edit `DOT_ARCHITECTURE.md`, then `.cursor/rules/dot-ui.mdc`; other docs must defer to this canonical spec. |
| Update conflicting docs       | Per **DOT_UI_PROJECT_SPECIFICATION** and this guide: any doc that defines or duplicates UI/Presentation structure must be updated to **reference** the canonical spec only (e.g. "UI layer: see DOT_ARCHITECTURE.md"); remove in-place redefinitions. |
| Add a new sub-app rule      | Create `.cursor/rules/<app>.mdc` with glob `pyapps/<AppName>/**` or `dotapps/<AppName>/**`; reference app's canonical doc. |
| Edit rules from CLI         | Use `/rules` in Cursor agent session (see `.agents/skills/cursor-agent/SKILL.md`). |
| Single source of truth      | Long text in `development-guides/` or app `docs/`; rules only reference and summarize. |
