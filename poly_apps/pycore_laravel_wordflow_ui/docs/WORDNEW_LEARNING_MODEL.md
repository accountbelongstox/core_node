# /wordnew — Learning Model, Settings & Home Dashboard (feature design)

Scope of the 2026-06-20 changes. The data layer follows the established
mock⇄real one-switch pattern (`apps/wordnew/api/index.ts`); see
`WORDNEW_API_MOCK_PATTERN.md`.

## 1. Backend — user profile fields (sub-app extends the main table)

AppQyV1 extends the shared `users` table. The profile editor writes `bio`
(personal intro) and `location`, but those columns were missing.

- **Idempotent add**: `database/migrations/AppQyV1_2025_12_25_000001_add_profile_intro_fields_to_users_table.php`
  uses `SafeMigrationHelper::alignTableStructureFromArray` (no-op when present),
  the same pattern as `add_learning_languages_to_users_table`.
- `User::$fillable` now includes `bio`, `location`.
- `AppQyV1ProfileController::updateProfile` already writes them via `$user->update()`.

## 2. Settings reorganization

- **Languages moved OUT of the profile editor** into Settings (single source of
  truth). The profile edit page shows a hint pointing to Settings → Languages.
- **Login-gated**: native language + target-languages (multi-select) + "Manage
  learning languages" are hidden when logged out (`isLoggedIn` prop). The
  Learning Model entry stays (local device settings).
- **Target languages = MULTI-select**, persisted to `settingTargetLangs`
  (legacy `settingTargetLang` = first) and **synced to the backend** on every
  change via `wfNewApi.setLearningLanguages` (`POST /api/app_qy_v1/learning/languages`),
  including native-language changes.
- **Dark/light + interface language** relocated from the header into
  Settings → Appearance (header keeps a compact gear shortcut).

## 3. Learning Model sub-page (`pages/WfNewLearningModel.tsx`)

Opened from Settings → "Learning model". Fields persist to `WfNewSettingsStore`.

- **Daily new words** (`dailyGoal`).
- **Memorization mode** (`memorizeMode`): `walkman` (default) | `cards`.
- **Walkman playback sub-area** (shown only when mode = walkman):
  | Setting | Store key | Default |
  |---|---|---|
  | Play count | `wmPlayCount` | 1 |
  | Replay count | `wmReplayCount` | 1 |
  | Read the word | `wmReadWord` | true |
  | Read the explanation | `wmReadExplanation` | **false** |
  | Playback speed | `wmPlaybackSpeed` | **0.8** |
  | Play interval (s) | `wmPlayInterval` | 0 |
  | Replay gap (words after which to replay) | `wmReplayGapWords` | 0 |
  | Replay speed | `wmReplaySpeed` | 0.8 |
  | Replay interval (s) | `wmReplayInterval` | 0 |

## 4. Review Settings sub-page (`pages/WfNewReviewSettings.tsx`)

Opened from the Learning Model page.

- `reviewDailyLimit` (default 50), `reviewOrder` (due_first | random | hardest_first),
  `reviewAlgorithm` (ebbinghaus | sm2 | leitner), `reviewIncludeNew` (false).

## 5. Home dashboard first section (`components/WfNewHomeDashboard.tsx`)

Shown ONLY when logged in, at the top of the home tab. A horizontal "bento" row:
- **Target language** (from `currentUser.targetLang` / settings).
- **Current learning group** — name + word count from the backend default group
  (`getWordGroups` → `/query_all_groups`).
- **Need review** (`reviewDailyLimit`).
- **Today recited** — `dailyProgress / dailyGoal` progress bar.
- **Check-in record** — 7-day strip derived from `streak` (the chart area).

## 6. URL route reflection

Every page reflects its route name in the address bar as `#/<tab>`
(`learning-model`, `review-settings`, `languages`, `profile`, …). On first mount
the tab is restored from the hash (deep-link / refresh safe); on change the hash
is written back via `history.replaceState`. Lightweight hash routing layered on
the existing history stack (back = previous page) — no full react-router rewrite.

## 7. Libraries

No new npm dependency was added: hash routing uses the native History API; the
avatar cropper uses native Pointer Events (pinch/drag). `react-router-dom` and
`framer-motion` (already present) remain the only routing/animation deps.
