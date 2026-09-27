---
name: verify-in-process-without-writes
description: How to verify laravel_main changes locally when builds/servers/tests are off-limits - scratchpad PHP that boots the kernel, array cache, rolled-back PG DDL, in-process HTTP kernel
metadata:
  type: project
---

When a task forbids tests, servers and builds, laravel_main changes can still be verified with a one-off scratchpad PHP script that requires `vendor/autoload.php`, boots `bootstrap/app.php` with the console kernel, and calls services directly.

- Switch the cache to memory first (`config(['cache.stores.database' => ['driver' => 'array']])`, or `cache.default => array`) so nonce/lock/cache writes never touch the database.
- Inject secrets through reflection into static caches (e.g. the client-key verifier's key map) instead of writing secret files.
- Read-only artisan commands (`route:list --json`, `list`, `schedule:list`, `migrate:status`) confirm middleware, scheduling and pending migrations.
- Always check that new `__()` keys resolve in both `en` and `zh_CN`. Laravel prefers `resources/lang` when that directory exists, which once silently disabled every translation.
- Schema code: PostgreSQL DDL is transactional, so `DB::connection($c)->beginTransaction()` ... `rollBack()` around SafeMigrationHelper / initializer calls shows exactly what they would add, with no residue. It cannot show per-statement failure isolation (an aborted txn fails every later statement).
- HTTP without a running server: create the `Request` first, `$app->instance('request', $request)`, then `$httpKernel->bootstrap()` and `handle()`. Bootstrapping the HTTP kernel before a request is bound crashes in the UrlGenerator.
- Capture log lines in the script with `Event::listen(MessageLogged::class, ...)`. The daily channel runs at `warning`, so `info` never reaches the log file.
- Several HTTP calls as different users in one script: call `app('auth')->forgetGuards()` before each `handle()`, or the Sanctum guard keeps the first user. Create tokens inside the rolled-back transaction on the default connection. After the console kernel has booted, `$httpKernel->handle($request)` works without re-bootstrapping.
- Artisan commands run inside the same transactions with `Artisan::call($name, $args)` (exit code) and `Artisan::output()`.
- The user commits snapshot commits ("win0.0.1") during a task, so `git diff HEAD` can be empty; diff against the commit that was HEAD when the task started.
- `laravel_db/*_init_status.json` "fully_initialized" is not proof that the schema was applied (the file is written outside the DB). Compare the declared structures with `information_schema` instead.

**Why:** In the 2026-09-27 sessions the user ruled out tests and services (the local FrankenPHP service was disabled). These checks caught a missing lang path that `php -l` could not, and a duplicate-index idempotency bug in SafeMigrationHelper.

**How to apply:** Run them after every change that adds lang keys, middleware, routes, crypto or schema. Keep the scripts in the scratchpad and never add test files. Related: [[laravel-route-auth-model]].
