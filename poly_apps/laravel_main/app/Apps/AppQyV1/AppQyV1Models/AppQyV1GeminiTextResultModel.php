<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Model;

/**
 * Gemini text-completion answer record.
 *
 * One row per completed `gemini_chat` global task. Written by
 * App\Services\TaskProcessors\GeminiTextTaskProcessor from the worker result
 * { answer?, provider:'gemini' } plus the originating task's payload
 * { question, title? }.
 */
class AppQyV1GeminiTextResultModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'gemini_text_results');
    }

    protected $fillable = [
        'task_id',
        'title',
        'question',
        'answer',
        'provider',
    ];
}
