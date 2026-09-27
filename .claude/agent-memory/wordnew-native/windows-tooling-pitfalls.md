---
name: windows-tooling-pitfalls
description: Windows host pitfalls for the wordnew UI - bun lint cannot find tsc, Edit normalizes mixed line endings, MSYS grep/awk hide CR
metadata:
  type: project
---

`bun run lint` (`tsc --noEmit`) in poly_apps/pycore_laravel_wordnew_ui fails on this Windows host with `bun: command not found: tsc`, because node_modules/.bin/tsc is only a POSIX shim. Run `bun node_modules/typescript/bin/tsc --noEmit` from that dir instead. It is the same check (it was clean on 2026-09-27). Check free RAM first: the team guard is 3 GB.

UI files are mostly CRLF, but some committed files mix in LF-only lines. The Edit tool normalizes the whole file to CRLF, which adds whitespace-only noise to the diff.

**Why:** reviewers diff against a baseline commit, and the team restores exact line endings (CRLF restore work).

**How to apply:** after editing, compare against HEAD with perl (`perl -ne 'print "$.\n" unless /\r\n$/'`) and restore the LF-only lines with `perl -i -pe 's/\r\n$/\n/ if $. == N'`. Do not count CR with `grep -c $'\r'` or `awk` under Git Bash, because MSYS strips CR there. Use `tr -cd '\r' | wc -c` or perl.
