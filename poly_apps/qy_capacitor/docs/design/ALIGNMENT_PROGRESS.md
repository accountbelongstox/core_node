# v4.1 Iris — App-wide Alignment Progress Table

Comprehensive consistency pass ("对齐") across the whole app on **three axes**,
done by a 6-agent multi-role wave. One row per page/component.

Legend: `✅` aligned & verified · `▲` RN-dead code (visual layer only,
data-port out of scope) · `FROZEN` central layer (authoritative)

## STATUS: ✅ 100% ALIGNED

tsc **101** (exact baseline, 0 net new, 0 component errors) · `vite build` ✅ ·
0 emoji-as-icon files · 0 `max-w` escalation · 0 bare `absolute z-50` panels.

## Per-axis criteria

- **UI** — phone column `max-w-md`/`.ds-page`; Iris tokens only (no inline hex
  /`bg-blue-600`); glass `ds-card`/`ds-row`; `UI.tsx` primitives consumed;
  floating panels via `Popover`/`Sheet`/`ds-z-*`; ≥44px; asymmetric header.
- **Functionality** — `Array.isArray` guard before every `.map/.slice/.filter`;
  loaders resilient to non-JSON/error; no invalid `t()` keys; no dead/no-op
  handlers; behavior preserved; tsc ≤ 101.
- **Beautify** — reference parity: gradient hero, soft icon-chips, negative
  space, large radius, dark/light parity, lucide-react (no emoji).

## Central / shell layer — FROZEN (authoritative)

`index.css`, `styles/StyleCenter.ts`, `components/UI.tsx`, `TopBar`,
`BottomTabNav`, `PillNav`, `AppLayout` — FROZEN / FROZEN / FROZEN.

## Components (22)

| Component | UI | Func | Beautify |
|---|:--:|:--:|:--:|
| Header | ✅ | ✅ | ✅ |
| Sidebar | ✅ | ✅ | ✅ |
| SearchOverlay | ✅ | ✅ | ✅ |
| LanguageDropdown | ✅ | ✅ | ✅ |
| ThemeToggle | ✅ | ✅ | ✅ |
| BentoCard | ✅ | ✅ | ✅ |
| CanvasView | ✅ | ✅ | ✅ |
| ChatMode | ✅ | ✅ | ✅ |
| MuseView | ✅ | ✅ | ✅ |
| ImageMode | ✅ | ✅ | ✅ |
| VisionMode | ✅ | ✅ | ✅ |
| ApiTestingCenter | ✅ | ✅ | ✅ |
| ApiEndpointSwitcher | ✅ | ✅ | ✅ |
| Icons | ✅ | ✅ | ✅ |
| Auth/AuthLayout | ✅ | ✅ | ✅ |
| Auth/AuthCard | ✅ | ✅ | ✅ |
| Auth/AuthInput | ✅ | ✅ | ✅ |
| Auth/AuthError | ✅ | ✅ | ✅ |
| Auth/AuthSuccess | ✅ | ✅ | ✅ |
| Auth/AuthBackButton | ✅ | ✅ | ✅ |
| Dialog/Dialog | ✅ | ✅ | ✅ |
| Dialog/DialogManager | ✅ | ✅ | ✅ |

## Pages (55)

