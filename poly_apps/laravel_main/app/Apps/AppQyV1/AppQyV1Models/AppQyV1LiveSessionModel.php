<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * Live session (Social Center expansion §LIVE). No native broadcast — an
 * external embed (external_url) plus SSE chat. status live|ended; viewer_count
 * recomputed from recent live_viewers heartbeats. created_at only.
 */
class AppQyV1LiveSessionModel extends AppQyV1Model
{
    public const STATUS_LIVE = 'live';
    public const STATUS_ENDED = 'ended';

    public $timestamps = false;


    protected ?string $appTableMapKey = 'LIVE_SESSIONS';

    protected $fillable = [
        'host_id',
        'title',
        'description',
        'status',
        'external_url',
        'viewer_count',
        'started_at',
        'ended_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'host_id' => 'integer',
            'viewer_count' => 'integer',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function messages(): HasMany
    {
        return $this->hasMany(AppQyV1LiveMessageModel::class, 'session_id');
    }

    public static function listed(string $status, int $limit): Collection
    {
        $query = null;

        $query = static::query();
        if ($status === self::STATUS_LIVE) {
            $query->where('status', self::STATUS_LIVE);
        }

        return $query->orderByDesc('id')->limit($limit)->get();
    }

    public static function startForHost(
        int $hostId,
        string $title,
        ?string $description,
        ?string $externalUrl
    ): self {
        return static::query()->create([
            'host_id' => $hostId,
            'title' => $title,
            'description' => $description,
            'status' => self::STATUS_LIVE,
            'external_url' => $externalUrl,
            'viewer_count' => 0,
            'started_at' => now(),
            'ended_at' => null,
            'created_at' => now(),
        ]);
    }

    public static function findSession(int $sessionId): ?self
    {
        return static::query()->find($sessionId);
    }

    public function endSession(): self
    {
        if ((string) $this->status !== self::STATUS_ENDED) {
            $this->status = self::STATUS_ENDED;
            $this->ended_at = now();
            $this->save();
        }

        return $this;
    }

    public function syncViewerCount(int $viewerCount): void
    {
        if ((int) $this->viewer_count === $viewerCount) {
            return;
        }

        $this->viewer_count = $viewerCount;
        $this->save();
    }
}
