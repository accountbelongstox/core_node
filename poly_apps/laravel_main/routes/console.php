<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// NOTE: Sub-minute timer tasks (app/Services/TimerTasks/*) are driven SOLELY by the
// Laravel Octane (Swoole) timer via OctaneTimerServiceProvider -> OctaneTimerService.
// Per development-guides/COMMON_TIMER_DESIGN_SPECIFICATION.md there must be exactly
// ONE timer instance per process. Do NOT re-register TimerTasks with the Laravel
// scheduler here: that would create a second, duplicate driver. Only genuine cron
// (non-timer) jobs belong below.
Schedule::command('mcpv1:placeholder-cleanup')->daily()->at('03:00');
