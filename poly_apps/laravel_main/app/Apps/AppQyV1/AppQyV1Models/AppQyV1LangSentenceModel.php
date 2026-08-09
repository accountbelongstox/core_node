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

use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Collection;

/**
 * Per-language authoritative sentence store (Books v3 unified model — see
 * poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md §3.1).
 *
 * One physical table per supported language: {prefix}_sentences_{lang}. The
 * table is bound dynamically; always obtain an instance via AppQyV1LangSentenceModel::for($lang)
 * (or a query via AppQyV1LangSentenceModel::onLang($lang)) so the correct table is selected.
 * Deduped on content_id. AI/detail fields are enrich-only (never clobbered).
 */
class AppQyV1LangSentenceModel extends Model
{
    use RunsModelTransactions;

    public function scopeContainingWord($query, string $word)
    {
        $driver = $query->getModel()->getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            return $query->whereRaw('text ~* ?', ['\\y' . preg_quote($word, '/') . '\\y']);
        }

        return $query->whereRaw('LOWER(text) LIKE ?', ['%' . strtolower($word) . '%']);
    }
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

    public static function tableExists(string $lang): bool
    {
        $model = self::for($lang);

        return Schema::connection($model->getConnectionName())->hasTable($model->getTable());
    }

    public static function findByContentId(string $lang, string $contentId): ?self
    {
        return self::onLang($lang)->where('content_id', $contentId)->first();
    }

    public static function rowsByContentIds(string $lang, array $contentIds): Collection
    {
        return self::onLang($lang)
            ->whereIn('content_id', array_values(array_unique($contentIds)))
            ->get();
    }

    public static function containingWordRows(string $lang, string $word, int $limit): Collection
    {
        return self::onLang($lang)
            ->containingWord($word)
            ->orderByDesc('occurrence_count')
            ->limit($limit)
            ->get();
    }

    public static function storeOccurrence(string $lang, array $attributes): self
    {
        $contentId = (string) $attributes['content_id'];
        $row = self::findByContentId($lang, $contentId);

        if ($row === null) {
            $row = self::for($lang);
            $row->fill($attributes);
        } else {
            $row->occurrence_count = (int) $row->occurrence_count + 1;
        }

        $row->save();

        return $row;
    }
}
