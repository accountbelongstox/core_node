<?php

namespace App\Services\WorkLeases;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookAudioPlanService;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\AudioOrchestrationContract;
use Illuminate\Support\Carbon;

/**
 * App-led scheduling of the book plans (audio_orchestration_contract
 * book_plan.assignments_*). The app POSTs windows (node short id, lane,
 * language, clip count, laid out from the reader position); each POST is the plan heartbeat.
 * While it is fresh a node claims its own windows first and every other claim
 * skips them (direct_sid windows are the app's direct pycore's: all nodes skip
 * them); once it expires the claims fall back to the fair share.
 */
final class WorkLeaseAssignments
{
    private const LAYOUT_KEY = 'book_plan:assign:';
    private const PLANS_KEY = 'book_plan:assign:plans';

    /** @var array<string,array>|null fresh layouts by plan id, loaded once per instance */
    private ?array $fresh = null;

    public function __construct(private readonly AppQyV1BookAudioPlanService $plans)
    {
    }

    public static function setting(string $name): mixed
    {
        return AudioOrchestrationContract::bookPlan($name);
    }

    /**
     * POST assignments. Null when the plan is unknown.
     *
     * @param array<int,array{sid:string,lane:string,language:string,count:int}> $windows
     */
    public function apply(string $planId, int $from, array $windows): ?array
    {
        $plan = $this->plans->plan($planId);

        if ($plan === null) {
            return null;
        }
        $windows = $this->normalized($windows);
        $signature = sha1(json_encode($windows));
        $now = time();
        $layout = $this->layout($planId);
        $relayout = $layout === null
            || $layout['signature'] !== $signature
            || abs($from - (int) $layout['from']) >= (int) AppQyV1BookAudioPlanService::setting('reprioritize_min_move')
            || $now - (int) $layout['applied_at'] >= (int) self::setting('assignment_relayout_seconds');

        if ($relayout) {
            $layout = [
                'plan_pk' => (int) $plan->id,
                'from' => $from,
                'signature' => $signature,
                'applied_at' => $now,
                'carry' => $this->carriedDone($plan, $layout),
                'ranges' => $this->resolve($plan, $from, $windows),
            ];
        }
        $layout['expires_at'] = $now + (int) self::setting('assignment_ttl_seconds');
        $this->store($planId, $layout);

        return $this->summary($plan);
    }

    /** Assignment figures of one plan (the status `assignments` block). */
    public function summary(object $plan): array
    {
        $layout = $this->layout((string) $plan->plan_id);
        $now = time();

        if ($layout === null) {
            return ['fresh' => false, 'expires_in' => 0, 'windows' => []];
        }
        $counts = $this->counts($plan, $layout['ranges']);
        $windows = [];

        foreach ($layout['ranges'] as $index => $range) {
            $key = $range['sid'] . '|' . $range['lane'];
            $windows[$key] ??= ['sid' => $range['sid'], 'lane' => $range['lane'], 'assigned' => 0, 'generating' => 0, 'done' => 0];
            $windows[$key]['assigned'] += $counts[$index]['total'];
            $windows[$key]['generating'] += $counts[$index]['generating'];
            $windows[$key]['done'] += $counts[$index]['ready'];
        }
        foreach ((array) $layout['carry'] as $key => $carried) {
            [$sid, $lane] = explode('|', (string) $key, 2);
            $windows[$key] ??= ['sid' => $sid, 'lane' => $lane, 'assigned' => 0, 'generating' => 0, 'done' => 0];
            $windows[$key]['assigned'] += (int) $carried;
            $windows[$key]['done'] += (int) $carried;
        }
        $fresh = (int) $layout['expires_at'] > $now;

        return [
            'fresh' => $fresh,
            'expires_in' => $fresh ? (int) $layout['expires_at'] - $now : 0,
            'windows' => array_values($windows),
        ];
    }

