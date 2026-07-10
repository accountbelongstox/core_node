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
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Per-language authoritative sentence store (Books v3 unified model — see
 * poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md §3.1).
 *
 * One physical table per supported language: {prefix}_sentences_{lang}. The
 * table is bound dynamically; always obtain an instance via LangSentence::for($lang)
 * (or a query via LangSentence::onLang($lang)) so the correct table is selected.
 * Deduped on content_id. AI/detail fields are enrich-only (never clobbered).
 */
class LangSentence extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    protected $fillable = [
        'content_id',
        'sentence_id',
        'corr_id',
        'text',
        'language',
        'explanation',
        'ai_commentary',
        'grammar',
        'special_usage',
        'audio',
        'has_audio',
        'occurrence_count',
        'metadata',
        'audio_files',
        'tts_status',
        'tts_attempts',
        'tts_error',
        'tts_locked_at',
        'tts_locked_by',
        'tts_priority',
        'tts_requested_at',
        'tts_completed_at',
    ];

    protected $casts = [
        'has_audio' => 'boolean',
        'occurrence_count' => 'integer',
        'metadata' => 'array',
        'audio_files' => 'array',
        'tts_attempts' => 'integer',
        'tts_priority' => 'integer',
        'tts_locked_at' => 'datetime',
        'tts_requested_at' => 'datetime',
        'tts_completed_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    /**
     * Bind this instance to the per-language sentence table for $lang.
     * Returns $this for fluent chaining.
     */
    public function bindLanguage(string $lang): self
    {
        $this->setTable(AppQyV1TableMaps::getSentenceTableName(AppQyV1TableMaps::normalizeLangCode($lang)));
        return $this;
    }

    /**
     * A fresh model instance bound to the per-language sentence table for $lang.
     */
    public static function for(string $lang): self
    {
        $model = new self();
        $model->bindLanguage($lang);
        return $model;
    }

    /**
     * A query builder against the per-language sentence table for $lang.
     */
    public static function onLang(string $lang)
    {
        return self::for($lang)->newQuery();
    }
}
