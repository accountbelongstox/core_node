<?php

namespace App\Services\QueueCenter;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PerLanguageMetricsModel as PerLanguage;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\WorkLeases\WorkLeaseLanes;
use App\Support\LockedCache;
use App\Support\TableRowEstimate;

/**
 * Per-language figures of one audio gap lane (word_audio | sentence_audio)
 * for every language at once: gap, failed and live-leased rows from ONE
 * UNION ALL over the lane's gap partial indexes, sentence rows outside the
 * library from one more, and the table totals from one pg_class read.
 * Cached as one snapshot per lane (single-flight fill, stale served while a
 * refresh runs), so pool, node, progress and listing summaries never loop
 * languages on a request path. Tables not yet aligned (lease or gap columns
 * missing) are left out.
 */
final class GapLaneSnapshot
{
    private const CACHE_PREFIX = 'gap_lane_snapshot:';
    private const FRESH_SECONDS = 30;
    private const STALE_SECONDS = 300;

    /**
     * @return array<string, array{gap:int, failed:int, pending:int, leased:int, done:int}>
     *         language => figures, languages holding rows only
     */
    public static function lane(string $lane): array
    {
        return (array) LockedCache::flexible(
            self::CACHE_PREFIX . $lane,
            [self::FRESH_SECONDS, self::STALE_SECONDS],
            static fn (): array => self::compute($lane),
            []
        );
    }

    /** @return array{gap:int, failed:int, pending:int, leased:int, done:int} */
    public static function language(string $lane, string $language): array
    {
        return self::lane($lane)[strtolower($language)] ?? ['gap' => 0, 'failed' => 0, 'pending' => 0, 'leased' => 0, 'done' => 0];
    }

    private static function compute(string $lane): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $isWord = $lane === WorkLeaseLanes::WORD_AUDIO;
        $tables = [];
        $figures = [];
        $notLive = [];

        foreach (WorkLeaseLanes::languages($lane) as $language) {
            $tables[$language] = WorkLeaseLanes::table($lane, $language);
        }
        $tables = PerLanguage::requireColumns($connection, $tables, AppQyV1MediaGaps::indexedColumns($isWord));
        if ($tables === []) {
            return [];
        }
        $gaps = PerLanguage::metricsByLanguage(
            $connection,
            $tables,
            'COUNT(*) AS gap, COUNT(*) FILTER (WHERE ' . AppQyV1MediaGaps::TTS_FAILED . ') AS failed,'
            . ' COUNT(*) FILTER (WHERE ' . WorkLeaseLanes::LEASED . ') AS leased',
            WorkLeaseLanes::gap($lane),
            [now()]
        );
        if (!$isWord) {
            $notLive = PerLanguage::countByLanguage($connection, $tables, AppQyV1MediaGaps::SENTENCE_NOT_LIVE);
        }
        foreach (TableRowEstimate::rowsOfTables($connection, $tables) as $language => $rows) {
            $gap = (int) ($gaps[$language]['gap'] ?? 0);
            $failed = (int) ($gaps[$language]['failed'] ?? 0);
            $done = max(0, $rows - $gap - (int) ($notLive[$language] ?? 0));
            if ($gap + $done === 0) {
                continue;
            }
            $figures[(string) $language] = [
                'gap' => $gap,
                'failed' => $failed,
                'pending' => $gap - $failed,
                'leased' => (int) ($gaps[$language]['leased'] ?? 0),
                'done' => $done,
            ];
        }

        return $figures;
    }

    private function __construct()
    {
    }
}
