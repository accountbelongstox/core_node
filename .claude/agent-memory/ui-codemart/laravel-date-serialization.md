---
name: laravel-date-serialization
description: CodeMart API sends date-only fields as UTC-midnight ISO timestamps; parse via cmParseDate calendar mode, never new Date()
metadata:
  type: project
---

Laravel (app timezone UTC) serializes `date`/`datetime` casts for date-only fields (due_date, start_date, issued_date, date_of_birth) as `YYYY-MM-DDT00:00:00.000000Z`, and admin/public services use `toIso8601String()` (`+00:00`). A plain `new Date()` shows the previous day west of UTC.

**Why:** FU-017 (2026-09-27 audit) — three formatter copies diverged; only one handled bare `YYYY-MM-DD`.

**How to apply:** format dates through `cmFormatDate`/`cmParseDate(value, true)` in `components/workspace/cmWorkspaceFormat.ts`; do not add new local date formatters in admin or public-home.
