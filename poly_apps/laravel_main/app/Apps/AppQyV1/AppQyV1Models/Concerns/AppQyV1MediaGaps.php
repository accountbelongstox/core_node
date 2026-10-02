<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\SafeMigrationHelper;
use App\Support\QueueCenterContract;
use Illuminate\Contracts\Database\Query\Builder;

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

    /** Word without audio. */
    public const WORD_AUDIO = self::NO_AUDIO . ' AND ' . self::WORD_HAS_CONTENT;

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

    /** A gap row whose retry budget ran out (out of the lease pool until a reset or the resurfacing sweep). */
    public const TTS_FAILED = "tts_status = 'failed'";

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
     * exact predicates: keyset listings (id) and claim heads (query_count DESC, id).
     * Called by the gap-index migration and every sys:init dictionary alignment.
     */
    public static function ensureWordIndexes(string $connection, string $language): void
    {
        $suffix = self::indexSuffix($language);
        $dictionaryTable = AppQyV1TableMaps::getDictionaryTableName($language);

        foreach (self::WORD_GAPS as $gap => $predicate) {
            SafeMigrationHelper::safeAddPgPartialIndex($connection, $dictionaryTable, 'idx_dct_' . $suffix . '_gap_' . $gap . '_id', ['id'], $predicate, false);
            SafeMigrationHelper::safeAddPgPartialIndex($connection, $dictionaryTable, 'idx_dct_' . $suffix . '_gap_' . $gap . '_rank', ['query_count DESC', 'id'], $predicate, false);
        }
        self::ensureLeaseIndexes($connection, $dictionaryTable, 'idx_dct_' . $suffix, 'word_audio', self::WORD_AUDIO);
    }

    /**
     * Idempotently creates one language's sentence gap index. Called by the
     * sentence table alignment (MediaIngestTablesInitializer), after obsolete_at exists.
     */
    public static function ensureSentenceIndexes(string $connection, string $language): void
    {
        SafeMigrationHelper::safeAddPgPartialIndex(
            $connection,
            AppQyV1TableMaps::getSentenceTableName($language),
            'idx_sent_' . self::indexSuffix($language) . '_gap_audio_lib_id',
            ['id'],
            self::SENTENCE_AUDIO,
            false
        );
        self::ensureLeaseIndexes($connection, AppQyV1TableMaps::getSentenceTableName($language), 'idx_sent_' . self::indexSuffix($language), 'sentence_audio', self::SENTENCE_AUDIO);
    }

    /**
     * The work-lease claim order (contract work_leases.rank of the lane) over
     * the gap, the live-lease expiry the reaper reads and the failed rows the
     * resurfacing sweep walks by id.
     */
    private static function ensureLeaseIndexes(string $connection, string $table, string $prefix, string $lane, string $gap): void
    {
        $rank = array_map('trim', explode(',', (string) (QueueCenterContract::section('work_leases')['rank'][$lane] ?? 'id')));

        SafeMigrationHelper::safeAddPgPartialIndex($connection, $table, $prefix . '_gap_audio_lease', $rank, $gap, false);
        SafeMigrationHelper::safeAddPgPartialIndex($connection, $table, $prefix . '_lease_expiry', ['tts_lease_expires_at'], 'tts_lease_id IS NOT NULL', false);
        SafeMigrationHelper::safeAddPgPartialIndex($connection, $table, $prefix . '_tts_failed_id', ['id'], self::TTS_FAILED, false);
    }

    private static function indexSuffix(string $language): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', $language));
    }

    private function __construct()
    {
    }
}
