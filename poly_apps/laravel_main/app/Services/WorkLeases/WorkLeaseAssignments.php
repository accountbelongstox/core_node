<?php

namespace App\Services\WorkLeases;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookAudioPlanService;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\AudioOrchestrationContract;
use Illuminate\Support\Carbon;

/**
 * App-led scheduling of the book plans (audio_orchestration_contract
 * book_plan.assignments_*). The app POSTs windows (node short id, lane,
 * language, clip count, laid out from the reader position); each POST is the plan heartbeat.
 * While it is fresh a node claims its own windows first and every other claim
 * skips them (a window whose sid starts with direct_sid is a device's direct
 * pycore window: all nodes skip it); once it expires the claims fall back to
 * the fair share. Node ranges are kept per plan (last writer wins; the
 * signature covers node windows only), direct ranges per (plan, device) with
 * their own heartbeat.
 */
final class WorkLeaseAssignments
{
    private const LAYOUT_KEY = 'book_plan:assign:';
    private const PLANS_KEY = 'book_plan:assign:plans';
    private const DIRECT_KEY = 'book_plan:assign:direct:';
    private const DEVICES_KEY = 'book_plan:assign:devices:';

    /** @var array<string,array>|null fresh layouts by plan id, loaded once per instance */
    private ?array $fresh = null;

    public function __construct(private readonly AppQyV1BookAudioPlanService $plans)
    {
    }

    public static function setting(string $name): mixed
    {
        return AudioOrchestrationContract::bookPlan($name);
    }

    /** Whether a window sid is a direct pycore window (any sid starting with direct_sid). */
    public static function isDirectSid(string $sid): bool
    {
        $prefix = (string) self::setting('direct_sid');

        return $prefix !== '' && str_starts_with($sid, $prefix);
    }

    /** The direct window sid of one device: direct_sid + ':' + device_id[0:direct_sid_device_chars]. */
    public static function directSid(string $deviceId): string
    {
        $prefix = (string) self::setting('direct_sid');
        $deviceId = self::deviceId($deviceId);

        return $deviceId === '' ? $prefix : $prefix . ':' . substr($deviceId, 0, (int) self::setting('direct_sid_device_chars'));
    }

    public static function deviceId(string $deviceId): string
    {
        return substr((string) preg_replace('/[^A-Za-z0-9_.-]/', '', $deviceId), 0, (int) self::setting('device_id_max_chars'));
    }

