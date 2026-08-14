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

**Git:** No git operations unless explicitly asked.

**Code:** Write code, comments, and logs in English. Do not hardcode language strings; use i18n. Do not create, run, or modify tests. Do not put progress summaries in source files. Declare variables at file top. PowerShell must use Split-Path, Join-Path, or Resolve-Path and must not append strings directly to variables.

**Compatibility:** Code must be compatible with Windows and Linux (Ubuntu, Debian, Kali) simultaneously, except for platform-specific scripts (.ps1 / .sh).

**Documentation:** Code is documentation. Unless explicitly requested, do not add documentation in the code.

**Pycore:** For work under `pycore`, use `development-guides/PYTHON_PYCORE.md`.

**Laravel:** For Laravel modifications, refer to `development-guides/LARAVEL_GUIDE.md`.

**MCP Chrome:** For mcp-chrome modifications, refer to `development-guides/MCP_CHROME_GUIDE.md`.

**Shell:** For shell scripts, refer to `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`. Shell scripts must use English. Never run builds, tests, services, or verification unless asked. Callers trust resolved PS1/SH references without existence/status checks. Installers repair only missing binaries, files, or pip packages and otherwise run. PowerShell does not parse versions with regex or enforce fine package versions. Hardcode compatibility only at ABI-major boundaries or delegate to pip. Do not use exit codes for return values.

**Concise:** Reduce every rule and core requirement to its shortest complete form; do not restate known context.
