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
 * Positional link between a source (subtitle|book) and the shared sentence
 * library. Stores BOTH grains: 'cue' (1 srt cue) and 'sentence' (merged).
 * Unique on (source_type, source_key, grain, seq).
 */
class SourceSentence extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'source_sentences');
    }

    protected $fillable = [
        'source_type',
        'source_key',
        'sentence_id',
        'grain',
        'seq',
        'seg_index',
        'sub_idx',
        'start_sec',
        'end_sec',
        'metadata',
    ];

    protected $casts = [
        'seq' => 'integer',
        'seg_index' => 'integer',
        'sub_idx' => 'integer',
        'start_sec' => 'float',
        'end_sec' => 'float',
        'metadata' => 'array',
    ];

    public function sentence()
    {
        return $this->belongsTo(Sentence::class, 'sentence_id', 'sentence_id');
    }
}
