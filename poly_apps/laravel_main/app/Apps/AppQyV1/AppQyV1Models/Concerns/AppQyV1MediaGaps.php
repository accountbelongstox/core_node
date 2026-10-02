<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\SafeMigrationHelper;
use App\Support\QueueCenterContract;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * The one definition of "missing audio" / "missing translation" for the
 * per-language dictionary (word) and sentence tables.
 *
 * Every scanner, lane, listing, count and claim query applies these
 * predicates; ensureWordIndexes() / ensureSentenceIndexes() build the partial
 * indexes on the SAME SQL text,
 * so the planner serves every gap query from them.
 */
final class AppQyV1MediaGaps
{
    /** Word rows a worker can process at all (an empty word is never work). */
    public const WORD_HAS_CONTENT = "btrim(COALESCE(content, '')) <> ''";

    /** A row without audio (NULL counts as missing); the audio part of every audio gap. */
    public const NO_AUDIO = 'has_audio IS NOT TRUE';

    /** A word the validity check did not reject (unchecked words count as real). */
    public const WORD_NOT_INVALID = 'is_valid IS NOT FALSE';

    /** A word the validity check rejected. */
    public const WORD_INVALID = 'is_valid IS FALSE';

    /** Word without audio that is worth voicing (validity-rejected words never enter the audio gap). */
    public const WORD_AUDIO = self::NO_AUDIO . ' AND ' . self::WORD_HAS_CONTENT . ' AND ' . self::WORD_NOT_INVALID;

    /** Word without any translation (neither the flag nor a stored map). */
    public const WORD_TRANSLATION = "has_translation IS NOT TRUE AND (translations IS NULL OR translations = '' OR translations = '{}' OR translations = '[]') AND " . self::WORD_HAS_CONTENT;

    /** Translation work: untranslated words already validated as real words. */
    public const WORD_TRANSLATION_WORK = self::WORD_TRANSLATION . ' AND is_valid IS TRUE';

    /** Validity work: words never checked. */
    public const WORD_VALIDITY_WORK = 'validity_checked_at IS NULL AND ' . self::WORD_HAS_CONTENT;

    /** Library sentence still in use: not superseded by a re-segmentation, not an ad-hoc playback text. */
    public const SENTENCE_LIVE = "obsolete_at IS NULL AND origin IS DISTINCT FROM 'adhoc'";

    /** Live sentence without audio. */
    public const SENTENCE_AUDIO = self::NO_AUDIO . ' AND ' . self::SENTENCE_LIVE;

    /** Sentence rows outside the library (obsolete or ad-hoc playback text). */
    public const SENTENCE_NOT_LIVE = 'NOT (' . self::SENTENCE_LIVE . ')';

    /** A gap row whose retry budget ran out (out of the lease pool until a reset or the resurfacing sweep). */
    public const TTS_FAILED = "tts_status = 'failed'";

    /** A row still in the lease pool (the failed part of WorkLeaseLanes::FREE). */
    public const TTS_NOT_FAILED = "tts_status IS DISTINCT FROM 'failed'";

    /** Columns each WORD_GAPS predicate reads (the per-index column check before a build). */
    private const WORD_GAP_READS = [
        'audio' => ['has_audio', 'content', 'is_valid'],
        'translation' => ['has_translation', 'translations', 'content'],
        'translation_work' => ['has_translation', 'translations', 'content', 'is_valid'],
        'validity_work' => ['validity_checked_at', 'content'],
    ];
    private const SENTENCE_LIVE_READS = ['obsolete_at', 'origin'];
    private const SENTENCE_AUDIO_READS = ['has_audio', 'obsolete_at', 'origin'];

    private const WORD_INDEX_PREFIX = 'idx_dct_';
    private const SENTENCE_INDEX_PREFIX = 'idx_sent_';
    private const LEASE_EXPIRY_INDEX = '_lease_expiry';

    /** Gap key => predicate (the keys name the partial indexes). */
    public const WORD_GAPS = [
        'audio' => self::WORD_AUDIO,
        'translation' => self::WORD_TRANSLATION,
        'translation_work' => self::WORD_TRANSLATION_WORK,
        'validity_work' => self::WORD_VALIDITY_WORK,
    ];

    /**
     * @template T of Builder
     * @param T $query
     * @return T
     */
    public static function apply(Builder $query, string $predicate): Builder
    {
        return $query->whereRaw('(' . $predicate . ')');
    }

    /**
     * Idempotently creates one language's dictionary partial indexes on these
     * exact predicates: keyset listings (id), claim heads (query_count DESC, id)
     * and the lease indexes. Called by the gap-index migrations and every
     * sys:init dictionary alignment (after it adds the columns); an index whose
     * columns the table lacks yet is skipped and built by a later call.
     */
    public static function ensureWordIndexes(string $connection, string $language): void
    {
        self::ensureIndexes($connection, AppQyV1TableMaps::getDictionaryTableName($language), self::indexDefinitions(true, $language));
    }

    /**
     * Idempotently creates one language's sentence gap and lease indexes.
     * Called by the sentence table alignment (MediaIngestTablesInitializer)
     * after it adds the columns, and by the hot-path index migration; an
     * index whose columns the table lacks yet is skipped.
     */
    public static function ensureSentenceIndexes(string $connection, string $language): void
    {
        self::ensureIndexes($connection, AppQyV1TableMaps::getSentenceTableName($language), self::indexDefinitions(false, $language));
    }

