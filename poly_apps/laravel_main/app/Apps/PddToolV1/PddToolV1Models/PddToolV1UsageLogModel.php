<?php

namespace App\Apps\PddToolV1\PddToolV1Models;

use Illuminate\Support\Facades\Log;

/**
 * Per-member usage event log (for admin usage stats). created_at only.
 */
class PddToolV1UsageLogModel extends PddToolV1Model
{
    public $timestamps = false;

    protected ?string $appTableMapKey = 'USAGE_LOGS';

    protected $fillable = [
        'user_id',
        'action',
        'meta',
        'created_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'meta' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Best-effort usage log. A failure is logged and swallowed so it never breaks
     * the triggering action.
     */
    public static function record(int $userId, string $action, array $meta = []): void
    {
        try {
            static::query()->create([
                'user_id' => $userId,
                'action' => $action,
                'meta' => $meta,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('[PddToolV1UsageLog] create failed', [
                'user_id' => $userId,
                'action' => $action,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
