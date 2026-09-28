<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


/**
 * Gemini text-completion answer record.
 *
 * One row per completed `gemini_chat` global task. Written by
 * App\Services\TaskProcessors\GeminiTextTaskProcessor from the worker result
 * { answer?, provider:'gemini' } plus the originating task's payload
 * { question, title? }.
 */
class AppQyV1GeminiTextResultModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'gemini_text_results';

    protected $fillable = [
        'task_id',
        'title',
        'question',
        'answer',
        'provider',
    ];

}
