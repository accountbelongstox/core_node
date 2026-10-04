<?php

namespace App\Services\WorkLeases;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangPhraseModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AudioBundleService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Support\AudioOrchestrationContract;
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
    public const PHRASE_AUDIO = 'phrase_audio';

    /** Gap lanes this class models, in contract order. */
    private const KNOWN = [self::WORD_AUDIO, self::SENTENCE_AUDIO, self::PHRASE_AUDIO];

    private const GAPS = [
        self::WORD_AUDIO => AppQyV1MediaGaps::WORD_AUDIO,
        self::SENTENCE_AUDIO => AppQyV1MediaGaps::SENTENCE_AUDIO,
        self::PHRASE_AUDIO => AppQyV1MediaGaps::PHRASE_AUDIO,
    ];

    private const NOT_LIVE = [
        self::SENTENCE_AUDIO => AppQyV1MediaGaps::SENTENCE_NOT_LIVE,
    ];

    private const KEY_COLUMNS = [
        self::WORD_AUDIO => 'md5',
        self::SENTENCE_AUDIO => 'content_id',
        self::PHRASE_AUDIO => 'content_id',
    ];

    private const TEXT_COLUMNS = [
        self::WORD_AUDIO => 'content',
        self::SENTENCE_AUDIO => 'text',
        self::PHRASE_AUDIO => 'text',
    ];

    /** Phrase columns the gap, failed and lease figures read (the rank columns are added from the contract). */
    private const PHRASE_GAP_READS = ['id', 'has_audio', 'tts_status', 'tts_lease_id', 'tts_lease_expires_at'];

    /** @var array<string,array<int,string>> lane => languages with a table (one listing per worker) */
    private static array $tableLanguages = [];

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
            self::KNOWN
        ));
    }

    public static function isLane(string $lane): bool
    {
        return in_array($lane, self::lanes(), true);
    }

    /** Whether $lane is one of the gap lanes this class models (contract listing aside). */
    public static function isGapLane(string $lane): bool
    {
        return in_array($lane, self::KNOWN, true);
    }

    /** Languages a lane can serve at all (a table exists; a word report also needs the language's report-id index). */
    public static function languages(string $lane): array
    {
        return $lane === self::WORD_AUDIO
            ? array_values(array_intersect(DictLaneCatalog::languages(), AppQyV1DictionaryTTSCoordinator::supportedLanguages()))
            : self::tableLanguages($lane);
    }

    /** Languages whose lane table exists: one information_schema read per lane and worker (tables come from sys:init). */
    private static function tableLanguages(string $lane): array
    {
        $tables = [];

        if (isset(self::$tableLanguages[$lane])) {
            return self::$tableLanguages[$lane];
        }
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $tables[$language] = self::table($lane, $language);
        }
        self::$tableLanguages[$lane] = array_keys(AppQyV1PerLanguageMetricsModel::filterExistingTables(
            AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1),
            $tables
        ));

        return self::$tableLanguages[$lane];
    }

    public static function table(string $lane, string $language): string
    {
        return match ($lane) {
            self::WORD_AUDIO => AppQyV1TableMaps::getDictionaryTableName($language),
            self::SENTENCE_AUDIO => AppQyV1TableMaps::getSentenceTableName($language),
            self::PHRASE_AUDIO => AppQyV1TableMaps::getPhraseTableName($language),
        };
    }

    public static function gap(string $lane): string
    {
        return self::GAPS[$lane];
    }

    /** Rows of the lane table outside its work (counted neither as gap nor as done), or null when every row counts. */
    public static function notLive(string $lane): ?string
    {
        return self::NOT_LIVE[$lane] ?? null;
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
        return self::KEY_COLUMNS[$lane];
    }

    public static function textColumn(string $lane): string
    {
        return self::TEXT_COLUMNS[$lane];
    }

    /** Columns the lane snapshot reads (a table not yet aligned by sys:init is left out). */
    public static function requiredColumns(string $lane): array
    {
        return match ($lane) {
            self::WORD_AUDIO => AppQyV1MediaGaps::indexedColumns(true),
            self::SENTENCE_AUDIO => AppQyV1MediaGaps::indexedColumns(false),
            self::PHRASE_AUDIO => array_values(array_unique(array_merge(
                self::PHRASE_GAP_READS,
                array_map(static fn (string $column): string => (string) preg_split('/\s+/', trim($column), 2)[0], explode(',', self::rank($lane)))
            ))),
        };
    }

    /** Name of the live-lease expiry index (the reaper's scan) on one language's lane table. */
    public static function leaseExpiryIndex(string $lane, string $language): string
    {
        return match ($lane) {
            self::WORD_AUDIO => AppQyV1MediaGaps::leaseExpiryIndex(true, $language),
            self::SENTENCE_AUDIO => AppQyV1MediaGaps::leaseExpiryIndex(false, $language),
            self::PHRASE_AUDIO => AppQyV1MediaGaps::phraseLeaseExpiryIndex($language),
        };
    }

    /** Clip resource kind of a lane's rows (clip.leased / clip.ready ids). */
    public static function resourceKind(string $lane): string
    {
        return match ($lane) {
            self::WORD_AUDIO => AppQyV1AudioBundleService::KIND_WORD,
            self::SENTENCE_AUDIO => AppQyV1AudioBundleService::KIND_SENTENCE,
            self::PHRASE_AUDIO => (string) AudioOrchestrationContract::phrasePipeline('kind'),
        };
    }

    /** Clip resource id of one claim item: a word by its lowercased text, a sentence or phrase by its content_id. */
    public static function resourceId(array $item): string
    {
        $lane = (string) $item['lane'];

        return AppQyV1AudioBundleService::resourceKey(
            self::resourceKind($lane),
            (string) $item['language'],
            $lane === self::WORD_AUDIO ? mb_strtolower(trim((string) $item['text'])) : (string) $item['content_id']
        );
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
        return match ($lane) {
            self::WORD_AUDIO => AppQyV1LangDictionaryModel::forLanguage($language)->getConnection(),
            self::SENTENCE_AUDIO => AppQyV1LangSentenceModel::for($language)->getConnection(),
            self::PHRASE_AUDIO => AppQyV1LangPhraseModel::for($language)->getConnection(),
        };
    }

    private function __construct()
    {
    }
}
