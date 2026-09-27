# flutter report (client key rollout, 2026-09-27)

Scope: `poly_apps/flutter_bloom/`. Flutter has no audit findings. Source: `.claude/agents_shared/client_key_auth/laravel_route_auth.md`.

## Tasks

| Id | Subject | Status |
|---|---|---|
| flutter-1 | [flutter] adapt flutter_bloom Laravel calls to the route auth table (`tts/generate` -> `dashboard.auth:user`) | in review |

## flutter-1 changes

- `lib/apps/app_qy/services_app_qy/api_service_app_qy.dart`
  - `post()` takes `requiresUser`. The flag goes into the Dio request `extra`.
  - `generateTts()` (`POST /api/app_qy_v1/ai_tools/tts/generate`) now sets `requiresUser: true`.
  - A 401 or 403 on a `requiresUser` request is emitted on the new broadcast stream `userAuthFailures`.
  - The bearer interceptor is unchanged: it sends `Authorization: Bearer <login_token>` whenever a token is set. `login_token` is a Sanctum token (`CommonAuthService::createLoginResponse`).
- `lib/apps/app_qy/main_app_qy.dart`
  - `_QyAppState` subscribes to `userAuthFailures`. A 401 shows `qyErrorUnauthorized` and a 403 shows `qyErrorForbidden`. The SnackBar goes through the router navigator context. The app then goes to the existing login route `QyAppRoutesProvider.routeLogin` (`/qy/login`).
  - The `AuthControllerAppQy` provider now calls `initialize()`. This restores the stored session into `ApiServiceAppQy`. Before this change, `initialize()` had no caller, so after an app restart a logged-in user's bearer was never sent.
- `lib/apps/app_qy/localization_app_qy/en_app_qy.dart`, `zh_app_qy.dart`: added en/zh values for the existing keys `qyErrorUnauthorized` and `qyErrorForbidden`. The keys were declared but had no translations.

Static checks: read-only review only. No `dart`/`flutter` command was run because the task forbids it. Grep confirms each new locale key appears once per map, so there is no const-map duplicate.

## Call-site audit against the route table

| Flutter call | Route table | Action |
|---|---|---|
| `ApiServiceAppQy.generateTts` POST `/api/app_qy_v1/ai_tools/tts/generate` (via `VocabularyServiceAppQy.generateTts` <- `LearningControllerAppQy.playWordAudio`) | `dashboard.auth:user` | adapted (above) |
| `ApiServiceAppQy.getTtsAudioUrl` GET `/api/app_qy_v1/ai_tools/tts/audio/...` | public (tts reads/audio) | unchanged |
| `lookupWordPublic` GET `/api/words/public/{word}` | public | unchanged |
| `features_app_qy/auth/domain/service/auth_service.dart` `/api/v1/auth/login`, `/logout` | not listed (AppQyV1Auth: public login, `auth:sanctum` logout) | unchanged |
| `ApiEndpointsAppQy.ttsBatch` (`/tts/batch`), `ttsVoices`, `translateText` (`/ai_tools/translate`), `translateBatch` | constants only; no caller | none |

Flutter never calls `client.key`, `client.key_or_dashboard` or admin `dashboard.auth` routes. It holds no client key (K6). Other apps target other hosts or prefixes that laravel_main does not serve: bank `/api/bank`, wuy `/api/awy-v0`, codemart `api.codemart.com/api/codemart`, vipclub, travel, achat, example. `app_main` has app_qy commented out.

## Findings for the orchestrator (not auth-table items, not changed)

- F-FL-1 (high, pre-existing): app_qy's main login and data surface use `/api/dict/v1/*` in `config_app_qy/api_endpoints_app_qy.dart`. That covers login, verify-sms-code, user, learning, memory bank, reading and word groups. laravel_main has no `dict/v1` route prefix; it appears only in `AppQyV1ApiInfo.php` docs. Against laravel_main, `AuthServiceAppQy.login` cannot get a token, so `tts/generate` returns 401 and routes to login in a loop. The laravel_main Sanctum login is `/api/app_qy_v1/login` (or `/api/v1/auth/login`). `AuthServiceAppQy` already parses both response shapes (`login_token` / `token.accessToken`). Fixing this is an endpoint contract decision (laravel + flutter), so it needs the orchestrator.
- F-FL-2 (low, pre-existing): `ApiServiceAppQy._handleError` returns hardcoded English fallback strings, which reach the login SnackBar through `authService.error`. This is an i18n debt, outside flutter-1.
- F-FL-3 (low): `ttsBatch` (`/tts/batch`) and `translateText`/`translateBatch` (`/ai_tools/translate*`) point at routes that do not exist. The real routes are `tts/batch-generate` and `translation/translate|batch`. They have no callers today.

