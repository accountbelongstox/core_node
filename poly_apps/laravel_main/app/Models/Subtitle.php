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
 * Subtitle (movie) source. Has audio+video clip segments (media_segments).
 */
class Subtitle extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'subtitles');
    }

    protected $fillable = [
        'source_key',
        'title',
        'original_name',
        'ascii_name',
        'language',
        'duration_sec',
        'rel_path',
        'output_dir',
        'full_content',
        'files',
        'subtitle_count',
        'segment_count',
        'sentence_count',
        'synced_at',
        'metadata',
        'poster_filename',
        'poster_provider',
        'poster_source_id',
        'poster_status',
        'poster_meta',
        'poster_fetched_at',
        'assist_claimed_at',
        'assist_claimed_by',
    ];

    protected $casts = [
        'duration_sec' => 'float',
        'files' => 'array',
        'subtitle_count' => 'integer',
        'segment_count' => 'integer',
        'sentence_count' => 'integer',
        'synced_at' => 'datetime',
        'metadata' => 'array',
        'poster_meta' => 'array',
        'poster_fetched_at' => 'datetime',
        'assist_claimed_at' => 'datetime',
    ];

    public function segments()
    {
        return $this->hasMany(MediaSegment::class, 'source_key', 'source_key');
    }

    public function sourceSentences()
    {
        return $this->hasMany(SourceSentence::class, 'source_key', 'source_key');
    }
}
