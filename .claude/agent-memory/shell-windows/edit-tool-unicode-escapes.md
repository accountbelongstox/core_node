---
name: edit-tool-unicode-escapes
description: The Edit tool and sed turn a typed ﻿ (or similar escape) into the literal character; write JS/regex escapes with a byte-level node script
metadata:
  type: feedback
---

When a file must contain the six ASCII characters `﻿` (a JS regex escape), typing it into Edit's new_string wrote the literal U+FEFF character instead, and `sed 's/.../\\uFEFF/'` dropped the backslash. The file silently became non-ASCII.

**Why:** happened in `.claude/hooks/team_gate.mjs` (shell-windows-1, 2026-09-27); `file` still said "Unicode text" after the "fix".

**How to apply:** for escapes, use `node -e` with `String.fromCharCode(92)` + `"uFEFF"` and split/join on the bad string, then confirm with `LC_ALL=C tr -d '\000-\177' < f | wc -c` = 0 and `sed -n '<line>p'`. Related: [[crlf-mixed-line-endings]].
