<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaSourceQueries;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Subtitle (movie) source. Has audio+video clip segments (media_segments).
 */
class AppQyV1SubtitleModel extends AppQyV1Model
{
    use AppQyV1MediaSourceQueries;


    protected ?string $appTableSuffix = 'subtitles';

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

    protected function casts(): array
    {
        return [
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
    }

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
