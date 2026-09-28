<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


/**
 * AI prompt request inbox row -- the passive submission point consumed by
 * AppQyV1AiPromptFanoutTask (app/Services/TimerTasks). Insert one row here to
 * request AI processing; no direct caller-to-worker coupling.
 */
class AppQyV1AiPromptRequestModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'ai_prompt_requests';

    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSED = 'processed';
    const STATUS_FAILED = 'failed';

    protected $fillable = [
        'source_text',
        'language',
        'target_language',
        'prompt_keys',
        'status',
        'requested_by',
        'processed_at',
        'error',
    ];

    protected function casts(): array
    {
        return [
            'prompt_keys' => 'array',
            'processed_at' => 'datetime',
        ];
    }

    public static function pendingBatch(int $limit)
    {
        return self::query()
            ->where('status', self::STATUS_PENDING)
            ->oldest('created_at')
            ->limit($limit)
            ->get();
    }
}
