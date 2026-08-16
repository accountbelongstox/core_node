<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

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
