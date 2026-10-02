<?php

namespace App\Services\WorkLeases;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookAudioPlanService;
use App\Services\PycoreTasks\PycoreComputeRoster;
use App\Support\AudioOrchestrationContract;
use Carbon\Carbon;

/**
 * Sentence fast pass of the book plans (audio_orchestration_contract
 * book_plan.fast_pass). A node whose sentence lane declares the fast engine
 * leases the fast-pass plans' gap rows with that engine (any compute class);
 * a gpu node that declares the quality engine then leases the delivered rows
 * again as quality-variant upgrades. Both go through the same row leases as
 * every other work (disjoint, expiring, reported by content).
 */
final class WorkLeaseFastPass
{
    public function __construct(private readonly AppQyV1BookAudioPlanService $plans)
    {
    }

    public static function enabled(): bool
    {
        return (bool) AudioOrchestrationContract::bookPlan('fast_pass.enabled');
    }

    public static function engine(): string
    {
        return (string) AudioOrchestrationContract::bookPlan('fast_pass.engine');
    }

    public static function qualityEngine(): string
    {
        return (string) AudioOrchestrationContract::bookPlan('fast_pass.quality_engine');
    }

    /** Whether the declared sentence lane takes fast-pass rows (the node declares the fast engine). */
    public static function declaresFast(array $lanes): bool
    {
        return self::enabled() && in_array(self::engine(), (array) ($lanes[WorkLeaseLanes::SENTENCE_AUDIO]['engines'] ?? []), true);
    }

    /** SQL fragment that keeps a lease statement off the fast-pass plans' rows (their fast-engine nodes lease them). */
    public function excludeFastRows(string $table): string
    {
        return " AND NOT EXISTS (SELECT 1 FROM {$this->plans->clipsTable()} fpc JOIN {$this->plans->plansTable()} fp ON fp.id = fpc.plan_pk"
            . " WHERE fp.fast_pass AND fpc.lane = '" . WorkLeaseLanes::SENTENCE_AUDIO . "' AND fpc.language = ? AND fpc.content_key = \"{$table}\".content_id)";
    }

    /**
     * Fast-pass base rows and quality upgrades for one claim.
     *
     * @param array<string,array> $lanes declared lanes of the claim
     * @return array<int,array> claim items
     */
    public function lease(string $workerId, string $computeClass, array $lanes, string $leaseId, Carbon $expiresAt, int $budget): array
    {
        $items = [];
        $lane = WorkLeaseLanes::SENTENCE_AUDIO;
        $spec = $lanes[$lane] ?? null;

        if ($spec === null || !self::enabled() || $budget <= 0) {
            return $items;
        }
        $limit = (int) ($spec['max_items'] ?? 0);
        $fastLanguages = array_values(array_intersect((array) $spec['languages'], (array) AudioOrchestrationContract::bookPlan('fast_pass.languages')));
        $declaresFast = self::declaresFast($lanes);
        $declaresQuality = $computeClass === PycoreComputeRoster::CLASS_GPU
            && in_array(self::qualityEngine(), (array) ($spec['engines'] ?? []), true);

        if ($declaresFast) {
            foreach ($fastLanguages as $language) {
                $take = min($budget - count($items), $limit - count($items));
                if ($take > 0) {
                    array_push($items, ...$this->fastRows($language, $take, $workerId, $leaseId, $expiresAt));
                }
            }
        }
        if ($declaresQuality) {
            foreach ($fastLanguages as $language) {
                $take = min($budget - count($items), $limit - count($items));
                if ($take > 0) {
                    array_push($items, ...$this->upgradeRows($language, $take, $workerId, $leaseId, $expiresAt));
                }
            }
        }

        return $items;
    }

    private function fastRows(string $language, int $take, string $workerId, string $leaseId, Carbon $expiresAt): array
    {
        $lane = WorkLeaseLanes::SENTENCE_AUDIO;
        $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
        $now = now();
        $rows = WorkLeaseLanes::connection($lane, $language)->select(
            "UPDATE {$table} SET tts_locked_by = ?, tts_locked_at = ?, tts_lease_id = ?, tts_lease_expires_at = ?"
            . " WHERE id IN (SELECT s.id FROM {$table} s WHERE (" . WorkLeaseLanes::gap($lane) . ') AND ' . WorkLeaseLanes::FREE
            . " AND s.content_id IN (SELECT pc.content_key FROM {$this->plans->clipsTable()} pc JOIN {$this->plans->plansTable()} p ON p.id = pc.plan_pk"
            . " WHERE p.fast_pass AND pc.lane = '{$lane}' AND pc.language = ?)"
            . ' ORDER BY ' . WorkLeaseLanes::rank($lane) . ' LIMIT ? FOR UPDATE OF s SKIP LOCKED)'
            . ' RETURNING id, text, content_id AS content_key, tts_priority',
            [$workerId, $now, $leaseId, $expiresAt, $now, $language, $take]
        );

        return array_map(fn (object $row): array => WorkLeaseLanes::item($lane, $language, $row, self::engine()), $this->ordered($rows));
    }

    private function upgradeRows(string $language, int $take, string $workerId, string $leaseId, Carbon $expiresAt): array
    {
        $lane = WorkLeaseLanes::SENTENCE_AUDIO;
        $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
        $now = now();
        $rows = WorkLeaseLanes::connection($lane, $language)->select(
            "UPDATE {$table} SET tts_locked_by = ?, tts_locked_at = ?, tts_lease_id = ?, tts_lease_expires_at = ?"
            . " WHERE id IN (SELECT s.id FROM {$table} s JOIN {$this->plans->clipsTable()} pc ON pc.content_key = s.content_id AND pc.lane = '{$lane}' AND pc.language = ?"
            . " JOIN {$this->plans->plansTable()} p ON p.id = pc.plan_pk AND p.fast_pass"
            . ' WHERE pc.quality = ? AND s.has_audio IS TRUE AND (s.tts_lease_expires_at IS NULL OR s.tts_lease_expires_at < ?)'
            . ' ORDER BY pc.position, s.id LIMIT ? FOR UPDATE OF s SKIP LOCKED)'
            . ' RETURNING id, text, content_id AS content_key, tts_priority',
            [$workerId, $now, $leaseId, $expiresAt, $language, AppQyV1BookAudioPlanService::QUALITY_FAST, $now, $take]
        );

        return array_map(
            fn (object $row): array => WorkLeaseLanes::item($lane, $language, $row, self::qualityEngine(), (string) AudioOrchestrationContract::bookPlan('fast_pass.quality_variant')),
            $this->ordered($rows)
        );
    }

    /** @param array<int,object> $rows */
    private function ordered(array $rows): array
    {
        usort($rows, static fn (object $a, object $b): int => [(int) $b->tts_priority, (int) $a->id] <=> [(int) $a->tts_priority, (int) $b->id]);

        return $rows;
    }
}