    /**
     * POST assignments. Null when the plan is unknown. Node windows replace the
     * plan's node layout (last writer wins; a post without node windows leaves
     * another device's node layout alone), direct windows the posting device's
     * direct layout (an empty set drops it).
     *
     * @param array<int,array{sid:string,lane:string,language:string,count:int}> $windows
     */
    public function apply(string $planId, int $from, array $windows, string $deviceId = '', string $directNodeSid = ''): ?array
    {
        $plan = $this->plans->plan($planId);

        if ($plan === null) {
            return null;
        }
        $deviceId = self::deviceId($deviceId);
        $windows = $this->normalized($windows, self::directSid($deviceId));
        $nodeWindows = array_values(array_filter($windows, static fn (array $window): bool => !self::isDirectSid($window['sid'])));
        $directWindows = array_values(array_filter($windows, static fn (array $window): bool => self::isDirectSid($window['sid'])));
        $now = time();
        $ttl = (int) self::setting('assignment_ttl_seconds');
        $layout = $this->layout($planId);
        $direct = $this->directLayout($planId, $deviceId);
        $nodeSignature = sha1(json_encode($nodeWindows));
        $directSignature = sha1(json_encode($directWindows));
        $minMove = (int) AppQyV1BookAudioPlanService::setting('reprioritize_min_move');
        $relayoutSeconds = (int) self::setting('assignment_relayout_seconds');
        $needs = static fn (?array $current, string $signature): bool => $current === null
            || $current['signature'] !== $signature
            || abs($from - (int) $current['from']) >= $minMove
            || $now - (int) $current['applied_at'] >= $relayoutSeconds;
        $writesNodes = $nodeWindows !== [] || $layout === null || (string) ($layout['device_id'] ?? '') === $deviceId;
        $nodeRelayout = $writesNodes && $needs($layout, $nodeSignature);
        $directRelayout = $directWindows !== [] && $needs($direct, $directSignature);
        $ranges = $nodeRelayout || $directRelayout ? $this->resolve($plan, $from, $windows) : [];

        if ($writesNodes) {
            if ($nodeRelayout) {
                $layout = [
                    'plan_pk' => (int) $plan->id,
                    'from' => $from,
                    'signature' => $nodeSignature,
                    'applied_at' => $now,
                    'carry' => $this->carriedDone($plan, $layout),
                    'ranges' => array_values(array_filter($ranges, static fn (array $range): bool => !self::isDirectSid($range['sid']))),
                ];
            }
            $layout['device_id'] = $deviceId;
            $layout['expires_at'] = $now + $ttl;
            $this->store($planId, $layout);
        }
        if ($directWindows === []) {
            $this->forgetDirect($planId, $deviceId);
        } else {
            if ($directRelayout) {
                $direct = [
                    'plan_pk' => (int) $plan->id,
                    'from' => $from,
                    'signature' => $directSignature,
                    'applied_at' => $now,
                    'carry' => $this->carriedDone($plan, $direct),
                    'ranges' => array_values(array_filter($ranges, static fn (array $range): bool => self::isDirectSid($range['sid']))),
                ];
            }
            $direct['device_id'] = $deviceId;
            $direct['direct_node_sid'] = substr($directNodeSid, 0, 16);
            $direct['expires_at'] = $now + $ttl;
            $this->storeDirect($planId, $deviceId, $direct);
        }

        return $this->summary($plan);
    }

    /** Assignment figures of one plan (the status `assignments` block). */
    public function summary(object $plan): array
    {
        $now = time();
        $layouts = $this->planLayouts((string) $plan->plan_id);

        if ($layouts === []) {
            return ['fresh' => false, 'expires_in' => 0, 'windows' => []];
        }
        $windows = [];
        $expiresAt = 0;

        foreach ($layouts as $layout) {
            $counts = $this->counts($plan, $layout['ranges']);
            foreach ($layout['ranges'] as $index => $range) {
                $key = $range['sid'] . '|' . $range['lane'];
                $windows[$key] ??= ['sid' => $range['sid'], 'lane' => $range['lane'], 'assigned' => 0, 'generating' => 0, 'done' => 0];
                $windows[$key]['assigned'] += $counts[$index]['total'];
                $windows[$key]['generating'] += $counts[$index]['generating'];
                $windows[$key]['done'] += $counts[$index]['ready'];
            }
            foreach ((array) ($layout['carry'] ?? []) as $key => $carried) {
                [$sid, $lane] = explode('|', (string) $key, 2);
                $windows[$key] ??= ['sid' => $sid, 'lane' => $lane, 'assigned' => 0, 'generating' => 0, 'done' => 0];
                $windows[$key]['assigned'] += (int) $carried;
                $windows[$key]['done'] += (int) $carried;
            }
            $expiresAt = max($expiresAt, (int) $layout['expires_at']);
        }
        $fresh = $expiresAt > $now;
        $current = $this->currentSids();

        // Only direct pycores and nodes of the current roster are shown: a node that left (or was merged into another id) drops out.
        return [
            'fresh' => $fresh,
            'expires_in' => $fresh ? $expiresAt - $now : 0,
            'windows' => array_values(array_filter(
                $windows,
                static fn (array $window): bool => self::isDirectSid($window['sid']) || isset($current[$window['sid']])
            )),
        ];
    }

