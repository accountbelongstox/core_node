---
name: laravel-date-serialization
description: CodeMart API sends date-only fields as UTC-midnight ISO timestamps; all CodeMart date/money/number/percent formatting goes through cmWorkspaceFormat.ts
metadata:
  type: project
---

Laravel runs with the app timezone set to UTC. It serializes the `date`/`datetime` casts of date-only fields (due_date, start_date, issued_date, date_of_birth) as `YYYY-MM-DDT00:00:00.000000Z`. The admin and public services use `toIso8601String()`, which ends in `+00:00`. A plain `new Date()` shows the previous day to viewers west of UTC.

**Why:** FU-017 and FU-026 (2026-09-27 audit). Workspace, admin and public-home each had their own formatter copies, and the copies diverged.

**How to apply:** use `components/workspace/cmWorkspaceFormat.ts` for all formatting: `cmFormatDate`, `cmParseDate(value, true)`, `cmFormatMoney` (pass `CM_WHOLE_MONEY_DIGITS` for public whole-unit figures), `cmFormatMoneyRange`, `cmFormatNumber` and `cmFormatPercent`. Never add a local `Intl` formatter in admin, public-home or pages.
