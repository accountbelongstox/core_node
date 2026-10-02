<?php

namespace App\Support;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1DictionaryTableSchema;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Providers\PathMapper;
use App\Services\MediaIngestTablesInitializer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Schema gate of the gap tables (config/queue_center_contract.json schema_gate).
 *
 * The required revision is derived from the definitions the sys:init
 * alignment applies (AppQyV1DictionaryTableSchema formal columns,
 * MediaIngestTablesInitializer sentence columns, AppQyV1MediaGaps index
 * definitions). The alignment owners call recordIfAligned() when they finish;
 * it verifies every language table carries the columns and persists the
 * revision in the var center (OS-tagged key: one record per database host).
 * Readiness is cached per worker: once ready it stays ready; while pending it
 * re-reads the record at most every retry_after_seconds.
 */
final class SchemaGate
{
    public const READY = 'ready';
    public const PENDING = 'pending';

    private const REVISION_VAR = 'LARAVEL_GAP_SCHEMA_REVISION';
    private const REVISION_LENGTH = 16;
    private const DEFINITION_LANGUAGE = 'lang';
    private const MISSING_LOG_LIMIT = 10;

    private static ?string $expected = null;
    private static string $recorded = '';
    private static float $checkedAt = 0.0;
    /** @var array<string, true> */
    private static array $warned = [];

    public static function expectedRevision(): string
    {
        return self::$expected ??= substr(
            hash('sha256', (string) json_encode(self::definitions(self::DEFINITION_LANGUAGE))),
            0,
            self::REVISION_LENGTH
        );
    }

    public static function isReady(): bool
    {
        $now = microtime(true);

        if (self::$recorded === self::expectedRevision()) {
            return true;
        }
        if (self::$checkedAt > 0.0 && $now - self::$checkedAt < self::retryAfterSeconds()) {
            return false;
        }
        self::$checkedAt = $now;
        self::$recorded = PathMapper::readGlobalVar(self::REVISION_VAR);

        return self::$recorded === self::expectedRevision();
    }

    /**
     * Health / pause payload: {<health_field>: ready|pending,
     * <health_field>_revision: {expected, actual}}.
     */
    public static function payload(): array
    {
        $field = self::healthField();
        $ready = self::isReady();

        return [
            $field => $ready ? self::READY : self::PENDING,
            $field . '_revision' => [
                'expected' => self::expectedRevision(),
                'actual' => self::$recorded !== '' ? self::$recorded : null,
            ],
        ];
    }

    public static function healthField(): string
    {
        return QueueCenterContract::string('schema_gate.health_field');
    }

    public static function errorCode(): string
    {
        return QueueCenterContract::string('schema_gate.error_code');
    }

    public static function httpStatus(): int
    {
        return QueueCenterContract::positiveInt('schema_gate.http_status');
    }

    public static function retryAfterSeconds(): int
    {
        return QueueCenterContract::positiveInt('schema_gate.retry_after_seconds');
    }

    /**
     * Timer guard: false while pending, with one warning per task and process.
     */
    public static function allowsTimer(string $task): bool
    {
        if (self::isReady()) {
            return true;
        }
        if (!isset(self::$warned[$task])) {
            self::$warned[$task] = true;
            Log::warning('[SchemaGate] timer skipped until sys:init aligns the gap tables', ['task' => $task] + self::payload());
        }

        return false;
    }

    /**
     * Records the required revision once every supported language's word and
     * sentence table carries the required columns (one column listing per
     * table kind). Called by the alignment owners and the align migration.
     */
    public static function recordIfAligned(): bool
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $missing = self::missingColumns($connection);
        $revision = self::expectedRevision();

        if ($missing !== []) {
            Log::info('[SchemaGate] revision not recorded: gap tables still lack required columns', [
                'expected_revision' => $revision,
                'tables' => count($missing),
                'first' => array_slice($missing, 0, self::MISSING_LOG_LIMIT, true),
            ]);

            return false;
        }
        if (!PathMapper::writeGlobalVar(self::REVISION_VAR, $revision)) {
            Log::error('[SchemaGate] revision could not be written to the var center', ['var' => self::REVISION_VAR, 'expected_revision' => $revision]);

            return false;
        }
        self::$recorded = $revision;
        Log::info('[SchemaGate] gap schema revision recorded', ['revision' => $revision]);

        return true;
    }

    /**
     * @return array<string, array{columns: array<string,string>, indexes: array<int,array>}>
     */
    private static function definitions(string $language): array
    {
        return [
            'word' => [
                'columns' => self::columnTypes(AppQyV1DictionaryTableSchema::formalStructure()['columns']),
                'indexes' => AppQyV1MediaGaps::indexDefinitions(true, $language),
            ],
            'sentence' => [
                'columns' => self::columnTypes(MediaIngestTablesInitializer::sentenceLangStructure($language)['columns']),
                'indexes' => AppQyV1MediaGaps::indexDefinitions(false, $language),
            ],
        ];
    }

    /** @return array<string,string> column => type */
    private static function columnTypes(array $columns): array
    {
        return array_map(static fn (array $definition): string => (string) ($definition['type'] ?? ''), $columns);
    }

    /** @return array<string, array<int,string>> table => missing columns */
    private static function missingColumns(string $connection): array
    {
        $definitions = self::definitions(self::DEFINITION_LANGUAGE);
        $tablesByKind = ['word' => [], 'sentence' => []];
        $missing = [];

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $tablesByKind['word'][] = AppQyV1TableMaps::getDictionaryTableName($language);
            $tablesByKind['sentence'][] = AppQyV1TableMaps::getSentenceTableName($language);
        }
        foreach ($tablesByKind as $kind => $tables) {
            $required = array_keys($definitions[$kind]['columns']);
            $present = [];
            $rows = DB::connection($connection)->table('information_schema.columns')
                ->select(['table_name', 'column_name'])
                ->whereRaw('table_schema = current_schema()')
                ->whereIn('table_name', $tables)
                ->whereIn('column_name', $required)
                ->get();
            foreach ($rows as $row) {
                $present[(string) $row->table_name][(string) $row->column_name] = true;
            }
            foreach ($tables as $table) {
                $lacking = array_values(array_diff($required, array_keys($present[$table] ?? [])));
                if ($lacking !== []) {
                    $missing[$table] = $lacking;
                }
            }
        }

        return $missing;
    }

    private function __construct()
    {
    }
}
