---
name: ui-tsconfig-nonstrict-narrowing
description: pycore_laravel_wordnew_ui tsconfig is non-strict; discriminated-union narrowing by negation fails and generic Seg onChange needs NoInfer
metadata:
  type: project
---

The UI root tsconfig has no `strict`, so `if (!r.ok) r.error` does NOT narrow `{ok:true}|{ok:false}` unions; use `r.ok === false`. Truthy `if (r.ok)` and `'error' in r` narrow fine.

**Why:** tool workbench code hit TS2339 on `!parsed.ok` branches (web tools, 2026-10).
**How to apply:** write `=== false` checks; for generic controls (`Seg<T>`) type `options`/`onChange` with `NoInfer<T>` so `useState` setters infer the union, not `string | number`.