    /**
     * Monitor view of one plan's layouts (work/monitor plans[].layout): newest
     * applied_at, expires_in, the devices holding a fresh layout and the fresh
     * ranges. Null when the plan holds no layout.
     */
    public function monitorLayout(string $planId): ?array
    {
        $now = time();
        $layouts = $this->planLayouts($planId);

        if ($layouts === []) {
            return null;
        }
        $view = ['applied_at' => null, 'expires_in' => 0, 'device_ids' => [], 'ranges' => []];
        $appliedAt = 0;

        foreach ($layouts as $layout) {
            $appliedAt = max($appliedAt, (int) ($layout['applied_at'] ?? 0));
            if ((int) $layout['expires_at'] <= $now) {
                continue;
            }
            $view['expires_in'] = max($view['expires_in'], (int) $layout['expires_at'] - $now);
            $view['device_ids'][] = (string) ($layout['device_id'] ?? '');
            foreach ($layout['ranges'] as $range) {
                $view['ranges'][] = $range + [
                    'device_id' => (string) ($layout['device_id'] ?? ''),
                    'direct_node_sid' => isset($layout['direct_node_sid']) ? (string) $layout['direct_node_sid'] : null,
                ];
            }
        }
        $view['device_ids'] = array_values(array_unique($view['device_ids']));
        $view['applied_at'] = $appliedAt > 0 ? Carbon::createFromTimestamp($appliedAt)->toIso8601String() : null;

        return $view;
    }