    /**
     * Rows of the windows this node owns, leased before anything else.
     *
     * @param array<string,array> $lanes declared lanes of the claim
     * @param array<string,int> $heldByLane rows already held per lane (the claim's lane cap)
     * @return array<int,array> claim items
     */
    public function lease(string $workerId, array $lanes, string $leaseId, Carbon $expiresAt, int $budget, array $heldByLane): array
    {
        $items = [];
        $sid = app(WorkLeaseService::class)->shortId($workerId);
        $fastEngine = WorkLeaseFastPass::declaresFast($lanes) ? WorkLeaseFastPass::engine() : null;
        $fastLanguages = (array) self::setting('fast_pass.languages');

        foreach ($this->freshLayouts() as $planId => $layout) {
            $plan = null;
            foreach ($layout['ranges'] as $range) {
                $lane = $range['lane'];
                $language = $range['language'];
                if ($range['sid'] !== $sid || !isset($lanes[$lane]) || !in_array($language, (array) $lanes[$lane]['languages'], true)) {
                    continue;
                }
                $take = min(
                    $budget - count($items),
                    (int) $lanes[$lane]['max_items'] - ($heldByLane[$lane] ?? 0) - $this->countLane($items, $lane)
                );
                if ($take <= 0) {
                    continue;
                }
                $plan ??= $this->plans->plan((string) $planId);
                $hint = $fastEngine !== null && $lane === WorkLeaseLanes::SENTENCE_AUDIO && $plan !== null && (bool) $plan->fast_pass && in_array($language, $fastLanguages, true)
                    ? $fastEngine
                    : null;
                array_push($items, ...$this->leaseRange($layout, $range, $take, $workerId, $leaseId, $expiresAt, $hint));
            }
        }

        return $items;
    }

    /**
     * SQL fragment (AND NOT EXISTS ...) keeping a lease statement off the rows
     * of windows another node (or the direct pycore) owns right now.
     *
     * @param string $rowRef SQL reference of the lane row inside the statement (quoted table name or its alias)
     */
    public function excludeOthers(string $workerId, string $lane, string $language, string $rowRef): string
    {
        $sid = app(WorkLeaseService::class)->shortId($workerId);
        $key = WorkLeaseLanes::keyColumn($lane);
        $sql = '';

        foreach ($this->freshLayouts() as $layout) {
            $spans = [];
            foreach ($layout['ranges'] as $range) {
                if ($range['lane'] === $lane && $range['language'] === $language && $range['sid'] !== $sid) {
                    $spans[] = '(xc.position >= ' . (int) $range['from'] . ' AND xc.position < ' . (int) $range['to'] . ')';
                }
            }
            if ($spans === []) {
                continue;
            }
            $sql .= " AND NOT EXISTS (SELECT 1 FROM {$this->plans->clipsTable()} xc WHERE xc.plan_pk = " . (int) $layout['plan_pk']
                . " AND xc.lane = '" . $lane . "' AND xc.language = " . $this->literal($language)
                . " AND xc.content_key = {$rowRef}.{$key} AND (" . implode(' OR ', $spans) . '))';
        }

        return $sql;
    }

    /** @return array<string,array> plan id => layout, only the fresh ones */
    private function freshLayouts(): array
    {
        if ($this->fresh !== null) {
            return $this->fresh;
        }
        $now = time();
        $this->fresh = [];

        foreach ((array) QueueCenterCacheStore::get()->get(self::PLANS_KEY, []) as $planId) {
            $layout = $this->layout((string) $planId);
            if ($layout !== null && (int) $layout['expires_at'] > $now) {
                $this->fresh[(string) $planId] = $layout;
            }
        }

        return $this->fresh;
    }

    private function layout(string $planId): ?array
    {
        $layout = QueueCenterCacheStore::get()->get(self::LAYOUT_KEY . $planId);

        return is_array($layout) ? $layout : null;
    }

    private function store(string $planId, array $layout): void
    {
        $cache = QueueCenterCacheStore::get();
        $ttl = (int) self::setting('assignment_carry_ttl_seconds');
        $planIds = array_values(array_unique(array_merge((array) $cache->get(self::PLANS_KEY, []), [$planId])));

        $cache->put(self::LAYOUT_KEY . $planId, $layout, $ttl);
        $cache->put(self::PLANS_KEY, $planIds, $ttl);
        $this->fresh = null;
    }

