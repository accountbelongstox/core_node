<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1SuperCodeService;
use App\Services\OctaneTimerService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('mcpv1:placeholder-cleanup')->daily()->at('03:00');

Artisan::command('octane-timer:background', function () {
    OctaneTimerService::backgroundLoop();
})->purpose('Run the background-lane timer tasks for about one minute');

// Admin-only (shell access) minting of DingDuoDuo v2 super codes (NC-008).
Artisan::command('dingduoduo:super-code {device : Extension device id (dev_<uuid>)} {--days=365 : Validity in days} {--tier= : License tier} {--max-binds= : Maximum PDD bindings (omit for unlimited)}', function (string $device) {
    $expiresAt = time() + max(1, (int) $this->option('days')) * 86400;
    $tier = (string) ($this->option('tier') ?: DingDuoDuoV1Constants::TIER_UNLIMITED);
    $maxBinds = $this->option('max-binds');

    $this->info(__('ding_duo_duo.super_code_minted', ['device' => $device, 'expires' => gmdate('c', $expiresAt)]));
    $this->line(DingDuoDuoV1SuperCodeService::mint($device, $expiresAt, $tier, ['*'], $maxBinds === null ? null : (int) $maxBinds));
})->purpose('Mint a device-bound DingDuoDuo v2 super code');
