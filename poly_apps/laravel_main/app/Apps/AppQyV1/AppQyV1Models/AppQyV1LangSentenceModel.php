<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use Closure;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\BindsAppQyV1LanguageTable;
use App\Models\Concerns\QueriesDiffIdPages;
use App\Utils\RunsModelTransactions;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

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

    private const GAP_COUNT_CACHE_SECONDS = 30;

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

    /**
     * Keyset page of sentences still lacking audio (AppQyV1MediaGaps::SENTENCE_AUDIO),
     * ordered by id: rows with id > $afterId, at most $limit rows. Read-only
     * listing consumed by the pycore sentence full pull (Part2 backlog mirror
     * of the sentence_audio lane); no OFFSET and no COUNT per page.
     */
    public static function withoutAudioKeysetPage(string $lang, int $afterId, int $limit): Collection
    {
        if (!self::tableExists($lang)) {
            return new Collection();
        }

        return self::onLang($lang)
            ->whereRaw('(' . AppQyV1MediaGaps::SENTENCE_AUDIO . ')')
            ->where('id', '>', $afterId)
            ->orderBy('id')
            ->limit($limit)
            ->get(['id', 'content_id', 'text', 'language']);
    }

    public static function withoutAudioCount(string $lang): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->whereRaw('(' . AppQyV1MediaGaps::SENTENCE_AUDIO . ')')
            ->count();
    }

    /**
     * Contract progress_template counts of the sentence audio gap (cached
     * briefly: a keyset walk asks once per page). gap = failed + pending is
     * the without-audio listing total; done = live rows with audio.
     *
     * @return array{done:int,failed:int,pending:int}
     */
    public static function audioGapCounts(string $lang): array
    {
        if (!self::tableExists($lang)) {
            return ['done' => 0, 'failed' => 0, 'pending' => 0];
        }

        return Cache::remember('appqyv1:sentence_audio_gap:' . $lang, self::GAP_COUNT_CACHE_SECONDS, static function () use ($lang): array {
            $row = self::onLang($lang)
                ->selectRaw('COUNT(*) FILTER (WHERE ' . AppQyV1MediaGaps::SENTENCE_AUDIO . ') AS gap')
                ->selectRaw('COUNT(*) FILTER (WHERE ' . AppQyV1MediaGaps::SENTENCE_AUDIO . " AND tts_status = 'failed') AS failed")
                ->selectRaw('COUNT(*) FILTER (WHERE ' . AppQyV1MediaGaps::SENTENCE_LIVE . ') AS total')
                ->toBase()
                ->first();
            $gap = (int) ($row->gap ?? 0);
            $failed = (int) ($row->failed ?? 0);

            return ['done' => max(0, (int) ($row->total ?? 0) - $gap), 'failed' => $failed, 'pending' => $gap - $failed];
        });
    }

    /**
     * Read-only breakdown of the audio gap by the kind of source that uses each
     * row ("<source_type>", "seed:<source_key>" for $namedSources, or
     * "unreferenced"), with failed rows and long rows (> $longChars) per kind.
     *
     * @param array<int,string> $namedSources source keys reported on their own
     * @return array<string,array{rows:int,failed:int,long:int}>
     */
    public static function audioGapBreakdown(string $lang, array $namedSources, int $longChars): array
    {
        $breakdown = [];
        if (!self::tableExists($lang)) {
            return $breakdown;
        }
        $model = self::for($lang);
        $links = AppQyV1SourceSentenceModel::query()->getModel()->getTable();
        $named = $namedSources === [] ? "''" : implode(',', array_map(static fn (string $key): string => $model->getConnection()->getPdo()->quote($key), $namedSources));
        $rows = $model->getConnection()->select(
            'WITH refs AS ('
            . ' SELECT DISTINCT ON (cid) cid, kind FROM ('
            . "  SELECT lang_content_ids::jsonb ->> ? AS cid, CASE WHEN source_key IN ({$named}) THEN 'seed:' || source_key ELSE source_type END AS kind"
            . '  FROM "' . $links . '" WHERE grain IN (' . implode(',', array_map(static fn (string $grain): string => "'" . $grain . "'", AppQyV1SourceSentenceModel::LIVE_GRAINS)) . ')'
            . ' ) r WHERE cid IS NOT NULL ORDER BY cid, kind)'
            . " SELECT COALESCE(refs.kind, 'unreferenced') AS kind, COUNT(*) AS rows,"
            . " COUNT(*) FILTER (WHERE s.tts_status = 'failed') AS failed, COUNT(*) FILTER (WHERE char_length(s.text) > ?) AS long"
            . ' FROM "' . $model->getTable() . '" s LEFT JOIN refs ON refs.cid = s.content_id'
            . ' WHERE ' . AppQyV1MediaGaps::SENTENCE_AUDIO
            . ' GROUP BY 1 ORDER BY 2 DESC',
            [$lang, $longChars]
        );
        foreach ($rows as $row) {
            $breakdown[(string) $row->kind] = ['rows' => (int) $row->rows, 'failed' => (int) $row->failed, 'long' => (int) $row->long];
        }

        return $breakdown;
    }

    /**
     * Live rows whose text may hold a glued verse marker: a PostgreSQL prefilter
     * that only narrows the scan; the caller decides with SentenceSegmenter.
     *
     * @return array<string,string> content_id => text
     */
    public static function verseMarkerCandidates(string $lang, string $candidatePattern): array
    {
        $rows = [];
        if (!self::tableExists($lang)) {
            return $rows;
        }
        self::onLang($lang)
            ->whereRaw(AppQyV1MediaGaps::SENTENCE_LIVE)
            ->whereRaw('text ~ ?', [$candidatePattern])
            ->select(['id', 'content_id', 'text'])
            ->chunkById(1000, static function ($chunk) use (&$rows): void {
                foreach ($chunk as $row) {
                    $rows[(string) $row->content_id] = (string) $row->text;
                }
            });

        return $rows;
    }

    /** Marks rows superseded by a re-segmentation (kept, never audio work again). */
    public static function markObsolete(string $lang, array $contentIds): int
    {
        if ($contentIds === []) {
            return 0;
        }

        return self::onLang($lang)
            ->whereIn('content_id', array_values($contentIds))
            ->whereRaw(AppQyV1MediaGaps::SENTENCE_LIVE)
            ->update(['obsolete_at' => now(), 'updated_at' => now()]);
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

    public static function pendingAudioCount(string $lang): int
    {
        return self::onLang($lang)
            ->where(function ($query): void {
                $query->whereRaw('(' . AppQyV1MediaGaps::SENTENCE_AUDIO . ')')
                    ->orWhereIn('tts_status', ['pending', 'failed']);
            })
            ->whereRaw(AppQyV1MediaGaps::SENTENCE_LIVE)
            ->count();
    }

    public static function runForLanguageTransaction(string $lang, Closure $callback, int $attempts = 1): mixed
    {
        return self::for($lang)->getConnection()->transaction($callback, $attempts);
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
