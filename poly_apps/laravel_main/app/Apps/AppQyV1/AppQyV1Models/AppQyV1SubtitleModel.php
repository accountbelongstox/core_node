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

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaSourceQueries;
use App\Models\Concerns\QueriesPosterMedia;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Subtitle (movie) source. Has audio+video clip segments (media_segments).
 */
class AppQyV1SubtitleModel extends Model
{
    use AppQyV1MediaSourceQueries, QueriesPosterMedia;

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
        'selected_languages',
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
        'poster_mcp_submitted_at',
        'assist_claimed_at',
        'assist_claimed_by',
    ];

    protected $casts = [
        'duration_sec' => 'float',
        'selected_languages' => 'array',
        'files' => 'array',
        'subtitle_count' => 'integer',
        'segment_count' => 'integer',
        'sentence_count' => 'integer',
        'synced_at' => 'datetime',
        'metadata' => 'array',
        'poster_meta' => 'array',
        'poster_fetched_at' => 'datetime',
        'poster_mcp_submitted_at' => 'datetime',
        'assist_claimed_at' => 'datetime',
    ];

    public function segments(): HasMany
    {
        return $this->hasMany(AppQyV1MediaSegmentModel::class, 'source_key', 'source_key');
    }

    public function sourceSentences(): HasMany
    {
        return $this->hasMany(AppQyV1SourceSentenceModel::class, 'source_key', 'source_key');
    }

    /**
     * Per-language chapters of this subtitle (Books v3.1 model). Chapters live in
     * {prefix}_chapters_{lang}; returns a query against the requested language's
     * chapter table scoped to this subtitle (source_type='subtitle').
     */
    public function chaptersForLang(string $lang)
    {
        return AppQyV1LangChapterModel::onLang($lang)
            ->where('source_type', 'subtitle')
            ->where('source_key', $this->source_key)
            ->orderBy('chapter_index');
    }
}