    /** @return array<int,string> plan ids holding a layout that is fresh or expired less than $withinSeconds ago */
    public function recentPlanIds(int $withinSeconds): array
    {
        $cutoff = time() - $withinSeconds;
        $planIds = [];

        foreach ((array) QueueCenterCacheStore::get()->get(self::PLANS_KEY, []) as $planId) {
            foreach ($this->planLayouts((string) $planId) as $layout) {
                if ((int) $layout['expires_at'] > $cutoff) {
                    $planIds[] = (string) $planId;
                    break;
                }
            }
        }

        return $planIds;
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
     * of windows another node (or a direct pycore) owns right now.
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

    /** @return array<string,true> short ids of the online roster nodes */
    private function currentSids(): array
    {
        $sids = [];

        foreach ((array) app(WorkLeaseService::class)->nodes(true)['nodes'] as $node) {
            $sids[(string) $node['sid']] = true;
        }

        return $sids;
    }

    /** @return array<string,array> plan id => {plan_pk, ranges} merged over the fresh node and direct layouts */
    private function freshLayouts(): array
    {
        if ($this->fresh !== null) {
            return $this->fresh;
        }
        $now = time();
        $this->fresh = [];

        foreach ((array) QueueCenterCacheStore::get()->get(self::PLANS_KEY, []) as $planId) {
            foreach ($this->planLayouts((string) $planId) as $layout) {
                if ((int) $layout['expires_at'] <= $now) {
                    continue;
                }
                $this->fresh[(string) $planId] ??= ['plan_pk' => (int) $layout['plan_pk'], 'ranges' => []];
                array_push($this->fresh[(string) $planId]['ranges'], ...$layout['ranges']);
            }
        }

        return $this->fresh;
    }

    /** @return array<int,array> the plan's node layout and every device's direct layout (fresh or not) */
    private function planLayouts(string $planId): array
    {
        $layouts = [];
        $layout = $this->layout($planId);

        if ($layout !== null) {
            $layouts[] = $layout;
        }
        foreach ((array) QueueCenterCacheStore::get()->get(self::DEVICES_KEY . $planId, []) as $deviceId) {
            $direct = $this->directLayout($planId, (string) $deviceId);
            if ($direct !== null) {
                $layouts[] = $direct;
            }
        }

        return $layouts;
    }

    private function layout(string $planId): ?array
    {
        $layout = QueueCenterCacheStore::get()->get(self::LAYOUT_KEY . $planId);

        return is_array($layout) ? $layout : null;
    }

    private function directLayout(string $planId, string $deviceId): ?array
    {
        $layout = QueueCenterCacheStore::get()->get(self::DIRECT_KEY . $planId . ':' . $deviceId);

        return is_array($layout) ? $layout : null;
    }

    private function store(string $planId, array $layout): void
    {
        QueueCenterCacheStore::get()->put(self::LAYOUT_KEY . $planId, $layout, (int) self::setting('assignment_carry_ttl_seconds'));
        $this->remember(self::PLANS_KEY, $planId);
        $this->fresh = null;
    }

    private function storeDirect(string $planId, string $deviceId, array $layout): void
    {
        QueueCenterCacheStore::get()->put(self::DIRECT_KEY . $planId . ':' . $deviceId, $layout, (int) self::setting('assignment_carry_ttl_seconds'));
        $this->remember(self::DEVICES_KEY . $planId, $deviceId);
        $this->remember(self::PLANS_KEY, $planId);
        $this->fresh = null;
    }

    private function forgetDirect(string $planId, string $deviceId): void
    {
        $cache = QueueCenterCacheStore::get();
        $devices = (array) $cache->get(self::DEVICES_KEY . $planId, []);

        if (!in_array($deviceId, $devices, true)) {
            return;
        }
        $cache->forget(self::DIRECT_KEY . $planId . ':' . $deviceId);
        $cache->put(self::DEVICES_KEY . $planId, array_values(array_diff($devices, [$deviceId])), (int) self::setting('assignment_carry_ttl_seconds'));
        $this->fresh = null;
    }

    /** Add one id to a cached id list (no-op when present). */
    private function remember(string $key, string $id): void
    {
        $cache = QueueCenterCacheStore::get();
        $ids = (array) $cache->get($key, []);

        if (in_array($id, $ids, true)) {
            return;
        }
        $ids[] = $id;
        $cache->put($key, array_values($ids), (int) self::setting('assignment_carry_ttl_seconds'));
    }

    /**
     * Direct windows (sid starting with direct_sid) are rewritten to the posting
     * device's direct sid.
     *
     * @param array<int,array> $windows
     * @return array<int,array{sid:string,lane:string,language:string,count:int}>
     */
    private function normalized(array $windows, string $directSid): array
    {
        $normalized = [];
        $perGroup = [];
        $max = (int) self::setting('assignment_window_max');

        foreach (array_slice($windows, 0, (int) self::setting('assignment_windows_max')) as $window) {
            $lane = (string) ($window['lane'] ?? '');
            $language = strtolower(substr((string) ($window['language'] ?? ''), 0, 20));
            $sid = substr((string) ($window['sid'] ?? ''), 0, 16);
            $sid = self::isDirectSid($sid) ? $directSid : $sid;
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
            . ' WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.position >= ? AND pc.ready_seq IS NULL'
            . ' AND (' . WorkLeaseLanes::gap($lane) . ') AND ' . AppQyV1MediaGaps::TTS_NOT_FAILED
            . ' ORDER BY pc.position, pc.id LIMIT ?',
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
                . ' WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.position >= ? AND pc.position < ?',
                [$plan->id, $lane, $language, min(array_map(static fn (int $index): int => (int) $ranges[$index]['from'], $indexes)), max(array_map(static fn (int $index): int => (int) $ranges[$index]['to'], $indexes))]
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
        $notDirect = '';

        // A device's direct range is never leased, even where another device's node range overlaps it.
        foreach ($layout['ranges'] as $other) {
            if ($other['lane'] === $lane && $other['language'] === $language && self::isDirectSid((string) $other['sid'])) {
                $notDirect .= ' AND NOT (pc.position >= ' . (int) $other['from'] . ' AND pc.position < ' . (int) $other['to'] . ')';
            }
        }
        $rows = WorkLeaseLanes::connection($lane, $language)->select(
            "UPDATE {$table} SET tts_locked_by = ?, tts_locked_at = ?, tts_lease_id = ?, tts_lease_expires_at = ?"
            . " WHERE id IN (SELECT id FROM {$table} WHERE (" . WorkLeaseLanes::gap($lane) . ') AND ' . WorkLeaseLanes::FREE
            . " AND {$key} IN (SELECT pc.content_key FROM {$this->plans->clipsTable()} pc WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.position >= ? AND pc.position < ?{$notDirect})"
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
