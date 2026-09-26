# Codex Global Instructions

- Write all code, comments, logs, and commit messages in English.
- Do not hardcode language strings in code; use multi-language (i18n). Shell scripts must use English.
- Global standards take precedence and stack with any specific .md guides.
- Reuse or upgrade existing components before creating new ones.
- Refactor to align underlying logic: extract centralized shared classes, remove duplicate implementations, and centralize global constants.
- Never execute destructive actions without explicit approval.
- Declare variables at file top; use resolved absolute paths in PowerShell.

# core_node AI rules

**Global Precedence:** Global standards in this file take precedence and stack with any specific `.md` guides.

**Git:** Read-only git commands (status, diff, log, show, blame, listing forms) are always allowed. Any other git operation only when the user's prompt asks for it.

**Code:** Write code, comments, and logs in English. Do not hardcode language strings; use i18n. Do not create or modify tests unless asked. Run tests and verification when the user asks, and on the server (the server-side Laravel role verifies its changes there). Do not put progress summaries in source files. Declare variables at file top. PowerShell must use Split-Path, Join-Path, or Resolve-Path and must not append strings directly to variables.

**Compatibility:** Code must be compatible with Windows and Linux (Ubuntu, Debian, Kali) simultaneously, except for platform-specific scripts (.ps1 / .sh).

**Documentation:** Code is documentation. Unless explicitly requested, do not add documentation in the code.
**AI-Client Communication:** When AI-to-client communication or interaction is requested, read `docs_fix/CODESYNC_AI_COMMUNICATION_API.md`.

**Pycore:** For work under `pycore`, use `development-guides/PYTHON_PYCORE.md`.

**Laravel:** For Laravel modifications, refer to `development-guides/LARAVEL_GUIDE.md`.

**MCP Chrome:** For mcp-chrome modifications, refer to `development-guides/MCP_CHROME_GUIDE.md`.

**Shell:** For shell scripts, refer to `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`. Shell scripts must use English. Never run builds or services unless asked; run tests and verification when asked or on the server. Callers trust resolved PS1/SH references without existence/status checks. Installers repair only missing binaries, files, or pip packages and otherwise run. PowerShell does not parse versions with regex or enforce fine package versions. Hardcode compatibility only at ABI-major boundaries or delegate to pip. Do not use exit codes for return values.

**Kimi:** When running as a Kimi model, do not use the multi-Agents mode (Agent/AgentSwarm subagents); complete all work directly in the current agent. Use Edit for code changes; never use Write for long content.

**Concise:** Reduce every rule and core requirement to its shortest complete form; do not restate known context.
