---
name: feedback-laravel-config-not-env
description: User ruling - Laravel reads settings from config files (LaravelConfig.php / runtime store), never env(); flag env() reads found in CodeMart backend paths
metadata:
  type: feedback
---

Laravel must not read settings through `env()` / `.env`; it uses config files (the `app/Constants/LaravelConfig.php` pattern and the runtime configuration store).

**Why:** the user restated it with emphasis on 2026-09-27 ("larave不使用env ，说了，使用配置文件"); the live server ignores `.env` keys because `config/*.php` read LaravelConfig.php, so env-based settings silently do nothing.

**How to apply:** when auditing or consuming CodeMart backend settings (bank-transfer info, demo seeding switch, generated CodeMart/admin passwords, invite codes), treat any `env('CODEMART_*')` in `config/services.php` or CodeMartV1 as a conflict to route to `laravel` / `laravel-codemart`; never suggest an env key as the fix.
