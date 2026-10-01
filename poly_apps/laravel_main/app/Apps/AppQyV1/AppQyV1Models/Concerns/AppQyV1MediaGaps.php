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
 * predicates; ensureIndexes() builds the partial indexes on the SAME SQL text,
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

    /** Sentence without audio. */
    public const SENTENCE_AUDIO = 'has_audio IS NOT TRUE';

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
     * Idempotently creates one language's partial indexes on these exact
     * predicates: keyset listings (id) and claim heads (query_count DESC, id).
     * Called by the gap-index migration and by every sys:init table alignment,
     * so a language table created after the migration ran gets them too.
     */
    public static function ensureIndexes(string $connection, string $language): void
    {
        $suffix = strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', $language));
        $dictionaryTable = AppQyV1TableMaps::getDictionaryTableName($language);

        foreach (self::WORD_GAPS as $gap => $predicate) {
            SafeMigrationHelper::safeAddPgPartialIndex($connection, $dictionaryTable, 'idx_dct_' . $suffix . '_gap_' . $gap . '_id', ['id'], $predicate, false);
            SafeMigrationHelper::safeAddPgPartialIndex($connection, $dictionaryTable, 'idx_dct_' . $suffix . '_gap_' . $gap . '_rank', ['query_count DESC', 'id'], $predicate, false);
        }
        SafeMigrationHelper::safeAddPgPartialIndex(
            $connection,
            AppQyV1TableMaps::getSentenceTableName($language),
            'idx_sent_' . $suffix . '_gap_audio_id',
            ['id'],
            self::SENTENCE_AUDIO,
            false
        );
    }

    private function __construct()
    {
    }
}
