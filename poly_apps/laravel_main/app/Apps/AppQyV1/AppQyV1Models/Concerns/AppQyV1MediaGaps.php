<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\SafeMigrationHelper;
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

    /** Word without audio. */
    public const WORD_AUDIO = 'has_audio IS NOT TRUE AND ' . self::WORD_HAS_CONTENT;

    /** Word without any translation (neither the flag nor a stored map). */
    public const WORD_TRANSLATION = "has_translation IS NOT TRUE AND (translations IS NULL OR translations = '' OR translations = '{}' OR translations = '[]') AND " . self::WORD_HAS_CONTENT;

    /** Translation work: untranslated words already validated as real words. */
    public const WORD_TRANSLATION_WORK = self::WORD_TRANSLATION . ' AND is_valid IS TRUE';

    /** Validity work: words never checked. */
    public const WORD_VALIDITY_WORK = 'validity_checked_at IS NULL AND ' . self::WORD_HAS_CONTENT;

    /** Sentence still in use (not superseded by a re-segmentation). */
    public const SENTENCE_LIVE = 'obsolete_at IS NULL';

    /** Live sentence without audio. */
    public const SENTENCE_AUDIO = 'has_audio IS NOT TRUE AND ' . self::SENTENCE_LIVE;

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
            'idx_sent_' . self::indexSuffix($language) . '_gap_audio_live_id',
            ['id'],
            self::SENTENCE_AUDIO,
            false
        );
    }

    private static function indexSuffix(string $language): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', $language));
    }

    private function __construct()
    {
    }
}
