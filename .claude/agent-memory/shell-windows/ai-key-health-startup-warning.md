---
name: ai-key-health-startup-warning
description: How the startup AI-key warning works (pycore key_health + AiKeyHealthWarning.ps1 / ai_key_health_warning.sh) and how to test it without touching secrets
metadata:
  type: project
---

Probe verdicts (ok/unauthorized/forbidden + 12-char SHA-256 fingerprint + secret name) are stored in `<AI state dir>/ai_key_health.json` by `ai_probe._probe_live` via `pycore/pyctl/ai/key_health.py`; `python -m pycore.pyctl.ai.key_health key-status [--all]` prints TSV rows. Helpers: `win_common/AiKeyHealthWarning.ps1` (pyservice.ps1 after Resolve-Python, dd.ps1 after the secret checks) and `linux/common/ai_key_health_warning.sh` (sourced by pyservice_entry.sh, invoked by dd.sh main after ensure_secret_keys_ready).

**Why:** a changed key must stop the warning without a re-probe, so the CLI compares the stored fingerprint with the current raw secret via `peek_secret_key` (never decrypts or prompts).

**How to apply:** to test a "changed key" without editing secrets, copy the state file to `<scratch>/<x>/pycore/.ai_state/` and run with `CORE_NODE_CACHE_DIR=<scratch>/<x>` (PYCORE_LOCAL_DATA_DIR is ignored). In Git Bash `python3` is the WindowsApps stub; use `/d/.dev_win10/python313/python.exe`, and never run `python -` before a heredoc command (it hangs reading stdin).
