<?php

namespace App\Services\TimerTasks;

use App\Apps\MeshSync\MeshSyncServices\MeshSyncContract;
use App\Apps\MeshSync\MeshSyncServices\MeshSyncInitializer;
use App\Apps\MeshSync\MeshSyncServices\MeshSyncReplicator;

/** MeshSync anti-entropy: pull every due peer Laravel's change feed (background process). */
final class MeshSyncReplicationTask extends OctaneTimerTaskAbstract
{
    public function getExecutionMode(): string
    {
        return self::EXECUTION_BACKGROUND;
    }

    public function getInterval(): int
    {
        return MeshSyncContract::limit('replicate_interval_seconds');
    }

    public function isEnabled(): bool
    {
        return MeshSyncInitializer::missingTables() === [];
    }

    public function exec(): void
    {
        app(MeshSyncReplicator::class)->runRound();
    }
}
