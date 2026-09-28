<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


/**
 * Fan-out idempotency ledger: one row per (request_id, prompt_key) pair
 * already turned into a global_tasks row. Unique on (request_id, prompt_key)
 * -- see AppQyV1AiPromptFanoutTask.
 */
class AppQyV1AiPromptRequestTaskModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'ai_prompt_request_tasks';

    protected $fillable = [
        'request_id',
        'prompt_key',
        'task_id',
    ];

    public static function promptKeysForRequest(int $requestId): array
    {
        return self::query()
            ->where('request_id', $requestId)
            ->pluck('prompt_key')
            ->all();
    }

}
