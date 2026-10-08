<?php

namespace App\Services\WorkLeases;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1BookAudioPlanService;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Support\AudioOrchestrationContract;
use Illuminate\Support\Carbon;

/**
 * Latest-state telemetry of the open wordnew clients (audio_orchestration_contract
 * client_monitor) and the work/monitor aggregate. One cache entry per
 * (user, device_id, instance_id): latest wins, a seq not newer than the stored
 * one is dropped as stale, an entry is online for ttl_seconds after its last
 * report. Never an availability source.
 */
final class OrchClientMonitorService
{
    private const ENTRY_KEY = 'orch_clients:entry:';
    private const INDEX_KEY = 'orch_clients:index';
    private const ONLINE_KEY = 'orch_clients:online';
    private const RETENTION_FACTOR = 4;
    private const MONITOR_PLANS_MAX = 20;
    private const RECENT_PLAN_SECONDS = 3600;
    private const VOLATILE_FIELDS = ['seq', 'sent_at'];

    public function __construct(
        private readonly WorkLeaseService $leases,
        private readonly WorkLeaseAssignments $assignments,
        private readonly AppQyV1BookAudioPlanService $plans,
        private readonly QueueCenterRealtimeService $realtime,
    ) {
    }

    public static function setting(string $name): mixed
    {
        return AudioOrchestrationContract::clientMonitor($name);
    }

    /**
     * POST clients/report.
     *
     * @return array{accepted:bool,stale:bool}
     */
    public function report(int $userId, string $userName, array $report): array
    {
        $cache = QueueCenterCacheStore::get();
        $key = sha1($userId . '|' . $report['device_id'] . '|' . $report['instance_id']);
        $previous = $cache->get(self::ENTRY_KEY . $key);
        $seq = (int) $report['seq'];

        if (is_array($previous) && (int) ($previous['report']['seq'] ?? -1) >= $seq) {
            return ['accepted' => false, 'stale' => true];
        }
        $changed = !is_array($previous)
            || time() - (int) ($previous['received_at'] ?? 0) >= (int) self::setting('ttl_seconds')
            || $this->fingerprint((array) $previous['report']) !== $this->fingerprint($report);
        $cache->put(self::ENTRY_KEY . $key, [
            'user_id' => $userId,
            'user_name' => $userName,
            'report' => $report,
            'received_at' => time(),
        ], $this->retentionSeconds());
        $this->remember($key);
        if ($changed) {
            $this->realtime->publishOrchClients('report');
        }

        return ['accepted' => true, 'stale' => false];
    }

    /** Reaper tick: publishes an expiry event when the set of online clients shrank. */
    public function expire(): void
    {
        $cache = QueueCenterCacheStore::get();
        $online = array_keys(array_filter($this->entries(), static fn (array $entry): bool => $entry['online']));
        sort($online);
        $previous = $cache->get(self::ONLINE_KEY);

        $cache->put(self::ONLINE_KEY, $online, $this->retentionSeconds());
        if (is_array($previous) && array_diff($previous, $online) !== []) {
            $this->realtime->publishOrchClients('expiry');
        }
    }

    /** GET work/monitor (contract C6). */
    public function monitor(): array
    {
        $nodes = $this->leases->nodes();
        $clients = [];
        $planIds = $this->assignments->recentPlanIds(self::RECENT_PLAN_SECONDS);

        foreach ($this->entries() as $entry) {
            $report = (array) $entry['report'];
            $clients[] = $report + [
                'user' => ['id' => $entry['user_id'], 'name' => $entry['user_name']],
                'last_seen_at' => Carbon::createFromTimestamp((int) $entry['received_at'])->toIso8601String(),
                'online' => $entry['online'],
            ];
            foreach ((array) ($report['tasks'] ?? []) as $task) {
                if (is_string($task['plan_id'] ?? null) && $task['plan_id'] !== '') {
                    $planIds[] = $task['plan_id'];
                }
            }
        }
        usort($clients, static fn (array $a, array $b): int => strcmp((string) $b['last_seen_at'], (string) $a['last_seen_at']));

        return [
            'server_time' => Carbon::now()->toIso8601String(),
            'revision' => [
                'nodes' => (int) $nodes['revision'],
                'clients' => $this->realtime->orchClientsRevision(),
            ],
            'clients' => $clients,
            'nodes' => $nodes['nodes'],
            'pool' => $nodes['pool'],
            'plans' => $this->planRows(array_slice(array_values(array_unique($planIds)), 0, self::MONITOR_PLANS_MAX)),
        ];
    }

    /** @param array<int,string> $planIds */
    private function planRows(array $planIds): array
    {
        $rows = [];

        foreach ($planIds as $planId) {
            $plan = $this->plans->plan($planId);
            if ($plan === null) {
                continue;
            }
            $status = $this->plans->status($planId) ?? [];
            $layout = $this->assignments->monitorLayout($planId);
            $rows[] = [
                'plan_id' => $planId,
                'source_key' => (string) $plan->source_key,
                'languages' => array_values((array) json_decode((string) $plan->languages, true)),
                'include_words' => (bool) $plan->include_words,
                'include_phrases' => (bool) ($plan->include_phrases ?? false),
                'counters' => array_intersect_key($status, array_flip(['state', 'total', 'ready', 'generating', 'queued', 'failed', 'empty_languages', 'nodes', 'updated_at'])),
                'mode' => $layout !== null && $layout['expires_in'] > 0 ? 'app_led' : 'laravel_fallback',
                'layout' => $layout,
            ];
        }

        return $rows;
    }

    /** @return array<string,array{user_id:int,user_name:string,report:array,received_at:int,online:bool}> by entry key */
    private function entries(): array
    {
        $cache = QueueCenterCacheStore::get();
        $ttl = (int) self::setting('ttl_seconds');
        $now = time();
        $entries = [];
        $keys = (array) $cache->get(self::INDEX_KEY, []);

        foreach ($keys as $key) {
            $entry = $cache->get(self::ENTRY_KEY . $key);
            if (!is_array($entry)) {
                continue;
            }
            $entry['online'] = $now - (int) $entry['received_at'] < $ttl;
            $entries[(string) $key] = $entry;
        }
        if (count($entries) !== count($keys)) {
            $cache->put(self::INDEX_KEY, array_keys($entries), $this->retentionSeconds());
        }

        return $entries;
    }

    private function remember(string $key): void
    {
        $cache = QueueCenterCacheStore::get();
        $keys = (array) $cache->get(self::INDEX_KEY, []);

        if (!in_array($key, $keys, true)) {
            $keys[] = $key;
        }
        $cache->put(self::INDEX_KEY, array_values($keys), $this->retentionSeconds());
    }

    /** Report content without the per-report counters, so an unchanged state does not republish. */
    private function fingerprint(array $report): string
    {
        foreach (self::VOLATILE_FIELDS as $field) {
            unset($report[$field]);
        }
        foreach ((array) ($report['assignments'] ?? []) as $index => $assignment) {
            unset($report['assignments'][$index]['expires_in']);
        }

        return sha1((string) json_encode($report));
    }

    private function retentionSeconds(): int
    {
        return (int) self::setting('ttl_seconds') * self::RETENTION_FACTOR;
    }
}
