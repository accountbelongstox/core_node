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

use Closure;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\BindsAppQyV1LanguageTable;
use App\Models\Concerns\QueriesDiffIdPages;
use App\Utils\RunsModelTransactions;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
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
class AppQyV1LangSentenceModel extends AppQyV1Model
{
    use BindsAppQyV1LanguageTable, QueriesDiffIdPages, RunsModelTransactions;

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function containingWord(\Illuminate\Database\Eloquent\Builder $query, string $word): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereRaw('text ~* ?', ['\\y' . preg_quote($word, '/') . '\\y']);
    }

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
        'tts_requested_at',
        'tts_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'has_audio' => 'boolean',
            'occurrence_count' => 'integer',
            'metadata' => 'array',
            'audio_files' => 'array',
            'tts_attempts' => 'integer',
            'tts_locked_at' => 'datetime',
            'tts_requested_at' => 'datetime',
            'tts_completed_at' => 'datetime',
        ];
    }

    protected static function resolveLanguageTable(string $language): string
    {
        return AppQyV1TableMaps::getSentenceTableName(AppQyV1TableMaps::normalizeLangCode($language));
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

    public static function textMapByContentIds(string $lang, array $contentIds): array
    {
        if (!self::tableExists($lang)) {
            return [];
        }

        $map = [];
        self::onLang($lang)
            ->whereIn('content_id', array_values(array_unique($contentIds)))
            ->select(['content_id', 'text'])
            ->chunk(1000, static function ($rows) use (&$map): void {
                foreach ($rows as $row) {
                    $map[(string) $row->content_id] = (string) $row->text;
                }
            });

        return $map;
    }

    public static function countBySqlFilter(string $language, string $whereSql, array $bindings): int
    {
        $model = self::for($language);
        $row = $model->getConnection()->selectOne(
            'SELECT COUNT(*) AS aggregate_value FROM "' . $model->getTable() . '" WHERE ' . $whereSql,
            $bindings
        );

        return (int) ($row->aggregate_value ?? 0);
    }

    public static function containingWordRows(string $lang, string $word, int $limit): Collection
    {
        return self::onLang($lang)
            ->containingWord($word)
            ->orderByDesc('occurrence_count')
            ->limit($limit)
            ->get();
    }

    public static function rowsNeedingEnrichment(string $lang, array $fields, int $limit): Collection
    {
        return self::enrichmentQuery($lang, $fields)
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public static function countNeedingEnrichment(string $lang, array $fields): int
    {
        return self::enrichmentQuery($lang, $fields)->count();
    }

    public static function claimableAudioRows(string $lang, mixed $cutoff, int $limit): Collection
    {
        return self::onLang($lang)
            ->where(function ($query) use ($cutoff): void {
                $query->whereNull('tts_locked_at')
                    ->orWhere('tts_locked_at', '<', $cutoff);
            })
            ->where(function ($query): void {
                $query->where('has_audio', false)
                    ->orWhereIn('tts_status', ['pending', 'failed'])
                    ->orWhere(function ($completedQuery): void {
                        $completedQuery->where('has_audio', true)
                            ->where('tts_status', 'completed');
                    });
            })
            ->orderByDesc('occurrence_count')
            ->orderBy('id')
            ->limit($limit)
            ->lockForUpdate()
            ->get();
    }

    public static function pendingAudioCount(string $lang): int
    {
        return self::onLang($lang)
            ->where(function ($query): void {
                $query->where('has_audio', false)
                    ->orWhereIn('tts_status', ['pending', 'failed']);
            })
            ->count();
    }

    public static function runForLanguageTransaction(string $lang, Closure $callback, int $attempts = 1): mixed
    {
        return self::for($lang)->getConnection()->transaction($callback, $attempts);
    }

    public static function pendingAudioRowsByIds(string $lang, array $ids): array
    {
        return self::onLang($lang)
            ->whereIn('id', $ids)
            ->where('has_audio', false)
            ->orderBy('id')
            ->get(['id', 'content_id', 'text'])
            ->all();
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

    private static function enrichmentQuery(string $lang, array $fields)
    {
        return self::onLang($lang)->where(function ($query) use ($fields): void {
            foreach ($fields as $field) {
                $query->orWhereNull($field)->orWhere($field, '');
            }

            $query->orWhereNull('audio')->orWhere('audio', '');
        });
    }
}
