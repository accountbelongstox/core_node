---
name: wordnew-ui-shared-primitives
description: Where wordnew's shared UI primitives and single-owner stores live after the 2026-10-03 dedupe; reuse them instead of hand-rolling
metadata:
  type: project
---

Shared UI primitives live in `poly_apps/pycore_laravel_wordnew_ui/shared/ui/` (Switch, SettingRow, ChipGroup, ModalShell, Pill, ProgressBar/SegmentedBar, statusTone, Stepper, SelectField, RangeField, NumberInput, TextField, NavRow, ActionButton, ProgressRing, StateMessage, StatCard, DataTable, SegmentedControl). New modals go through `ModalShell` (OVERLAY_Z scale), never raw `fixed inset-0`.

Stores: `core/events/ChangeSignal` is the one subscribe/emit base; `services/WordNewWordGroupCenter` is the only word-group loader; `services/WordNewCustomWords` holds forged words; settings are read with `useWfNewSetting(key)` (no `useState(() => wfNewSettings.get(..))` copies).

`cache/*` components are one-line re-exports of `device-storage/*` (kept, not deleted, per the keep-unreferenced-code rule).

**Why:** the 2026-10-03 audit found 5 hand-written toggles, 12 raw overlays, ~15 hand-rolled listener sets and 3 separate word-group fetch caches.

**How to apply:** check these before writing a toggle/chip/modal/store. Parallel writers each own one locale pair (`locales/{en,zh}_d|e|f.ts`) to avoid edit collisions; run tsc only via `flock /var/_core_node/_tmp/tsc.lock` (RAM is tight). Still open: `reviewAlgorithm` setting has no consumer; `core/`+`shared/` stores outside wordnew still hand-roll listener sets; `dailyReadingWordGroupStore`/`WfNewStudyProgress` could adopt ChangeSignal.
