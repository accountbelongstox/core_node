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
 * Per-language chapter store (Books v3.1 unified model — see
 * BOOKS_FEATURE_SPECIFICATION.md §3.2). Replaces the removed single-table
 * Chapter model.
 *
 * One physical table per supported language: {prefix}_chapters_{lang}. The table
 * is bound dynamically; always obtain an instance via LangChapter::for($lang)
 * (or a query via LangChapter::onLang($lang)). Cross-language correspondence is
 * by (source_type, source_key, chapter_index); the same chapter_index across the
 * per-language tables is the same chapter.
 */
class LangChapter extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    protected $fillable = [
        'source_type',
        'source_key',
        'chapter_index',
        'language',
        'title',
        'corr_id',
        'sentence_count',
        'metadata',
    ];

    protected $casts = [
        'chapter_index' => 'integer',
        'sentence_count' => 'integer',
        'metadata' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    /**
     * Bind this instance to the per-language chapter table for $lang.
     * Returns $this for fluent chaining.
     */
    public function bindLanguage(string $lang): self
    {
        $this->setTable(AppQyV1TableMaps::getChapterTableName(AppQyV1TableMaps::normalizeLangCode($lang)));
        return $this;
    }

    /** A fresh model instance bound to the per-language chapter table for $lang. */
    public static function for(string $lang): self
    {
        $model = new self();
        $model->bindLanguage($lang);
        return $model;
    }

    /** A query builder against the per-language chapter table for $lang. */
    public static function onLang(string $lang)
    {
        return self::for($lang)->newQuery();
    }
}
