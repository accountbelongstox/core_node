<?php

namespace App\Events;

use App\Support\QueueCenterContract;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class QueueCenterChangedEvent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $revision;
    public string $resource;
    public ?string $language;
    public int|string|null $resourceId;

    public function __construct(
        int $revision,
        string $resource,
        ?string $language = null,
        int|string|null $resourceId = null
    ) {
        $this->revision = $revision;
        $this->resource = $resource;
        $this->language = $language;
        $this->resourceId = $resourceId;
    }

    public function broadcastOn(): Channel
    {
        $realtime = QueueCenterContract::realtime();

        return new Channel((string) ($realtime['channel'] ?? 'queue-center'));
    }

    public function broadcastAs(): string
    {
        $realtime = QueueCenterContract::realtime();

        return (string) ($realtime['event'] ?? 'queue.changed');
    }

    public function broadcastWith(): array
    {
        return [
            'revision' => $this->revision,
            'resource' => $this->resource,
            'language' => $this->language,
            'resource_id' => $this->resourceId,
            'changed_at' => now()->toIso8601String(),
        ];
    }
}
