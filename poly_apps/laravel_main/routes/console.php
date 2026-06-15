<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
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
