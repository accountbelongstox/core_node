---
name: secret-password-runner
description: Node secret tools (encrypted .js, bundles, disguise.js, batch_decrypt.js) must get the password via scripts/encryption_tools/secret_password_runner.js on stdin, never argv
metadata:
  type: project
---

Committed encrypted files (`.secret_keys/already_encrypted/*.js`, bundles, `scripts/git/git.ssh.id.ed*.js`) have a baked-in argv interface `pwd PASSWORD OUT_DIR`; they cannot be regenerated without the password. The runner reads stdin, swaps the `--password-stdin` placeholder into the tool's in-memory argv, sets umask 077 and calls `Module.runMain()` (works on Node 24 Windows and 26 Linux).

Helpers: bash `secret_tool_run <pw> <sudo-prefix|""> <node> <tool.js> args...` and `secret_read_hidden VAR PROMPT` in scripts/shells/linux/common/secret_tool_common.sh; PowerShell `Invoke-SecretPasswordTool` in GlobalVarStoreCommon.ps1 with `$Global:SECRET_PASSWORD_ARG` / `$Global:SECRET_PASSWORD_RUNNER_JS` from GlobalVars.ps1.

**Why:** IS-010 (2026-09-27): argv passwords are readable by every local account via /proc/<pid>/cmdline.

**How to apply:** any new secret decrypt/encrypt call site uses these helpers. See [[crlf-mixed-line-endings]] when editing the Python callers.
