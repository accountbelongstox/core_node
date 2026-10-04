<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
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


    /** Row origin: a content source (book/subtitle/document/article, study gen) or an ad-hoc playback text. */
    public const ORIGIN_CONTENT = 'content';
    public const ORIGIN_ADHOC = 'adhoc';

    /** phrase_status values (NULL = pending, the AppQyV1MediaGaps::SENTENCE_PHRASES gap). */
    public const PHRASE_DONE = 'done';
    public const PHRASE_NONE = 'none';
    public const PHRASE_FAILED = 'failed';

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
        'origin',
        'metadata',
        'audio_files',
        'tts_status',
        'tts_attempts',
        'tts_error',
        'tts_locked_at',
        'tts_locked_by',
        'tts_lease_id',
        'tts_lease_expires_at',
        'tts_requested_at',
        'tts_completed_at',
        'phrase_status',
        'phrase_attempts',
        'phrase_lease_id',
        'phrase_lease_expires_at',
        'phrase_locked_by',
        'phrase_priority',
        'phrase_generated_at',
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
            'phrase_attempts' => 'integer',
            'phrase_priority' => 'integer',
            'phrase_lease_expires_at' => 'datetime',
            'phrase_generated_at' => 'datetime',
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
            ->select(['id', 'content_id', 'text'])
            ->chunkById(1000, static function ($rows) use (&$map): void {
                foreach ($rows as $row) {
                    $map[(string) $row->content_id] = (string) $row->text;
                }
            });

        return $map;
    }

    /**
     * Keyset page of sentences still lacking audio (AppQyV1MediaGaps::SENTENCE_AUDIO),
     * ordered by id: rows with id > $afterId, at most $limit rows. Read-only
     * keyset listings (without_audio, Queue Center "awaiting audio"); no OFFSET and no COUNT per page.
     */
    public static function withoutAudioKeysetPage(string $lang, int $afterId, int $limit, array $columns = ['id', 'content_id', 'text', 'language']): Collection
    {
        if (!self::tableExists($lang)) {
            return new Collection();
        }

        return self::onLang($lang)
            ->whereRaw('(' . AppQyV1MediaGaps::SENTENCE_AUDIO . ')')
            ->where('id', '>', $afterId)
            ->orderBy('id')
            ->limit($limit)
            ->get($columns);
    }

    /**
     * Classifies rows written before the origin column (origin IS NULL), once:
     * rows a live slot references are content; unreferenced rows created by the
     * playback resolver (corr_id "reader|...") are ad-hoc. Anything else stays
     * null (treated as library). Returns the content_ids turned ad-hoc.
     *
     * @return array{content:int,adhoc:array<int,string>}
     */
    public static function classifyLegacyOrigins(string $lang): array
    {
        $result = ['content' => 0, 'adhoc' => []];
        if (!self::tableExists($lang)) {
            return $result;
        }
        $model = self::for($lang);
        $table = '"' . $model->getTable() . '"';
        $links = '"' . AppQyV1SourceSentenceModel::query()->getModel()->getTable() . '"';
        $grains = implode(',', array_map(static fn (string $grain): string => "'" . $grain . "'", AppQyV1SourceSentenceModel::LIVE_GRAINS));

        $result['content'] = $model->getConnection()->update(
            "UPDATE {$table} SET origin = ? FROM (SELECT DISTINCT lang_content_ids::jsonb ->> ? AS cid FROM {$links} WHERE grain IN ({$grains})) refs"
            . " WHERE {$table}.content_id = refs.cid AND {$table}.origin IS NULL",
            [self::ORIGIN_CONTENT, $lang]
        );
        $result['adhoc'] = array_map(
            static fn ($row): string => (string) $row->content_id,
            $model->getConnection()->select(
                "UPDATE {$table} SET origin = ? WHERE origin IS NULL AND corr_id LIKE 'reader|%' RETURNING content_id",
                [self::ORIGIN_ADHOC]
            )
        );

        return $result;
    }

    /**
     * Read-only breakdown of the audio gap by the kind of source that uses each
     * row ("<source_type>", "seed:<source_key>" for $namedSources,
     * "unreferenced_reader" for playback-resolver rows, or "unreferenced"),
     * with failed rows and long rows (> $longChars) per kind.
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
            . " SELECT COALESCE(refs.kind, CASE WHEN s.corr_id LIKE 'reader|%' THEN 'unreferenced_reader' ELSE 'unreferenced' END) AS kind, COUNT(*) AS rows,"
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
            ->whereRaw('(' . AppQyV1MediaGaps::SENTENCE_AUDIO . ')')
            ->count();
    }

    /** Writes an explanation only where the row has none (fill-missing); returns rows written. */
    public static function fillExplanation(string $lang, string $contentId, string $explanation): int
    {
        return self::onLang($lang)
            ->where('content_id', $contentId)
            ->where(static function ($empty): void {
                $empty->whereNull('explanation')->orWhereRaw("btrim(explanation) = ''");
            })
            ->update(['explanation' => $explanation, 'updated_at' => now()]);
    }

    /** Failed rows still lacking audio back to pending with a fresh retry budget (the failed-reset path). */
    public static function resetFailedTts(string $lang, string $failedStatus, array $attributes): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->where('tts_status', $failedStatus)
            ->whereRaw('(' . AppQyV1MediaGaps::SENTENCE_AUDIO . ')')
            ->update($attributes);
    }

    /** Live sentences still waiting for phrase extraction (AppQyV1MediaGaps::SENTENCE_PHRASES). */
    public static function pendingPhraseCount(string $lang): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->whereRaw('(' . AppQyV1MediaGaps::SENTENCE_PHRASES . ')')
            ->count();
    }

    /** Failed phrase extractions back to the gap with a fresh attempt budget; returns rows re-pooled. */
    public static function repoolFailedPhrases(string $lang): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->where('phrase_status', self::PHRASE_FAILED)
            ->update([
                'phrase_status' => null,
                'phrase_attempts' => 0,
                'phrase_lease_id' => null,
                'phrase_lease_expires_at' => null,
                'phrase_locked_by' => null,
            ]);
    }

    /** Releases phrase-extraction leases whose expiry passed; returns rows released. */
    public static function clearExpiredPhraseLeases(string $lang): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->whereRaw(AppQyV1MediaGaps::SENTENCE_PHRASE_LEASED)
            ->where('phrase_lease_expires_at', '<', now())
            ->update([
                'phrase_lease_id' => null,
                'phrase_lease_expires_at' => null,
                'phrase_locked_by' => null,
            ]);
    }

    public static function runForLanguageTransaction(string $lang, Closure $callback, int $attempts = 1): mixed
    {
        return self::for($lang)->getConnection()->transaction($callback, $attempts);
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
