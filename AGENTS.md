# core_node — AI rules
**Git:** No git operations at all (not even commit) unless explicitly asked. Otherwise edit code freely.
**Code:** Write code/comments/logs in English. No test code — don't create, run, or modify it. No progress summaries inside source files. Declare variables at the top of the file. In PowerShell, don't append strings directly to variables and don't use relative paths — resolve with `Split-Path` / `Join-Path` / `Resolve-Path`.
**Pycore imports:** Keep imports at file top and refactor cycles; `pyfoundations` imports no higher pycore layer, `pyutils` modules do not import each other and depend only on `pyfoundations`, and `pyctl` may depend on `pyutils`.
**Modular:** Split any source file over 800 lines into small reusable components; before adding or extracting one, scan the project for a similar component and reuse/upgrade it first.
**Run:** Shell commands are allowed; never run builds, tests, services, or verification unless explicitly asked.
**Concise:** Condense every rule and core requirement to the irreducible minimum — if it can be shorter, make it shorter; never restate what the AI already knows.
