<?php

use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1SuperCodeService;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1SentenceQualityRepair;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CodeSyncJob;
use App\Services\OctaneTimerService;
use App\Support\ServiceContract;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('mcpv1:placeholder-cleanup')->daily()->at('03:00');
Schedule::call(static fn () => ServerManagerV1CodeSyncJob::start('scheduled'))
    ->name('code-sync-scheduled')
    ->cron('*/'.ServiceContract::positiveInt('code_sync.schedule_minutes').' * * * *')
    ->withoutOverlapping(ServiceContract::positiveInt('code_sync.schedule_minutes'));
Schedule::command('cache:prune-database-expired')->hourly()->withoutOverlapping(30);
Schedule::call(static fn () => (new AppQyV1SentenceQualityRepair())->run())
    ->name('sentence-quality-floor')
    ->everyTenMinutes()
    ->withoutOverlapping(10);

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