| Page | UI | Func | Beautify |
|---|:--:|:--:|:--:|
| Dashboard/Home | ✅ | ✅ | ✅ |
| Dashboard/Stats | ✅ | ✅ | ✅ |
| Auth/Login | ✅ | ✅ | ✅ |
| Auth/ForgotPassword | ✅ | ✅ | ✅ |
| Auth/ResetPassword | ✅ | ✅ | ✅ |
| Learn/Home | ✅ | ✅ | ✅ |
| Learn/Library | ✅ | ✅ | ✅ |
| Learn/Practice | ✅ | ✅ | ✅ |
| Learn/Review | ✅ | ✅ | ✅ |
| Learning/Playlist | ✅ | ✅ | ✅ |
| Learning/PlaylistConfig | ✅ | ✅ | ✅ |
| Learning/GroupDetail | ▲ | ▲ | ▲ |
| Learning/GroupManagement | ▲ | ▲ | ▲ |
| Learning/StudySession | ▲ | ▲ | ▲ |
| Library/Courses | ✅ | ✅ | ✅ |
| Library/CourseDetail | ✅ | ✅ | ✅ |
| Library/Recommendations | ✅ | ✅ | ✅ |
| Library/WordDetail | ✅ | ✅ | ✅ |
| Library/AddToGroup | ▲ | ▲ | ▲ |
| Vocabulary/LibraryDetail | ✅ | ✅ | ✅ |
| Flashcards/Run | ✅ | ✅ | ✅ |
| Quiz/Run | ✅ | ✅ | ✅ |
| Reading/Setup | ✅ | ✅ | ✅ |
| Reading/Run | ✅ | ✅ | ✅ |
| Listening/Player | ✅ | ✅ | ✅ |
| Review/Dashboard | ✅ | ✅ | ✅ |
| Stats/History | ✅ | ✅ | ✅ |
| Search/Dictionary | ✅ | ✅ | ✅ |
| Documents/Upload | ✅ | ✅ | ✅ |
| Mine/Index | ✅ | ✅ | ✅ |
| Mine/Progress | ✅ | ✅ | ✅ |
| Mine/Social | ✅ | ✅ | ✅ |
| Profile/Profile | ✅ | ✅ | ✅ |
| Profile/ProfileEdit | ✅ | ✅ | ✅ |
| Social/Friends | ✅ | ✅ | ✅ |
| Social/Leaderboard | ✅ | ✅ | ✅ |
| Settings/Index | ✅ | ✅ | ✅ |
| Settings/Display | ✅ | ✅ | ✅ |
| Settings/Language | ✅ | ✅ | ✅ |
| Settings/Learning | ✅ | ✅ | ✅ |
| Settings/Layout | ✅ | ✅ | ✅ |
| Settings/Notifications | ✅ | ✅ | ✅ |
| Settings/DataSync | ✅ | ✅ | ✅ |
| Settings/ApiServer | ✅ | ✅ | ✅ |
| Settings/SystemStatistics | ✅ | ✅ | ✅ |
| Settings/About | ✅ | ✅ | ✅ |
| Tools/Index | ✅ | ✅ | ✅ |
| Tools/AIAssistant | ✅ | ✅ | ✅ |
| Tools/Analytics | ✅ | ✅ | ✅ |
| Tools/ArticleProcessor | ✅ | ✅ | ✅ |
| Tools/Dictionary | ✅ | ✅ | ✅ |
| Tools/PersonalDictionary | ✅ | ✅ | ✅ |
| Tools/TTSTools | ✅ | ✅ | ✅ |
| Tools/TranslationTools | ✅ | ✅ | ✅ |
| Tools/VocabularyBrowser | ✅ | ✅ | ✅ |

`▲` RN-dead (GroupDetail/GroupManagement/StudySession/AddToGroup): visual
marker + primitives only; pre-existing react-native data-layer rot is the
documented baseline, no port (out of design scope).

## Wave log

- **Alignment wave** (done): 6 parallel role-agents, disjoint scopes, audited
  + closed gaps on all 3 axes. Notable functional fixes: `Tools/Dictionary`
  async-Promise-as-state, `Tools/PersonalDictionary` dead Create-Entry button,
  `Tools/VocabularyBrowser` dead handler, `Social/Leaderboard` emoji→lucide,
  `Settings/DataSync` flat→gradient toggle, `Header`/`SearchOverlay` dead Sound
  handlers wired, broad `Array.isArray` guard coverage, `AuthError`/`Review`
  inline-SVG→lucide. tsc held at 101 baseline, build ✅.
