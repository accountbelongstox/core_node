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

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Study-content generation segment (Book Study-Content Generation pipeline §3.1 —
 * development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md).
 *
 * One row per planned ~500-char segment of a source (book|article|document).
 * THE anchor everything generated hangs off of, and the 60-minute claim lease
 * (claimed_at/claimed_by). Unique on (source_type, source_key, segment_index).
 */
class AppQyV1StudySegmentModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'study_segments');
    }

    protected $fillable = [
        'source_type',
        'source_key',
        'segment_index',
        'grain',
        'seq_start',
        'seq_end',
        'chapter_index',
        'primary_language',
        'char_count',
        'status',
        'attempts',
        'error',
        'claimed_at',
        'claimed_by',
        'languages_done',
        'provider',
        'generated_at',
        'metadata',
    ];

    protected $casts = [
        'segment_index' => 'integer',
        'seq_start' => 'integer',
        'seq_end' => 'integer',
        'chapter_index' => 'integer',
        'char_count' => 'integer',
        'attempts' => 'integer',
        'claimed_at' => 'datetime',
        'languages_done' => 'array',
        'generated_at' => 'datetime',
        'metadata' => 'array',
    ];
}
