<!-- flutter_bloom root: ../poly_apps/flutter_bloom ; dart package: qyflutter -->
# Flutter Aggregated Application — Core Development Guide

Multi-app aggregation: one workspace (`qyflutter`) powers many business modules. Targets: Android, iOS, mobile Web. English only; reuse `lib/common/` before inventing; don't run tests or write summaries; append your outcome to `./{ai_name}_devlop_result.md`.

## 1. Entry model (multi-entry)
- `lib/main.dart` (thin proxy) → `lib/apps/app_main/` (showcase; its router hardcodes every app for QA) → `lib/common/app/main_common.dart::runCommonApp(...)`.
- Each app also has a standalone entry `lib/apps/app_{name}/main_app_{name}.dart` calling `runCommonApp`. Required args: `appName, appId, appSettings, enAppLocales, zhAppLocales, appPrefs, customUserProvider, initialRoute, homeRoute`.
- `lib/apps/app_example/` is the canonical template — copy it for any new app.

## 2. App structure & lib/common binding
- One dir per app: `lib/apps/app_{name}/`; EVERY sub-folder/file carries the `_app_{name}` suffix (prevents AI confusion across same-named files). Standard groups: `config_/settings_/providers_/router_/localization_/controller_/models_/features_/services_/repositories_/resources_/utils_`.
- Always wire back to `lib/common/` bases, never reinvent: prefs extend `AppPrefsBase`; user provider extends `EnhancedUserProvider`; settings use `SettingItem`; router builds `GoRouter` via `createRouter()`; network uses `auth_controller` + `ApiConfig`.
- `lib/common/` is the shared infrastructure (network v1/v2, storage v1/v2, database, auth_v2, theme, localization, utils, widgets, …). Each `feature/` holds `views/ widgets/ controllers/`; data models live in `models_app_{name}/`.

## 3. State, localization, theme, assets, routing, API
- **State**: `provider` package only (NOT Get — Get is system-constants only). Each app provides ≥1 `UserProvider` + its own `user_model_app_{name}` + per-app prefs (no global prefs/user_model).
- **Localization**: `flutter_localization`; call `TextKey.tr(context)`; common keys are common-prefixed, app keys `{appname}`-prefixed; en/zh hardcoded per app, merged via `runCommonApp` into `localization_manager.dart`; `app_main` centrally imports all apps' locales.
- **Theme**: reference `lib/common/theme/base/` directly (`ThemeColors/ThemeTextStyles/ThemeDimensions`), no Manager wrapping; `ThemeManager` auto-selects per platform; apps extend base only when needed (extend, never replace).
- **Assets**: `assets/common/` + `assets/apps/app_{name}/{icons,images,launch}`; expose typed constant classes ({appname}-prefixed keys), register in `pubspec.yaml`; app resources never re-wrap common.
- **Routing**: `go_router`, route format `/app_{name}/route_name`; `app_main` aggregates all app routes.
- **API**: reference the global `config/base.config.json` and hardcode the chosen endpoints into the app.

## 4. Compilation & debug — use poly_apps/flutter_bloom/scripts
- Build entry: `scripts/start.sh` (Linux) / `scripts/start.ps1` (Windows) → Python bridge `scripts/build_scripts/main.py`: select app → `ModernFlutterBuildSystem` copies the project to a temp dir, processes assets/platform config, then generates the per-platform compile scripts (`build_scripts/04_build.ps1`, …) that run the actual `flutter build`.
- Local debug: `scripts/dev_debug/startDebugBy{Web,Phone,IOS}.ps1`. Never hand-run raw `flutter build` — always go through these scripts.
