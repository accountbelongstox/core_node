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
 * Grammar point linked to a study segment (Book Study-Content Generation
 * pipeline §3.3). Batch-linked by segment_id + the denormalized
 * (source_type, source_key, segment_index) composite. Duplicates across segments
 * are allowed by design (no unique key on point).
 */
class AppQyV1StudyGrammarPointModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'study_grammar_points');
    }

    protected $fillable = [
        'segment_id',
        'source_type',
        'source_key',
        'segment_index',
        'language',
        'point',
        'explanation',
        'metadata',
    ];

    protected $casts = [
        'segment_id' => 'integer',
        'segment_index' => 'integer',
        'metadata' => 'array',
    ];
}
