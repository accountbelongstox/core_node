<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookAudioPlanService;
use App\Support\SchemaGate;

/**
 * Keeps the book audio plans in step with their books without an app read: plans whose
 * book gained sentences (study-content writeback) or that hold no clip for a requested
 * language sync their membership (audio_orchestration_contract book_plan).
 */
final class AppQyV1BookAudioPlanSyncTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 60;

    public function getExecutionMode(): string
    {
        return self::EXECUTION_BACKGROUND;
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function isEnabled(): bool
    {
        return SchemaGate::allowsTimer($this->getName());
    }

    public function exec(): void
    {
        $plans = app(AppQyV1BookAudioPlanService::class);
        $synced = $plans->syncPending((int) AppQyV1BookAudioPlanService::setting('membership_sync_max_plans'));
        if ($synced > 0) {
            $this->logInfo('book audio plans synced', ['plans' => $synced]);
        }
    }
}
