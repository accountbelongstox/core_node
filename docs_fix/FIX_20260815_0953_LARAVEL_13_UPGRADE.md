# Laravel Main Laravel 13 Architecture Upgrade

Date: 2026-08-15

Status: source architecture updated. Runtime, Composer, Artisan, database, build, service, and test execution were not performed during this change.

## 1. Scope

This upgrade covers the Laravel 13 startup boundary, Laravel Main configuration, `sys:init`, the global models used by initialization, and the AppQyV1 model layer.

The implementation is Laravel 13-only. It does not retain a Laravel 12 runtime branch, deprecated middleware alias, duplicate model implementation, or thin forwarding model.

Project invariants remain unchanged:

- PostgreSQL is the Laravel database engine.
- `php artisan sys:init` is the database initialization entry point.
- Existing database tables must not be dropped, rebuilt, refreshed, or recreated to apply an update.
- Schema alignment is in place through `SafeMigrationHelper`; missing columns and indexes may be added and approved columns may be adjusted or dropped in place.
- No database operation was executed as part of this source change.

## 2. Official Laravel 13 baseline

The implementation follows these official Laravel 13 references:

- [Upgrade guide](https://laravel.com/docs/13.x/upgrade)
- [Eloquent models and local scopes](https://laravel.com/docs/13.x/eloquent#local-scopes)
- [Eloquent attribute casting](https://laravel.com/docs/13.x/eloquent-mutators#attribute-casting)
- [Query Builder string clauses and locking](https://laravel.com/docs/13.x/queries)
- [Cache stale-while-revalidate](https://laravel.com/docs/13.x/cache#stale-while-revalidate)
- [CSRF protection](https://laravel.com/docs/13.x/csrf)

The application requires PHP `^8.4` and `laravel/framework` `^13.0`. The committed lock file currently resolves Laravel Framework `v13.25.0`.

Laravel 13 breaking changes applied here include:

- `PreventRequestForgery` and `preventRequestForgery(...)` replace Laravel 12 CSRF names.
- Cache and Redis prefixes use the Laravel 13 hyphenated convention.
- Cache `serializable_classes` is `false`; application caches use arrays and scalar values.
- Session serialization is JSON.
- Eloquent casts use `protected function casts(): array`.
- Local scopes use protected `#[Scope]` methods with typed Eloquent builders.

## 3. Laravel 13-only startup boundary

The supported launchers import dedicated upgrade modules:

- `poly_apps/laravel_main/scripts/start.sh` sources `upgrade_laravel_13.sh`.
- `poly_apps/laravel_main/scripts/start.ps1` imports `upgrade_laravel_13.ps1` through an absolute path.

The upgrade stage runs after PHP, Composer, and Laravel runtime directories are ready, but before dependency installation and every Artisan command.

The version decision is deterministic:

1. Read the installed `laravel/framework` version from Composer metadata; use `composer.lock` only when `vendor` is absent.
2. Laravel 13 continues directly.
3. A missing installed version continues to the normal Composer install path, which is constrained by `composer.json` to Laravel 13.
4. Laravel 12 prompts `Laravel 12 detected. Upgrade to Laravel 13? [y/N]`.
5. Empty input, non-interactive input, or any answer other than `y` stops startup. Laravel 12 is never booted.
6. An unsupported framework major stops startup.
7. After explicit `y`, the script resolves the Laravel root and verifies the exact `vendor` target. PowerShell also rejects a reparse-point target.
8. Only the verified Laravel `vendor` directory is removed.
9. Composer runs `update --with-all-dependencies --no-interaction` against the resolved Laravel root.
10. The installed framework major is checked again and startup stops unless it is Laravel 13.

This is a one-time version boundary, not an ongoing compatibility layer. The destructive `vendor` removal is gated by explicit user confirmation and exact-path validation.

## 4. Native Laravel 13 configuration

Laravel Main now uses the Laravel 13 application configuration directly:

- `composer.json` requires Laravel 13, Tinker 3, Boost 2, Pest 4, and compatible package lines.
- `bootstrap/app.php` calls `preventRequestForgery(...)` directly.
- `config/sanctum.php` points its CSRF middleware entry to `PreventRequestForgery`.
- `config/cache.php` disables arbitrary class unserialization.
- `LaravelConfig` owns hyphenated cache, Redis, and session names.
- Session serialization is JSON.
- `AppServiceProvider` applies strict model behavior appropriate to the Laravel 13 runtime.

No `method_exists`, `class_exists`, deprecated CSRF alias, or Laravel 12 configuration branch is used to bridge framework versions.

## 5. `sys:init` architecture

`InitializeApps` is now orchestration-only. It does not call `DB`, `Schema`, or a query builder table directly. Database inspection and mutation are owned by initializers and models.

Required initialization stages fail fast. An error in migrations, invite tables, user synchronization, TTS cache tables, voice-subtitle tables, TTS queue data synchronization, TTS statistics, article libraries, dictionary initialization or summary, per-user QY tables, global tasks, media tables, punctuation markers, TTS configuration, or the in-place article type migration returns `Command::FAILURE` and stops startup.

Database safety is preserved:

- `migration:check-safety` runs before `migrate --force`.
- Table alignment uses `SafeMigrationHelper`.
- Existing tables are aligned in place and are not dropped or rebuilt by `sys:init`.
- The daily article type migration updates matching rows in place and writes its marker only after success.
- The intermediate TTS queue is read and synchronized into canonical tables without dropping its table.

Initialization reporting no longer performs a query per status or per language:

- Global task statuses use one grouped aggregate query.
- Worker statistics use one aggregate query and classify `busy` or `online` only while the heartbeat is fresh; stale rows are reported as offline.
- Dictionary table reporting obtains the PostgreSQL table list once and uses one `UNION ALL` aggregate for all existing language tables.
- Sentence and chapter totals use model-owned multi-table aggregates instead of per-language `hasTable` plus `count` loops.

The previous output showing one persisted `busy` worker did not prove that the worker was alive. The new statistic uses the heartbeat cutoff, so a stale `busy` record is counted as offline.

## 6. AppQyV1 model foundation

All top-level AppQyV1 models now inherit from `AppQyV1Model`.

The base model owns:

- the AppQyV1 connection name;
- fixed table suffix and table-map binding;
- canonical table-name construction;
- common `createRecord` and `findById` operations;
- configured-table existence and row-count operations.

Per-model connection assignments, repeated constructors, repeated table setup, repeated `getConnectionName`, and duplicate common CRUD methods were removed.

Dynamic language tables use two focused concerns:

- `BindsAppQyV1LanguageTable` for sentence and chapter models;
- `BindsAppQyV1DynamicLanguageTable` for dictionary and article-library models.

The unused `AppQyV1MultiLangDictionaryModel` forwarding class was deleted. The unused `CountsPosterStatuses` forwarding trait was also deleted. Canonical model classes and concerns are now called directly.

## 7. Shared query concerns and fatal collision resolution

The fatal error was caused by both `AppQyV1MediaSourceQueries` and `QueriesPosterMedia` being applied directly to `AppQyV1SubtitleModel`, so PHP received two implementations of `posterColumnAvailable`.

The final composition has one ownership path:

```text
Book / Subtitle
    -> AppQyV1MediaSourceQueries
        -> QueriesPosterMedia
```

`Book` and `Subtitle` no longer import `QueriesPosterMedia` independently. Shared study-source operations are centralized in `AppQyV1StudySourceQueries`; shared media, poster, source lookup, claim, release, and aggregate operations are centralized in `AppQyV1MediaSourceQueries` and `QueriesPosterMedia`.

There is no conflict-resolution alias or duplicate method patch. The duplicate trait application was removed at its architectural source.

## 8. Laravel 13 query and cache model

The upgraded global initialization models and AppQyV1 models use Laravel 13 conventions:

- Legacy `$casts` properties were replaced with `casts()` methods.
- Legacy public `scopeXxx` methods were replaced with protected typed `#[Scope]` methods.
- Case-insensitive search uses `whereLike` and `orWhereLike` instead of manual `LOWER(...) LIKE` or generic `like` branches.
- PostgreSQL JSON queries no longer carry SQLite or MySQL string-cast fallbacks in the upgraded model paths.
- Poster claims run in a transaction with `FOR UPDATE SKIP LOCKED` and update the claimed ID set together.
- Poster and initialization status counts use grouped aggregate queries.
- TTS default engines and variants are read once and written with bulk `upsert` calls using non-empty unique keys.
- Missing TTS engine or variant configuration throws explicitly; no synthetic in-code fallback configuration is returned.
- Expensive dictionary dashboard metrics use `Cache::flexible` stale-while-revalidate behavior.
- Cache callbacks return arrays and scalar values so `serializable_classes=false` remains enforceable.

## 9. Database restrictions

This work did not run migrations or connect to the database.

When `sys:init` is authorized and executed later, its schema contract is:

- create a missing required table only through the canonical safe initializer;
- inspect and alter an existing table in place;
- add or adjust columns and indexes through `SafeMigrationHelper`;
- never use `migrate:fresh`, `migrate:refresh`, a table rebuild, a table drop, or a database reset;
- never delete and recreate a table to change one field.

Column removal or type adjustment is permitted only when explicitly represented as a reviewed in-place schema operation. No column drop was required or executed for this upgrade.

## 10. Execution status and acceptance

Completed as source work:

- official Laravel 13 documentation review;
- Laravel 13-only startup boundary for Linux/WSL and Windows;
- native Laravel 13 dependency and configuration declarations;
- `sys:init` fail-fast orchestration and model-owned statistics;
- global initialization model migration to Laravel 13 model conventions;
- AppQyV1 base model and dynamic-table concerns;
- duplicate query and compatibility shim removal;
- poster trait collision removal;
- PostgreSQL query, locking, bulk upsert, aggregation, and cache updates;
- read-only structural source inspection.

Not executed during this change:

- Composer install or update;
- PHP or Artisan commands;
- `sys:init`, migrations, or any database operation;
- tests or test creation;
- builds, services, servers, queues, or runtime probes;
- Git commands.

Runtime acceptance must therefore be performed separately when execution is authorized. The first acceptance run should exercise the launcher upgrade prompt on a disposable Laravel 12 dependency tree, then run the supported Laravel 13 startup path and confirm that `sys:init` reaches the media and QY model stages without a trait collision.
