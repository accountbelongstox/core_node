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

// NOTE: Sub-minute timer tasks (app/Services/TimerTasks/*) share ONE heartbeat per
// process, owned entirely by OctaneTimerServiceProvider: Octane(Swoole) ->tick()
// when running under `octane:start`, otherwise a Schedule->everySecond() tick
// consumed by `php artisan schedule:work` (this is how Windows -- and any Linux/WSL
// fallback where Octane isn't the active server -- runs the same TimerTasks/* code
// as the primary Octane path). Do NOT register TimerTasks with the scheduler again
// here: OctaneTimerServiceProvider already owns that single registration; a second
// one here would double-drive them. Only genuine cron (non-timer) jobs belong below.
Schedule::command('mcpv1:placeholder-cleanup')->daily()->at('03:00');
