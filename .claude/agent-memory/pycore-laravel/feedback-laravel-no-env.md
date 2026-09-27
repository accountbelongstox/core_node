---
name: feedback-laravel-no-env
description: User ruling (repeated 2026-09-27) - Laravel must not read env/.env; settings live in config files (LaravelConfig constants) and generated secrets in RuntimeConfigurationStore
metadata:
  type: feedback
---

Laravel never takes settings from `env()` / `.env`. Use config files: `app/Constants/LaravelConfig.php` for fixed settings, and `App\Support\RuntimeConfigurationStore` (`.core_node_secrets` under the PathMapper `laravel_data_dir`, 0700/0600) for generated per-install values (super code, CodeMart password, PG password mirror).

**Why:** the user said it more than once ("larave不使用env，说了，使用配置文件"). `bootstrap/app.php` already points Dotenv at an absent file, so `.env` keys are dead; any `env()` left in `config/*.php` only reads the process environment and silently diverges between hosts.

**How to apply:** never propose "set X in .env" as a fix or a server step; replace remaining `env()` reads with config-file values; shell scripts pass Laravel values through artisan or the runtime store, not environment keys. Related: [[feedback-175-ensure-semantics]].