    /**
     * @param array<int,array> $windows
     * @return array<int,array{sid:string,lane:string,language:string,count:int}>
     */
    private function normalized(array $windows): array
    {
        $normalized = [];
        $perGroup = [];
        $max = (int) self::setting('assignment_window_max');

        foreach (array_slice($windows, 0, (int) self::setting('assignment_windows_max')) as $window) {
            $lane = (string) ($window['lane'] ?? '');
            $language = strtolower(substr((string) ($window['language'] ?? ''), 0, 20));
            $sid = substr((string) ($window['sid'] ?? ''), 0, 16);
            $group = $lane . '|' . $language;
            $count = max(0, min($max - ($perGroup[$group] ?? 0), (int) ($window['count'] ?? 0)));
            if ($sid === '' || $language === '' || !WorkLeaseLanes::isLane($lane) || $count <= 0) {
                continue;
            }
            $perGroup[$group] = ($perGroup[$group] ?? 0) + $count;
            $normalized[] = ['sid' => $sid, 'lane' => $lane, 'language' => $language, 'count' => $count];
        }

        return $normalized;
    }

    /**
     * Per lane and language the windows are laid out one after another over the
     * pending plan clips in play order from the reader position: a window starts
     * at the position of its first clip and ends where the next one starts.
     *
     * @param array<int,array{sid:string,lane:string,language:string,count:int}> $windows
     * @return array<int,array{sid:string,lane:string,language:string,from:int,to:int}>
     */
    private function resolve(object $plan, int $from, array $windows): array
    {
        $ranges = [];
        $groups = [];

        foreach ($windows as $window) {
            $groups[$window['lane'] . '|' . $window['language']][] = $window;
        }
        foreach ($groups as $group) {
            $lane = $group[0]['lane'];
            $language = $group[0]['language'];
            $positions = $this->pendingPositions($plan, $lane, $language, $from, (int) array_sum(array_column($group, 'count')));
            $offset = 0;
            $laid = [];
            foreach ($group as $window) {
                $slice = array_slice($positions, $offset, $window['count']);
                $offset += $window['count'];
                if ($slice !== []) {
                    $laid[] = ['sid' => $window['sid'], 'lane' => $lane, 'language' => $language, 'from' => $slice[0], 'to' => $slice[array_key_last($slice)] + 1];
                }
            }
            foreach ($laid as $index => $range) {
                if (isset($laid[$index + 1])) {
                    $laid[$index]['to'] = max($range['from'] + 1, $laid[$index + 1]['from']);
                }
            }
            array_push($ranges, ...$laid);
        }

        return $ranges;
    }

    /** @return array<int,int> positions (ascending, one per clip) of the group's pending plan clips from $from */
    private function pendingPositions(object $plan, string $lane, string $language, int $from, int $limit): array
    {
        $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
        $key = WorkLeaseLanes::keyColumn($lane);
        $positions = [];

        foreach ($this->plans->connection()->select(
            "SELECT pc.position FROM {$this->plans->clipsTable()} pc JOIN {$table} t ON t.{$key} = pc.content_key"
            . ' WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.position >= ? AND t.has_audio IS NOT TRUE'
            . " AND t.tts_status IS DISTINCT FROM 'failed' ORDER BY pc.position, pc.id LIMIT ?",
            [$plan->id, $lane, $language, $from, $limit]
        ) as $row) {
            $positions[] = (int) $row->position;
        }

        return $positions;
    }

    /**
     * Finished clips of the previous layout's windows, carried so the counters
     * of a node never go down when the windows are laid out again.
     *
     * @return array<string,int>
     */
    private function carriedDone(object $plan, ?array $layout): array
    {
        $carry = (array) ($layout['carry'] ?? []);

        if ($layout === null) {
            return $carry;
        }
        foreach ($this->counts($plan, $layout['ranges']) as $index => $figures) {
            $key = $layout['ranges'][$index]['sid'] . '|' . $layout['ranges'][$index]['lane'];
            $carry[$key] = (int) ($carry[$key] ?? 0) + $figures['ready'];
        }

        return $carry;
    }

