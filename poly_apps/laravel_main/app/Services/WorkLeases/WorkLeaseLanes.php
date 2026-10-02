<?php

namespace App\Services\WorkLeases;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Services\QueueCenter\DictLane\DictLaneCatalog;
use App\Services\QueueCenter\GapLaneSnapshot;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PerLanguageMetricsModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Support\QueueCenterContract;
use Illuminate\Database\ConnectionInterface;

/**
 * The gap lanes a work lease can hand out (contract work_leases.lanes): per
 * lane the per-language table, its AppQyV1MediaGaps predicate, the contract
 * claim order and the row fields an item carries.
 */
final class WorkLeaseLanes
{
    public const WORD_AUDIO = 'word_audio';
    public const SENTENCE_AUDIO = 'sentence_audio';

    /**
     * A row is free when it carries no live lease; a failed row waits for the
     * failed reset. The one placeholder is "now" from the application clock,
     * the same clock that writes tts_lease_expires_at.
     */
    public const FREE = '(tts_lease_expires_at IS NULL OR tts_lease_expires_at < ?) AND ' . AppQyV1MediaGaps::TTS_NOT_FAILED;

    /** A row out of the pool after its retry budget ran out (FREE excludes it until a reset). */
    public const FAILED = AppQyV1MediaGaps::TTS_FAILED;

    /** A row under a live work lease; the one placeholder is the application "now". */
    public const LEASED = 'tts_lease_id IS NOT NULL AND tts_lease_expires_at >= ?';

    /** The LEASED predicate for one loaded row (same clock, same columns). */
    public static function isLeased(object $row): bool
    {
        $expiresAt = $row->tts_lease_expires_at ?? null;

        return ($row->tts_lease_id ?? null) !== null && $expiresAt !== null && \Illuminate\Support\Carbon::parse($expiresAt)->gte(now());
    }

    /** @return array<int,string> */
    public static function lanes(): array
    {
        return array_values(array_intersect(
            (array) (QueueCenterContract::section('work_leases')['lanes'] ?? []),
            [self::WORD_AUDIO, self::SENTENCE_AUDIO]
        ));
    }

    public static function isLane(string $lane): bool
    {
        return in_array($lane, self::lanes(), true);
    }

    /** @var array<int,string>|null sentence languages with a table (one listing per worker) */
    private static ?array $sentenceLanguages = null;

    /** Languages a lane can serve at all (a table exists; a word report also needs the language's report-id index). */
    public static function languages(string $lane): array
    {
        return $lane === self::WORD_AUDIO
            ? array_values(array_intersect(DictLaneCatalog::languages(), AppQyV1DictionaryTTSCoordinator::supportedLanguages()))
            : self::sentenceLanguages();
    }

    /** Sentence languages whose table exists: one information_schema read per worker (tables come from sys:init). */
    private static function sentenceLanguages(): array
    {
        $tables = [];

        if (self::$sentenceLanguages !== null) {
            return self::$sentenceLanguages;
        }
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $tables[$language] = AppQyV1TableMaps::getSentenceTableName($language);
        }
        self::$sentenceLanguages = array_keys(AppQyV1PerLanguageMetricsModel::filterExistingTables(
            AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1),
            $tables
        ));

        return self::$sentenceLanguages;
    }

    public static function table(string $lane, string $language): string
    {
        return $lane === self::WORD_AUDIO
            ? AppQyV1TableMaps::getDictionaryTableName($language)
            : AppQyV1TableMaps::getSentenceTableName($language);
    }

    public static function gap(string $lane): string
    {
        return $lane === self::WORD_AUDIO ? AppQyV1MediaGaps::WORD_AUDIO : AppQyV1MediaGaps::SENTENCE_AUDIO;
    }

    /** Failed rows the resurfacing sweep returns to the pool: still in the lane's gap. */
    public static function resurfaceable(string $lane): string
    {
        return self::FAILED . ' AND (' . self::gap($lane) . ')';
    }

    public static function rank(string $lane): string
    {
        return (string) QueueCenterContract::section('work_leases')['rank'][$lane];
    }

    /** Column holding the content key a delivery and a want entry use. */
    public static function keyColumn(string $lane): string
    {
        return $lane === self::WORD_AUDIO ? 'md5' : 'content_id';
    }

    public static function textColumn(string $lane): string
    {
        return $lane === self::WORD_AUDIO ? 'content' : 'text';
    }

    /** Gap size of one lane and language (the lane snapshot). */
    public static function gapCount(string $lane, string $language): int
    {
        return GapLaneSnapshot::language($lane, $language)['gap'];
    }

    /** One claimed row as a contract claim_response item (engine hint / variant key: a book plan fast-pass row or quality upgrade). */
    public static function item(string $lane, string $language, object $row, ?string $engineHint = null, ?string $variantKey = null): array
    {
        $isWord = $lane === self::WORD_AUDIO;

        return [
            'lane' => $lane,
            'row_id' => (int) $row->id,
            'language' => $language,
            'text' => (string) $row->text,
            'content_id' => $isWord ? null : (string) $row->content_key,
            'md5' => $isWord ? (string) $row->content_key : null,
            'priority' => (int) $row->tts_priority,
            'engine_hint' => $engineHint,
            'variant_key' => $variantKey,
        ];
    }

    public static function connection(string $lane, string $language): ConnectionInterface
    {
        return $lane === self::WORD_AUDIO
            ? \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel::forLanguage($language)->getConnection()
            : AppQyV1LangSentenceModel::for($language)->getConnection();
    }

    private function __construct()
    {
    }
}