## Blockers

None for flutter-1. F-FL-1 blocks end-to-end use of `tts/generate` from app_qy against laravel_main.

## Next owner

reviewer (flutter-1 verdict). Orchestrator: decide on F-FL-1.

---

# flutter-G1 re-check (2026-09-27, D22 service role, read-only)

Task: `.claude/agents_shared/d22/items_service.json` old_role `flutter`, item `flutter-consumer-check` (task id `flutter-D7`, dispatched as `flutter-G1`). D6 (`flutter任务停止，并标记为不用修复`) still stands: **no code changed**. `git status --porcelain -- poly_apps/flutter_bloom` is empty before and after this check. This section re-verifies every Laravel call in `poly_apps/flutter_bloom` against the current `.claude/agents_shared/client_key_auth/laravel_route_auth.md` and the 09-26/27 changes (client-key machine routes, `app_qy_v1/delivery/*` diff routes, X4 word identity, cover-task routes, removed/renamed endpoints), and goes one level deeper than the flutter-1 audit: it separates **live** call sites (reachable from `main_app_qy.dart`'s provider tree and the go_router routes in `router_app_qy/routes_provider_app_qy.dart`) from **dead** ones (declared but never imported/instantiated outside their own file).

## Which apps talk to this repo's Laravel at all

Only `app_qy` targets a host this repo could serve: `config_app_qy/api_config_app_qy.dart:36-62` lists `api.si.12gm.com`, `api.si.15gm.com` and the local dev host `192.168.50.2:9000`; `MultiEndpointDiscovery` picks one at runtime. Every other app's base URL is an unrelated external host, confirmed unchanged from the flutter-1 audit: `app_bank`/`app_achat` `api.si.12gm.com/api/bank` (same host, disjoint prefix — laravel_main has no `bank/*` routes), `app_wuy` `api.anwuyou.*/api/awy-v0|v1`, `app_codemart` `api.codemart.com/api/codemart` (no `v1`, so it would not match `CodeMartV1Router` either), `app_achat` also has an unused `api.achat.com`/`apiv1.achat.fun`, `app_travel`/`app_vipclub`/`app_example`/`app_bank` all use placeholder `*.example.com` or `12gm.com` hosts. `app_main` still has `app_qy` commented out. None of these are re-audited item by item again (unchanged since flutter-1); this section focuses on `app_qy`.

## Live call sites (reachable from the wired provider tree / router)

| # | Call | Endpoint | Route table / actual route | Status |
|---|---|---|---|---|
| 1 | `AuthServiceAppQy.login/register/sendVerificationCode/logout` (`services_app_qy/auth_service_app_qy.dart:52-219`) via `ApiEndpointsAppQy.authLogin/authRegister/authVerifyCode/authSendCode/authLogout` (`config_app_qy/api_endpoints_app_qy.dart:3-8`) | `/api/dict/v1/login` etc. | No `dict/v1` prefix anywhere in `poly_apps/laravel_main/routes/`; `AppQyV1Dict.php` is named "Dict" but registers under `app_qy_v1`, not a `dict` URL segment. Real login is `/api/app_qy_v1/login` (`AppQyV1Auth.php:20`, public) or `/api/v1/auth/login` (`AppQyV1Auth.php:32`, public, unrelated top-level group) | **removed/never-existed** — F-FL-1 (won't fix, D6) |
| 2 | `AuthServiceAppQy.refreshUser -> getUserProfile/getUserLanguages/getLearningStats` (`services_app_qy/auth_service_app_qy.dart:239,268,289`) | `/api/dict/v1/user`, `/learning/languages`, `/learning/stats` | same `dict/v1` issue; real routes are `/api/app_qy_v1/user`, and learning stats/languages have no matching `app_qy_v1` route at all (see #4) | same as F-FL-1 |
| 3 | `VocabularyServiceAppQy` (`services_app_qy/vocabulary_service_app_qy.dart`, wired at `main_app_qy.dart:183-197`) -> `getSupportedLanguages`, `getVocabularyLibraries`, `selectVocabularyLibrary`, `getWordCards`, `updateLearningProgress`, `generateTts`, `getTtsAudioUrl` | `/api/dict/v1/system/supported-languages`, `/learning/libraries`, `/learning/libraries/select`, `/learning/words`, `/learning/progress` (all `api_endpoints_app_qy.dart:12-20,35`) | same `dict/v1` issue; the closest real routes are `app_qy_v1/vocabulary/libraries` (public, `AppQyV1Vocabulary.php:29`) and `app_qy_v1/vocabulary/libraries/recommended` — different path shape (`vocabulary/*` not `learning/*`), no `select`/`progress`/`words` equivalents found | same as F-FL-1 |
| 4 | `generateTts` / `getTtsAudioUrl` (`api_service_app_qy.dart:285-305`, `requiresUser: true` set by flutter-1) | `POST /api/app_qy_v1/ai_tools/tts/generate`, `GET .../tts/audio/{path}` | `AppQyV1AITools.php:78` `dashboard.auth:user` (comment: "used by the TTS tool UI and flutter"); `:84-85` audio serve is public | **ok** — matches, flutter-1's fix still correct |
| 5 | `CourseControllerAppQy` (live in `course_ielts_screen_app_qy.dart`, wired `main_app_qy.dart:206-209`) -> `CourseService` (`features_app_qy/course/domain/service/course_service.dart:18,34,45,61,69`) | `GET/POST /api/v1/courses`, `/courses/{id}`, `/courses/plans`, `/courses/{id}/enroll`, `/courses/{id}/progress` | No `v1/courses` route anywhere in `poly_apps/laravel_main/routes/` (the only top-level `v1/*` group is `v1/auth`, `AppQyV1Auth.php:31`) | **removed/never-existed** — new, see F-FL-4 below |
| 6 | `WordControllerAppQy` (live in `word_book_screen_app_qy.dart`, `word_listening_1_screen_app_qy.dart`, wired `main_app_qy.dart:210-213`) -> `WordService` (`features_app_qy/word/domain/service/word_service.dart:17,29,40,54,64,72,81`) | `GET/POST /api/v1/words/books`, `/words/books/{id}`, `/words/books/{id}/words`, `/words/{id}`, `/words/{id}/favorite`, `/words/{id}/learned`, `/words/search` | No `v1/words` route. Real word routes are `app_qy_v1/words/{id}`, `/words/{id}/favorite`, `/words/search/{query}` (`AppQyV1Words.php:21-38`, `auth:sanctum`) and `app_qy_v1/words/public/{word}` (public, `:42-45`) — same verb shapes, wrong prefix (`v1` instead of `app_qy_v1`) and missing the `auth:sanctum` middleware the real group requires | **removed/never-existed** — new, see F-FL-4 |
| 7 | `home_learning.LearningControllerAppQy` (live in `home_search_screen_app_qy.dart`, `home_study_screen_app_qy.dart`, wired `main_app_qy.dart:192-197`) -> `LearningService` (`features_app_qy/home/domain/service/learning_service.dart:17,27,40,52,62`) | `GET/POST /api/v1/learning/stats`, `/learning/session/start`, `/learning/progress`, `/learning/check-in`, `/learning/wordbook` | No `v1/learning` route anywhere | **removed/never-existed** — new, see F-FL-4 |

Items 5-7 are wired with the same `ApiServiceAppQy()` singleton as items 1-4 (same Dio instance, same discovered host), so a request from these controllers reaches the real backend and gets a 404, not a mock.

## New finding

- **F-FL-4** (high, new): a second, unrelated placeholder API surface — `CourseService`, `WordService` (`features_app_qy/word/domain/service/`, not the `services_app_qy/vocabulary_service_app_qy.dart` one) and `LearningService` (`features_app_qy/home/domain/service/`) — hardcodes `/api/v1/courses*`, `/api/v1/words/*`, `/api/v1/learning/*` (raw strings, not `ApiEndpointsAppQy` constants). All three are constructed with the real `ApiServiceAppQy()` in `main_app_qy.dart:151-154` and wired as `lazy: false` providers (`:206-213`, plus `:192-197` for `LearningService`), and each is driven by a live, routed screen (`course_ielts_screen_app_qy.dart`, `word_book_screen_app_qy.dart`, `home_search_screen_app_qy.dart`). None of these paths exist in `poly_apps/laravel_main/routes/` under any prefix — the only top-level `v1/*` group is `v1/auth` (login/register/forgot-password/reset-password public, logout/user `auth:sanctum`), unrelated to courses/words/learning. This is independent of F-FL-1 (`dict/v1`): even dropping `dict/v1` in favor of `app_qy_v1` would not fix these, since the real word routes need `auth:sanctum` and a different path shape (`app_qy_v1/words/{id}` vs `v1/words/books/{id}`), and no course or generic "learning" routes exist in laravel_main at all. Same disposition as F-FL-1: won't fix under D6, reported for the orchestrator's D5/D8 backlog only.

## Dead code found while tracing reachability (not counted as live mismatches)

These declare Laravel calls but have zero callers anywhere outside their own file (confirmed by grep across `poly_apps/flutter_bloom/lib/apps/app_qy`), so they are inert today; listed for completeness only, no action taken (D6):
- `features_app_qy/auth/domain/service/auth_service.dart` (`/api/v1/auth/login|logout|refresh|verification-code`) and its `features_app_qy/auth/controllers/auth_controller_app_qy.dart` — a second, unrelated `AuthControllerAppQy` class (same name, different file than the live `controller_app_qy/auth_controller_app_qy.dart`). Reached only through `features_app_qy/authentication/` (`login_screen_v2_app_qy.dart`, `signin_up_screen.dart` via `router_app_qy/router_legacy_qy.dart`) and `features_app_qy/setting/views/setting_screen_view.dart` — none of these are imported by the live `router_app_qy/routes_provider_app_qy.dart` (their imports there are commented out, `:60-72`) or by `main_app_qy.dart`. Also has a latent type bug unrelated to the route audit: it treats the `Map<String, dynamic>` returned by `ApiServiceAppQy.post` as if it were a `Response` (`response.data as Map<String, dynamic>` at lines 23, 52, 83, 105, 127, 151, 175), which would not compile if this file were ever wired in.
  - Note: `/api/v1/auth/login` and `/api/v1/auth/logout` do exist for real (`AppQyV1Auth.php:31-41`, public/`auth:sanctum`) — the only call in this dead file that would actually work if the file were ever reconnected. `/api/v1/auth/refresh` and `/api/v1/auth/verification-code` do not exist anywhere.
- `features_app_qy/profile/domain/service/profile_service.dart` (`/api/v1/profile*`) and `features_app_qy/social/domain/service/social_service.dart` (`/api/v1/messages*`, `/notifications*`, `/check-in*`, `/challenges*`) — zero instantiations anywhere in the tree.
- `features_app_qy/settings/domain/service/settings_service.dart` (`/api/v1/settings*`) — instantiated only by the dead `login_screen_v2_app_qy.dart`.
- `common/network/endpoints/laravel_endpoints.dart` (shared `lib/common/`) — `create_group`/`query_all_groups`/etc. under `AppConstants.appQyUserBaseUrl` (`dictapi.si.12gm.com`, a third, unrelated host) + `/dict/v1`. Zero callers anywhere in `flutter_bloom`. Worth noting the segment names here (`create_group`, `query_all_groups`, `up_learned`, ...) exactly match `AppQyV1Dict.php`'s real controller actions — only the `dict/v1` prefix is wrong there too, same root cause as F-FL-1.
- `ApiServiceAppQy.lookupWordPublic`, `.getEnhancedWord`, `.getWordGroups/.createWordGroup`, `.queryDictionary`, `.getAiUsageLimit/.getAiWordExplanation/.getAiLearningAssistant`, all `Memory Bank`/`Reading Materials`/`Vocabulary Libraries (Public)`/`User Initialization` methods (`api_service_app_qy.dart:315-626`) — declared, zero callers (confirmed by grep), same disposition as `ttsBatch`/`translateText`/`translateBatch` from F-FL-3.

## 09-26/27 change categories checked, no flutter hits

- **Client-key machine routes** (`worker/*`, `internal/pycore/*`, `ai_tools/tts/worker/*`, `assist/*`, `app_qy_v1/orch_audio/*`): flutter holds no client key (K6) and calls none — confirmed no matches for `worker/`, `assist/`, `orch_audio` in `poly_apps/flutter_bloom`.
- **`app_qy_v1/delivery/*` diff/batch routes**: no matches for `delivery/diff|batch` in flutter_bloom.
- **X4 word identity (md5)**: no `md5` field or literal anywhere in `app_qy` word/dictionary code; flutter never sends a word-identity hash, consistent with it never calling `word/audio/upload` or the delivery batch routes.
- **Cover-task routes** (`ai_tools/cover-retry`, `assist/cover/*`, `vocabulary/libraries/cover/tasks`, `vocabulary/libraries/{id}/cover/ai-regenerate`): no matches for `cover-retry|cover/retry|cover/reconcile|cover/clear|library_cover|ai-regenerate` in flutter_bloom (the only "escrow"/cover-adjacent hits are `app_codemart` localization strings, not API calls).
- **Removed/renamed endpoints** (`pycore.client` removal, escrow-refund path fix, `queue-center/mercure-authorization` auth change): none of these were ever called by flutter.

## Verification

`git status --porcelain -- poly_apps/flutter_bloom` returns nothing (checked before and after this pass). No file under `poly_apps/flutter_bloom` was modified. This section adds detail to F-FL-1/F-FL-3 and a new F-FL-4; it does not change any task status or verdict.

## Next owner (this pass)

Orchestrator: fold F-FL-4 in alongside F-FL-1 in the D5/D8 backlog note (both won't-fix under D6, both endpoint-contract decisions for whenever flutter is reopened). No reviewer action needed — no code changed.
