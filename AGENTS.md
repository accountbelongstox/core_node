# Codex Global Instructions

- Write all code, comments, logs, and commit messages in English.
- Follow project AGENTS.md and CLAUDE.md conventions.
- Reuse or upgrade existing components before creating new ones.
- Keep changes minimal, idempotent, and aligned with surrounding style.
- Never execute destructive actions without explicit approval.
- Declare variables at file top; use resolved absolute paths in PowerShell.

# core_node AI rules

**Git:** No git operations unless explicitly asked.

**Code:** Write code, comments, and logs in English. Do not create, run, or modify tests. Do not put progress summaries in source files. Declare variables at file top. PowerShell must use Split-Path, Join-Path, or Resolve-Path and must not append strings directly to variables.

**Pycore layers:** pyfoundations contains only lowest OS/runtime primitives and imports no higher Pycore layer. database owns all engines, schemas, migrations, repositories, durable state, and shared persistence types; it may depend only on pyfoundations. pyutils domains may depend on pyfoundations and database but not on other pyutils domains. pyctl may orchestrate pyutils, database, and pyfoundations. Direct database-driver use outside pycore/database is forbidden. Refactor cycles; do not hide them with local imports.

**RPC v2:** WebSocket is the canonical full-duplex RPC/event transport. Durable server events use client_id, event_id, seq, ACK, and replay. SSE is compatibility-only. Qwen3TTS uses the shared RPC v2 WebSocket stack.

**Modular:** Split source files over 800 lines into reusable components. Before adding or extracting one, scan for and reuse an existing equivalent.

**Shell:** Never run builds, tests, services, or verification unless asked. Callers trust resolved PS1/SH references without existence/status checks. Installers repair only missing binaries, files, or pip packages and otherwise run. PowerShell does not parse versions with regex or enforce fine package versions. Hardcode compatibility only at ABI-major boundaries or delegate to pip.

**Concise:** Reduce every rule and core requirement to its shortest complete form; do not restate known context.