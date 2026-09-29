---
name: project-ai-tools-task3
description: Task 3 of DESIGN_20260928_DD_TAILSCALE_OS_UPGRADE_AI_TOOLS.md (unified AI Tools & MCP) - what was built and where
metadata:
  type: project
---

Implemented 2026-09-28: single source of truth for every AI CLI install on
Linux, per docs_fix/DESIGN_20260928_DD_TAILSCALE_OS_UPGRADE_AI_TOOLS.md Task 3.

Core new files:
- scripts/shells/linux/common/ai_tools_catalog.sh - the catalog (17 keys:
  claude, codex, gemini, qwen, cursor_agent, kimi, cline, arkcli, superclaude,
  opencode, auggie, droid, zhipuai, bun, pi, omp, agy). ai_catalog_get/has/keys.
- scripts/shells/linux/common/ai_shared_login.sh - root<->real-user config-dir
  sharing (profile.d + sudoers env_keep, ownership repair).
- scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh - the
  installer (--only key[,key], --list, --status; default = ensure all + mcp-chrome).

Old numbered steps (153 AI group, 155 cursor_agent, 165 agy, 171 claude, 177
qwen, 179 zhipuai, 185 pi/omp/bun) are now thin delegates to 99 --only <key>.
Chain ordering works because install_test_menu.sh sorts install_shells/*.sh
NUMERICALLY (99 < 153), so 99 always runs first and the old steps become
instant no-ops when the chain reaches them.

Menu renamed "AI & MCP Management" -> "AI Tools & MCP" in
scripts/shells/linux/dd_helper/linux_management.sh (single line, per
concurrent-agent scoping) and rewritten in
scripts/shells/linux/menu_itemshells/menu_func/ai_mcp_management_menu.sh.

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