    /**
     * Every partial index of one language's word or sentence table, as
     * {name, columns, where, reads}; `reads` lists every column the index
     * and its predicate use. The lease part: the work-lease claim order
     * (contract work_leases.rank of the lane) over the gap rows still in the
     * pool (failed rows excluded, as the claim's FREE predicate does, so the
     * claim never walks them), the live-lease expiry the reaper reads and the
     * failed rows the resurfacing sweep walks by id. The former
     * <prefix>_gap_audio_lease (gap incl. failed rows) is no longer created;
     * dropping it is listed in docs_fix/PENDING_ACTIONS.md.
     *
     * @return array<int,array{name:string,columns:array<int,string>,where:string,reads:array<int,string>}>
     */
    public static function indexDefinitions(bool $wordTable, string $language): array
    {
        $prefix = ($wordTable ? self::WORD_INDEX_PREFIX : self::SENTENCE_INDEX_PREFIX) . self::indexSuffix($language);
        $gap = $wordTable ? self::WORD_AUDIO : self::SENTENCE_AUDIO;
        $gapReads = $wordTable ? self::WORD_GAP_READS['audio'] : self::SENTENCE_AUDIO_READS;
        $rank = self::leaseRank($wordTable);
        $definitions = [];

        if ($wordTable) {
            foreach (self::WORD_GAPS as $key => $predicate) {
                $definitions[] = ['name' => $prefix . '_gap_' . $key . '_id', 'columns' => ['id'], 'where' => $predicate, 'reads' => ['id', ...self::WORD_GAP_READS[$key]]];
                $definitions[] = ['name' => $prefix . '_gap_' . $key . '_rank', 'columns' => ['query_count DESC', 'id'], 'where' => $predicate, 'reads' => ['query_count', 'id', ...self::WORD_GAP_READS[$key]]];
            }
        } else {
            $definitions[] = ['name' => $prefix . '_gap_audio_lib_id', 'columns' => ['id'], 'where' => self::SENTENCE_AUDIO, 'reads' => ['id', ...self::SENTENCE_AUDIO_READS]];
            $definitions[] = ['name' => $prefix . '_not_live_id', 'columns' => ['id'], 'where' => self::SENTENCE_NOT_LIVE, 'reads' => ['id', ...self::SENTENCE_LIVE_READS]];
        }
        $definitions[] = ['name' => $prefix . '_gap_audio_free_lease', 'columns' => $rank, 'where' => $gap . ' AND ' . self::TTS_NOT_FAILED, 'reads' => [...self::columnNames($rank), ...$gapReads, 'tts_status']];
        $definitions[] = ['name' => $prefix . self::LEASE_EXPIRY_INDEX, 'columns' => ['tts_lease_expires_at'], 'where' => 'tts_lease_id IS NOT NULL', 'reads' => ['tts_lease_expires_at', 'tts_lease_id']];
        $definitions[] = ['name' => $prefix . '_tts_failed_id', 'columns' => ['id'], 'where' => self::TTS_FAILED, 'reads' => ['id', 'tts_status']];

        return $definitions;
    }

    /** Every column indexDefinitions() reads on a word or sentence table. */
    public static function indexedColumns(bool $wordTable): array
    {
        return array_values(array_unique(array_merge(...array_column(self::indexDefinitions($wordTable, 'en'), 'reads'))));
    }

    /** Name of the live-lease expiry index (the reaper's scan) on one language's word or sentence table. */
    public static function leaseExpiryIndex(bool $wordTable, string $language): string
    {
        return ($wordTable ? self::WORD_INDEX_PREFIX : self::SENTENCE_INDEX_PREFIX) . self::indexSuffix($language) . self::LEASE_EXPIRY_INDEX;
    }

    /**
     * Builds the indexes whose columns the table has now (one column listing
     * per table; one log line names the skipped ones), so migration order
     * never matters: the alignment that adds the columns calls this again.
     * Builds never block writes (concurrent outside a transaction; invalid
     * leftovers rebuilt).
     */
    private static function ensureIndexes(string $connection, string $table, array $definitions): void
    {
        $columns = array_flip(array_map('strtolower', Schema::connection($connection)->getColumnListing($table)));
        $skipped = [];

        if ($columns === []) {
            return;
        }
        foreach ($definitions as $definition) {
            if (array_diff($definition['reads'], array_keys($columns)) !== []) {
                $skipped[] = $definition['name'];
                continue;
            }
            SafeMigrationHelper::safeAddPgPartialIndexConcurrently($connection, $table, $definition['name'], $definition['columns'], $definition['where']);
        }
        if ($skipped !== []) {
            Log::info('[AppQyV1MediaGaps] partial indexes deferred until their columns exist', ['table' => $table, 'indexes' => $skipped]);
        }
    }

    /** @return array<int,string> bare column names of index column definitions ("query_count DESC" -> "query_count") */
    private static function columnNames(array $definitions): array
    {
        return array_map(static fn (string $column): string => (string) preg_split('/\s+/', trim($column), 2)[0], $definitions);
    }

    /** @return array<int,string> contract work_leases.rank of the word or sentence lane */
    private static function leaseRank(bool $wordTable): array
    {
        $lane = $wordTable ? 'word_audio' : 'sentence_audio';

        return array_map('trim', explode(',', (string) (QueueCenterContract::section('work_leases')['rank'][$lane] ?? 'id')));
    }

    private static function indexSuffix(string $language): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', $language));
    }

    private function __construct()
    {
    }
}
