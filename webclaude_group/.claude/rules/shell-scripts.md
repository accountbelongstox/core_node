---
paths:
  - "**/*.sh"
---

# Shell Script Rules

- NEVER use `exit 0`, `exit 1`, or any exit codes — use flag variables and if/else flow
- NEVER use `set -e`, `set -euo pipefail` — let scripts report all issues
- Use `[OK]`, `[INFO]`, `[WARN]`, `[FAIL]` prefixed messages for real-time status
- All output must be real-time, no silent failures
- All scripts must be idempotent — safe to run multiple times
- Detect success by checking file existence or command output, not exit codes
- Complex logic goes in Python (scripts/pytools/), not shell
- Variables declared at the beginning of file
- System package installs: use core_node/scripts/shells/linux/ (idempotent)
- All code and comments in English
