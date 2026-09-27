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
