---
name: preserve-line-endings
description: many ncore/apps files are CRLF or mixed CRLF/LF per line; scripted edits must keep each line's ending
metadata:
  type: feedback
---

Several files in scope are CRLF (e.g. `ncore/callmodule/app.js`, `apps/dingdoudou/lib/superCode.ts`, `ncore/ncore_backend_main.py`) and some are mixed per line (dingdoudou `background.ts`, `Popup.tsx`, `uiI18n.ts`). A Python `open(p).read()`/`write` round trip silently converts them to LF and turns a small change into a whole-file diff.

**Why:** reviewers flag CRLF→LF churn (it happened once in this repo and had to be reverted).

**How to apply:** check `file <path>` before scripted edits; replace on bytes and match `\r?\n` per line, writing the replacement with the ending found in the matched region. Compare `git show HEAD:<path> | grep -c $'\r'` with the working copy afterwards.
