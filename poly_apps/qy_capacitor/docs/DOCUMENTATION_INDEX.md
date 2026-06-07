# WordFlow AI — Documentation Index

**Updated**: 2026-05-28
**Status**: ✅ Audited & consolidated. Latest pass (2026-05-28): all **UI/UX
interaction-design** content (information architecture, navigation, app-shell
behaviour, user flows, interaction states, overlay/stacking, motion) was
**consolidated into the single design doc** as a new **Part B (§7–§12)**,
documenting the current UI (现在的UI) and the expected UI (预期的UI). The doc is
now the single source for **both** the visual system (Part A §0–§6) and
interaction design (Part B §7–§12). `architecture/ARCHITECTURE.md` §8 keeps only
the technical RouteCenter API and points to the design doc for IA/navigation.
(Earlier large-scale pass folded 12 superseded/conflicting docs **verbatim**
into their `*_HISTORY_MERGED.md` archives and deleted them; the IA/UX material in
`design/REDESIGN_HISTORY_MERGED.md` was **mined** into Part B but the archive is
kept verbatim as historical record.)

> This index is a **full-file replacement** on every audit (per `CLAUDE.md` §1.6
> and `development-guides/CURSOR_RULES_UPDATE_GUIDE.md` §4–6 — rules/indexes only
> reference & summarize, never duplicate a spec). It reflects the actual files on disk.

---

## 1. Start here (canonical / live)

| Doc | Purpose |
|-----|---------|
| `../CLAUDE.md` | Per-app + frontend↔backend co-development rules (AppQyV1). Canonical. |
| `.cursor/rules/wordflow-design.mdc` | Design-system rule (summary; defers to the docs below). |
| `design/WORDFLOW_DESIGN_SYSTEM_4.0.md` | **Canonical design contract.** **Part A (§0–§6)** = visual system ("Design System 4.1 — Iris Layer", additive on v3.x). **Part B (§7–§12)** = **UI/UX interaction design** — IA & navigation, app shell, user flows, interaction states, overlays/stacking, motion; each topic gives the current UI (现在的UI) + expected UI (预期的UI). |
| `design/COMPONENT_REDESIGN_INVENTORY.md` | v4.1 Iris component work breakdown. |
| `design/REDESIGN_PROGRESS.md` | Rolling redesign status + frozen-layer rules. |
| `architecture/ARCHITECTURE.md` | Current application architecture (services/centers/models). §8 = technical RouteCenter API only; user-facing IA/navigation → design doc Part B §7–§8. |
| `api/API_PATH_MAPPING.md` | **Live** frontend↔backend API contract. |
| `README.md` / `TROUBLESHOOTING.md` | Onboarding / problem solving. |

---

## 2. Active references by area

**Design & interaction** — `design/WORDFLOW_DESIGN_SYSTEM_4.0.md` is the single
source for both the visual system (Part A) and UI/UX interaction design (Part B:
IA, navigation, shell, flows, states, overlays, motion). Work breakdown:
`design/COMPONENT_REDESIGN_INVENTORY.md`; rolling status:
`design/REDESIGN_PROGRESS.md`.

**API** — `api/API_PATH_MAPPING.md` (live contract),
`api/API_ENDPOINT_VERIFICATION_REPORT.md` (open verification items),
`api/ENDPOINT_VERIFICATION_MERGED.md` (consolidated verification archive — see §3).

**Architecture** — `architecture/ARCHITECTURE.md` (current; v2.0 centralized
service architecture). Navigation/IA narrative lives in the design doc Part B.

**Implementation status** — `implementation/OPTIMIZATION_COMPLETE.md` (latest
optimization state), `implementation/VERIFICATION_SUMMARY.md` (open P0 quick-ref),
`implementation/MISSING_CONSIDERATIONS_AND_EDGE_CASES.md` (forward backlog),
`implementation/AVATAR_GENERATION_GUIDE.txt` (auto-avatar system reference),
`implementation/TEST_BING_TRANSLATOR.md` (Bing translator service reference).

**Features (current specs)** — `features/VOCABULARY_FEATURE_SUMMARY.md`,
`features/VOCABULARY_AUDIO_SYSTEM.md` (architecture),
`features/VOCABULARY_AUDIO_PLAYBACK_COMPLETE.md` (current state),
`features/TTS_FINAL_IMPLEMENTATION_COMPLETE.md` (TTS end-state),
`features/LANGUAGE_FEATURE_PLAN.md`, `features/ICON_MAPPING_IMPLEMENTATION.md`,
`features/HOME_MULTI_LANGUAGE_ICONS.md`,
`features/LANGUAGE_BASED_STUDY_GROUPS_IMPLEMENTATION.md`,
`features/STUDY_GROUPS_IMPLEMENTATION_SUMMARY.md`.

> Feature-level interaction states (loading/empty/error/hover) are specified once
> as patterns in the design doc Part B §10; feature docs keep only their
> feature-specific functional notes.