    /**
     * Clips inside each range: all, with audio, under a live lease.
     *
     * @param array<int,array> $ranges
     * @return array<int,array{total:int,ready:int,generating:int}>
     */
    private function counts(object $plan, array $ranges): array
    {
        $figures = array_fill(0, count($ranges), ['total' => 0, 'ready' => 0, 'generating' => 0]);
        $now = $this->literal(now()->toDateTimeString());
        $groups = [];

        foreach ($ranges as $index => $range) {
            $groups[$range['lane'] . '|' . $range['language']][] = $index;
        }
        foreach ($groups as $indexes) {
            $lane = $ranges[$indexes[0]]['lane'];
            $language = $ranges[$indexes[0]]['language'];
            $select = [];
            foreach ($indexes as $index) {
                $in = 'pc.position >= ' . (int) $ranges[$index]['from'] . ' AND pc.position < ' . (int) $ranges[$index]['to'];
                $select[] = "count(*) FILTER (WHERE {$in}) AS t{$index}";
                $select[] = "count(*) FILTER (WHERE {$in} AND t.has_audio IS TRUE) AS r{$index}";
                $select[] = "count(*) FILTER (WHERE {$in} AND t.has_audio IS NOT TRUE AND t.tts_lease_id IS NOT NULL AND t.tts_lease_expires_at >= {$now}) AS g{$index}";
            }
            $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
            $key = WorkLeaseLanes::keyColumn($lane);
            $row = $this->plans->connection()->selectOne(
                'SELECT ' . implode(', ', $select) . " FROM {$this->plans->clipsTable()} pc JOIN {$table} t ON t.{$key} = pc.content_key"
                . ' WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ?',
                [$plan->id, $lane, $language]
            );
            foreach ($indexes as $index) {
                $figures[$index] = [
                    'total' => (int) $row->{'t' . $index},
                    'ready' => (int) $row->{'r' . $index},
                    'generating' => (int) $row->{'g' . $index},
                ];
            }
        }

        return $figures;
    }

    private function leaseRange(array $layout, array $range, int $take, string $workerId, string $leaseId, Carbon $expiresAt, ?string $engineHint): array
    {
        $lane = $range['lane'];
        $language = $range['language'];
        $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
        $key = WorkLeaseLanes::keyColumn($lane);
        $now = now();
        $rows = WorkLeaseLanes::connection($lane, $language)->select(
            "UPDATE {$table} SET tts_locked_by = ?, tts_locked_at = ?, tts_lease_id = ?, tts_lease_expires_at = ?"
            . " WHERE id IN (SELECT id FROM {$table} WHERE (" . WorkLeaseLanes::gap($lane) . ') AND ' . WorkLeaseLanes::FREE
            . " AND {$key} IN (SELECT pc.content_key FROM {$this->plans->clipsTable()} pc WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.position >= ? AND pc.position < ?)"
            . ' ORDER BY ' . WorkLeaseLanes::rank($lane) . ' LIMIT ? FOR UPDATE SKIP LOCKED)'
            . ' RETURNING id, ' . WorkLeaseLanes::textColumn($lane) . ' AS text, ' . $key . ' AS content_key, tts_priority',
            [$workerId, $now, $leaseId, $expiresAt, $now, (int) $layout['plan_pk'], $lane, $language, (int) $range['from'], (int) $range['to'], $take]
        );
        usort($rows, static fn (object $a, object $b): int => [(int) $b->tts_priority, (int) $a->id] <=> [(int) $a->tts_priority, (int) $b->id]);

        return array_map(static fn (object $row): array => WorkLeaseLanes::item($lane, $language, $row, $engineHint), $rows);
    }

    /** @param array<int,array> $items */
    private function countLane(array $items, string $lane): int
    {
        return count(array_filter($items, static fn (array $item): bool => $item['lane'] === $lane));
    }

    private function literal(string $value): string
    {
        return $this->plans->connection()->getPdo()->quote($value);
    }
}
