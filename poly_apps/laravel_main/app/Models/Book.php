<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Book source. Maps sentences + audio only, NO video.
 */
class Book extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'books');
    }

    protected $fillable = [
        'source_key',
        'content_id',
        'title',
        'original_name',
        'ascii_name',
        'language',
        'full_content',
        'audio',
        'sentence_seq',
        'word_ids',
        'sentence_count',
        'synced_at',
        'metadata',
    ];

    protected $casts = [
        'audio' => 'array',
        'sentence_seq' => 'array',
        'word_ids' => 'array',
        'sentence_count' => 'integer',
        'synced_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function sourceSentences()
    {
        return $this->hasMany(SourceSentence::class, 'source_key', 'source_key');
    }
}
