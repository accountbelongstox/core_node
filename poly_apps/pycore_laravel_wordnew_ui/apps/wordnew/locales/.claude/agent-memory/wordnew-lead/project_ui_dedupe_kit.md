---
name: wordnew-ui-dedupe-kit
description: Shared UI parts created in the 2026-10 wordnew UI dedupe refactor and the conventions that keep them conflict-free (Tailwind v4)
metadata:
  type: project
---

Shared parts now live in `UI/shared/ui`: ChipButton (variant + `size` prop), StateMessage/StateGate (loading/empty/error), StatCard, DataTable(+Shell/Head/Row), SegmentedControl, plus lead primitives (ModalShell, Switch, SettingRow, ChipGroup, ProgressBar, ProgressRing, NumberInput, SelectField, TextField, RangeField). Admin kit: `components/admin/adminKit.tsx`. Study arena: `components/study/WfNewStudyArena.tsx` + `useWfNewStudyActions`. Helpers: `core/utils/mathUtils.ts` (clamp, percentOf), `useLatestRef.ts`, `formatters.formatRelativeTime`, `apps/wordnew/utils/WordNewSpeech.ts`.

**Why:** the audit found copy-pasted overlays, tables, pagers, empty states, switches and speech code across wordnew features.

**How to apply:** reuse these before writing markup; do not override padding/gap/rounded on ChipButton via className (Tailwind v4 order is not guaranteed) - use `size`. SelectField/ChipGroup/SegmentedControl need an explicit generic (`<ChipGroup<MyUnion>>`) when `onChange` is a typed setState. Any full-screen viewer uses `ModalShell cardClassName={null}` with an `absolute inset-0` child.
