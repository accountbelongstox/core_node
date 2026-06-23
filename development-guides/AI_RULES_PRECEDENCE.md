<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md) UNLESS the user explicitly asks for it. -->
<!-- - Do not modify these rules. -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# AI-Rule Precedence & Conflict-Resolution Specification (mandatory)

**Status: enforced.** The canonical rule for how core_node's AI instruction files are
layered across tools and how a conflict *between rules* is resolved. (GIT / merge-conflict
resolution is a different concern — see [GIT_AND_NO_REVERT_SAFETY.md](GIT_AND_NO_REVERT_SAFETY.md) §3.)
Verified against each tool's official documentation (see Sources).

## 0. Which file each tool actually reads

- **Claude Code** reads `CLAUDE.md` (NOT `AGENTS.md`) + `./.claude/rules/*.md` + user/managed `CLAUDE.md`.
- **Cursor** reads `.cursor/rules/*.mdc` AND `AGENTS.md` (project root + nested subdirectories). A plain `.md` placed in `.cursor/rules` is ignored.
- **OpenAI Codex** reads `AGENTS.md`, walking up from the working directory to the git root, plus `~/.codex/AGENTS.md`.
- **Gemini CLI** reads `GEMINI.md`.

Therefore the same canonical mandatory rules MUST be carried, byte-consistent, in
`CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`, and summarized in `.cursor/rules/*.mdc`. Keep them in sync — never let one drift.

## 1. Rules are CONTEXT, not enforcement

Every tool injects these files as model context, not as a hard gate (Claude Code: rules
are "context, not enforced configuration"). A rule's *text* alone therefore cannot
guarantee a hard safety property. **Hard guarantees — core_node deletion safety, git
commit-only / no-revert — MUST be backed by enforcement**, not wording: the
`confirm_core_node_deletion` guard, sync/CI scripts that default to commit-only, and (for
Claude Code) a `PreToolUse` hook. Rule text states intent; enforcement makes it binding.

## 2. How each tool resolves a conflict (official behavior, verified)

- **Claude Code** — all discovered `CLAUDE.md`/rules are *concatenated into context, not
  overriding each other*; load order managed → user → project → local, root → cwd (closer
  read last). On contradiction, "Claude may pick one arbitrarily." ⇒ the only reliable rule is **do not contradict**.
- **Cursor** — "Rules are applied in this order: Team Rules → Project Rules → User Rules.
  All applicable rules are merged; earlier sources take precedence when guidance conflicts." (broader/earlier tier wins).
- **Codex** — files are concatenated root → down; "files closer to your current directory
  override earlier guidance"; "the closest AGENTS.md to the edited file wins; explicit user chat prompts override everything." (closest/most-specific wins).

These directions DIFFER (Cursor: broader wins; Codex: closest wins; Claude: arbitrary), so
**core_node never relies on cross-rule override** — a layout that "works" in one tool would misbehave in another.

## 3. The canonical resolution — single source of truth, zero contradictions

1. **One concern per rule**, scoped by the narrowest `globs` / `paths` / nested directory.
   Never two rules defining the same thing differently.
2. **Long specs live ONCE** in `development-guides/` (or a sub-app's `docs/`). Every rule
   file only references the canonical doc and summarizes a few obligations — never paste,
   duplicate, or redefine the spec elsewhere. A doc that duplicates another's structure must
   be updated to defer ("see &lt;canonical&gt;") and delete its in-place redefinition.
3. **The mandatory safety rules are top priority** — path-conversion, core_node deletion
   safety, git & no-revert. No narrower rule may weaken or contradict them; they are
   identical across `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` and backed by enforcement (§1).
4. **A narrower-scoped rule REFINES, never contradicts, a broader one.** When two rules
   could both apply, the more specific one adds detail *within the bounds* of the broader
   rule and the canonical doc — it never negates it.
5. **When a genuine conflict is unavoidable, STOP and surface it** to the human, then fix
   the canonical doc so the contradiction is removed at the source. Never silently pick a side.

## 4. Keeping the four agents in sync

`CLAUDE.md`, `AGENTS.md`, `GEMINI.md` carry the identical mandatory-rules block; `.cursor/rules/*.mdc`
carry the same obligations as `alwaysApply: true` (safety) or glob-scoped rules that reference
the canonical `development-guides/` docs. Any edit to one of the four entrypoints MUST be
mirrored to the others **in the same commit**. (Claude Code also supports an `@AGENTS.md`
import or a symlink to dedupe; this repo keeps explicit parallel files for clarity, which only
works if they stay byte-consistent.)

## Sources (official documentation, verified June 2026)

- Claude Code memory & precedence: https://code.claude.com/docs/en/memory
- Cursor rules (`.mdc`, types, precedence): https://cursor.com/docs/context/rules
- OpenAI Codex / AGENTS.md spec: https://agents.md and https://developers.openai.com/codex/guides/agents-md

## Why

core_node's instructions must reach four agents whose official conflict-resolution
directions disagree. Relying on override would behave differently per tool; single source of
truth + no contradiction is the only model that is correct everywhere.
