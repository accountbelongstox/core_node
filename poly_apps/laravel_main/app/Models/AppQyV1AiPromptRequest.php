<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Models;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Model;

/**
 * AI prompt request inbox row -- the passive submission point consumed by
 * AppQyV1AiPromptFanoutTask (app/Services/TimerTasks). Insert one row here to
 * request AI processing; no direct caller-to-worker coupling.
 */
class AppQyV1AiPromptRequest extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'ai_prompt_requests');
    }

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

    protected $casts = [
        'prompt_keys' => 'array',
        'processed_at' => 'datetime',
    ];
}
