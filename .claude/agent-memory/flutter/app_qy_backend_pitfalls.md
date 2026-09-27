---
name: app-qy-backend-pitfalls
description: app_qy auth/endpoint pitfalls vs laravel_main — dict/v1 has no Laravel route, QyApp context sits above MaterialApp, where the bearer and session restore live
metadata:
  type: project
---

- app_qy `ApiEndpointsAppQy` uses `/api/dict/v1/*` for login and most data. laravel_main has no `dict/v1` prefix; it appears only in `AppQyV1ApiInfo.php` docs. The real Sanctum login is `/api/app_qy_v1/login` or `/api/v1/auth/login`. Reported to the orchestrator as F-FL-1 on 2026-09-27.
- The bearer lives in `ApiServiceAppQy` (singleton Dio interceptor). `AuthServiceAppQy` sets it on login and restores it from storage through `AuthControllerAppQy.initialize()`, which the provider in `main_app_qy.dart` calls.
- `QyApp` (in `main_app_qy.dart`) builds above `MaterialApp.router`. For a SnackBar or i18n, use `routerConfig.configuration.navigatorKey.currentContext`.
- `app_main` has app_qy commented out, so only the standalone qy entry wires app_qy providers.

**Why:** these cost a full sweep to rediscover during the client-key route-auth rollout.
**How to apply:** check these first when an app_qy call fails auth or a global notice must show; confirm a route exists in `poly_apps/laravel_main/routes/` before trusting an app_qy endpoint constant.
