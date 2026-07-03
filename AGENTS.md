# core_node — AI rules
**Git:** `git commit` only (local). No rollback, no other git ops, no push unless asked. Otherwise edit code freely.
**Code:** Write code/comments/logs in English. No test code — don't create, run, or modify it. No progress summaries inside source files. Declare variables at the top of the file. In PowerShell, don't append strings directly to variables and don't use relative paths — resolve with `Split-Path` / `Join-Path` / `Resolve-Path`.
**Modular:** Split any source file over 1000 lines into small reusable components; before adding one, reuse or upgrade an existing similar one.
**Run:** run external/long commands live, attached to the console (no `Out-Null`/piped-stdin suppression, no exit-code-only checks) in ps1/sh/py alike.
**Concise:** Condense every rule and core requirement to the irreducible minimum — if it can be shorter, make it shorter; never restate what the AI already knows.
