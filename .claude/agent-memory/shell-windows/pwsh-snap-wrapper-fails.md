---
name: pwsh-snap-wrapper-fails
description: On the Linux dev host, `pwsh` (/usr/local/bin/pwsh -> /snap/bin/pwsh) fails with "transient scope could not be started"; call the snap's real binary for parser checks
metadata:
  type: reference
---

`pwsh` on the Debian host is a snap wrapper; from the agent shell it dies with `internal error ... transient scope could not be started` (exit 46), even with the sandbox disabled.

**How to apply:** for read-only parser checks run `/snap/powershell/current/opt/powershell/pwsh -NoProfile -NonInteractive -File <script>` with `[System.Management.Automation.Language.Parser]::ParseFile` (keep the helper in the scratchpad). Related: [[powershell-tool-sandbox-false-positive]].
