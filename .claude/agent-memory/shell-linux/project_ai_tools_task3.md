---
name: project-ai-tools-task3
description: Task 3 of DESIGN_20260928_DD_TAILSCALE_OS_UPGRADE_AI_TOOLS.md (unified AI Tools & MCP) - what was built and where
metadata:
  type: project
---

Implemented 2026-09-28: single source of truth for every AI CLI install on
Linux, per docs_fix/DESIGN_20260928_DD_TAILSCALE_OS_UPGRADE_AI_TOOLS.md Task 3.

Core file (merged 2026-09-29, supersedes the earlier 3-file split):
- scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh owns the catalog
  (17 keys, incl. native_bin/legacy_* fields), shared login, per-tool official installs
  run AS THE REAL USER, legacy purge, /usr/local/bin links, --only/--upgrade/--list/--status/
  --shared-login. Sourceable (BASH_SOURCE guard); AI99_CATALOG_ONLY=1 skips the gvar load.
- common/ai_tools_catalog.sh, common/ai_shared_login.sh and install_shells 171/177/179/185
  were deleted; 153/155/165, ai_cli_provision_common, menus, piyolo/piark/*yolo launchers
  call 99. claude_code_install.sh keeps only claude_team_install (+ delegates install to 99).
- Do not `export -f` catalog functions: arrays do not export, so children see functions but
  an empty catalog; guard on AI_TOOLS_CATALOG_KEYS, not `command -v ai_catalog_get`.
- `VAR=1 source file` (prefix assignment) drops the sourced file's arrays; set the var first.
- kimi1/kimi2 (generated slot-isolated launchers) still carry their own curl installer on purpose.

mcp-chrome native-host fix: apps/mcp-chrome/scripts/native-host-common.cjs
getUserManifestPath used to resolve os.homedir() even when running as root via
sudo (installs under /root instead of the real user's ~/.config). Added
resolveRealUserHomeDir()/resolveRealUserIds()/fixManifestOwnership()/
registerSystemHost(); register-local-dev.cjs now registers BOTH user-level
(real user's home) and system-level (/etc/opt/chrome/...) manifests.

Windows mirror NOT built (explicitly out of scope, "Linux side" only):
StepXX_InstallAiTools.ps1 + win_common/AiToolsCatalog.ps1 + menu rewrite in
scripts/shells/win/menu_itemshells/MCPManagementMenu.ps1 and dd.ps1 still need
the same treatment - see [[feedback-shell-linux-windows-parity]] if that
memory exists, otherwise hand to shell-windows.

Shared-login env vars researched 2026-09-28 (cite before trusting - upstream
CLIs move fast): CLAUDE_CONFIG_DIR (official), CODEX_HOME (official),
KIMI_CODE_HOME (official), CLINE_DATA_DIR (official), CURSOR_CONFIG_DIR
(official). Gemini CLI/Qwen Code/Droid: no official env var found (Gemini's
GEMINI_CONFIG_DIR is an open feature request only). opencode: "partial"
(OPENCODE_CONFIG_DIR covers agents/commands only, XDG_CONFIG_HOME covers the
full config but is shared with every other XDG app).
