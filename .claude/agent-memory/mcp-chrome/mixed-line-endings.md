---
name: mixed-line-endings
description: apps/mcp-chrome .ts/.json files keep CRLF or mixed CRLF/LF bytes in git (no text attr); rewriting tools silently normalize them
metadata:
  type: feedback
---

Many files under `apps/mcp-chrome/` (extension `.ts`, `_locales/*/messages.json`, `packages/shared/src/types.ts`) are stored in git with CRLF or mixed CRLF/LF, and `.gitattributes` only sets `eol` for `.sh/.bat/.cmd/.ps1`. Python `read_text()/write_text()`, `json.dump`, and Edit on mixed-ending files normalize to LF and turn a 2-line change into a whole-file diff.

**Why:** a locale key insertion rewrote all 2,000+ lines of six locale files; a listener edit rewrote whole listeners. Reviewers cannot see the real change.

**How to apply:** after any scripted edit, compare `grep -c $'\r$'` against `git show HEAD:<file>`; edit bytes (`read_bytes`, insert with the file's own newline), and restore per-line endings from HEAD for unchanged lines when a tool normalized them. `.bat` files are CRLF on disk but LF in HEAD (eol=crlf), so exclude them from HEAD-based restores.