**Backend coordination (open items tracked)** —
`backend/BACKEND_REQUIREMENTS_SUMMARY.md`,
`backend/BACKEND_RESPONSE_TO_FRONTEND_QUESTIONS.md`,
`backend/BACKEND_FRONTEND_INTEGRATION_CHECKLIST.md`,
`backend/FRONTEND_BACKEND_INTEGRATION_COMPLETE.md`,
`backend/BACKEND_API_STUDY_GROUPS_REQUIREMENT.md`,
`backend/BACKEND_AUDIO_GENERATION_COORDINATION.md`,
`backend/BACKEND_BATCH_STATUS_CHECK_REQUEST.md`,
`backend/BACKEND_LANGUAGE_BASED_STUDY_GROUPS_REQUIREMENT.md`,
`backend/BACKEND_REGISTRATION_AUTO_INIT_REQUIREMENT.md`.

---

## 3. Historical archives (consolidated — do not use as current guidance)

Each `*_HISTORY_MERGED.md` contains the **verbatim** content of the individual
reports that were removed. Kept for history only.

| Archive | Absorbed (now deleted) |
|---------|------------------------|
| `api/ENDPOINT_VERIFICATION_MERGED.md` | COMPLETE/FINAL/CURRENT ENDPOINT_VERIFICATION, ENDPOINT_VERIFICATION_COMPLETE, ENDPOINT_AUDIT_REPORT, ALL_ENDPOINTS_IMPLEMENTED; + API_INTEGRATION_ANALYSIS, AI_ENDPOINT_VERIFICATION_REPORT |
| `implementation/IMPLEMENTATION_HISTORY_MERGED.md` | COMPLETE_STATUS_REPORT, FINAL_IMPLEMENTATION_REPORT, IMPLEMENTATION_SUMMARY, P3_COMPLETION_REPORT, FIXES_APPLIED, COMPONENT_FIXES; + backend/BACKEND_FRONTEND_GAP_ANALYSIS, backend/CRITICAL_FIX_API_BASE_URL |
| `architecture/ARCHITECTURE_HISTORY_MERGED.md` | ARCHITECTURE_DATA_CENTER, ARCHITECTURE_IMPROVEMENTS |
| `design/REDESIGN_HISTORY_MERGED.md` | REDESIGN_REPORT_PHASE1, REDESIGN_REPORT_PHASE2; COMPLETE_REDESIGN_PLAN, UI_UX_REDESIGN_PROPOSAL, DESIGN_QUICK_REFERENCE (obsolete v4.0 visual; IA/UX history). **Still-valid IA/flows/layouts from these were mined into the design doc Part B (§7–§12); the archive remains verbatim, not current guidance.** |
| `features/FEATURES_HISTORY_MERGED.md` | TTS_AUDIO_INTEGRATION_COMPLETE, TTS_BATCH_STATUS_QUERY_COMPLETE, TTS_NEW_BATCH_API_MIGRATION_COMPLETE, VOCABULARY_AUDIO_SYSTEM_COMPLETE, VOCABULARY_IMPLEMENTATION_SUMMARY |

Also previously removed (dated one-time session logs, no forward value):
`implementation/SESSION_SUMMARY_2025-12-18.md`, `implementation/TODO_REDESIGN.md`.

---

## 4. Single-source-of-truth map (interaction design)

To avoid the prior scattering, interaction-design topics now live in exactly one
place, with pointers elsewhere:

| Topic | Single home | Pointers |
|---|---|---|
| Information architecture & navigation | design doc **§7** | `ARCHITECTURE.md` §8 → §7; RouteCenter = runtime list |
| App shell / chrome (TopBar, layout, immersive) | design doc **§8** | — |
| User flows (auth, learn loop, immersive, tools, mine) | design doc **§9** | mined from `REDESIGN_HISTORY_MERGED.md` |
| Interaction states (loading/empty/error/…) | design doc **§10** | feature docs keep functional notes only |
| Overlays & stacking / z-scale | design doc **§11** (+ tokens in §3.9) | `.cursor` rule §11 summary |
| Gestures, transitions, motion, thumb-zone | design doc **§12** | — |

---

## 5. Maintenance rule

When a report becomes obsolete or conflicts with a canonical doc: fold its
**verbatim** content into the relevant `*_HISTORY_MERGED.md` archive (create one
per area if none exists) under an
`## ARCHIVED (folded YYYY-MM-DD) — <path> — superseded…` header, then delete the
original (do **not** create a new `/archived` tree). Keep canonical specs
single-source; AI rules (`.cursor/rules/*.mdc`) and indexes only reference and
summarize — never duplicate a spec (`development-guides/CURSOR_RULES_UPDATE_GUIDE.md`).
Docs are full-file replacements (`CLAUDE.md` §1.6). Rewrite this index in full
after each audit.
