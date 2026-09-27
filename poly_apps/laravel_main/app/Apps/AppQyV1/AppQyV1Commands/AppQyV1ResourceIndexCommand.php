<?php

namespace App\Apps\AppQyV1\AppQyV1Commands;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ResourceIndexService;
use App\Utils\RedisBucketIndex;
use Illuminate\Console\Command;

/**
 * Rebuild or inspect the Redis static resource index used by the delivery
 * diff. Idempotent: every kind is re-derived from the database/disk and
 * swapped in per bucket.
 */
class AppQyV1ResourceIndexCommand extends Command
{
    private const ACTION_REBUILD = 'rebuild';
    private const ACTION_STATUS = 'status';
    private const ACTION_RECONCILE = 'reconcile';
    private const ACTIONS = [self::ACTION_REBUILD, self::ACTION_RECONCILE, self::ACTION_STATUS];
    private const DEFAULT_RECONCILE_SECONDS = 300;
    private const BUILT_YES = 'resource_index_built=yes';
    private const BUILT_NO = 'resource_index_built=no';

    protected $signature = 'app_qy_v1:resource-index
        {action=status : rebuild|reconcile|status}
        {--kind=* : Limit rebuild to these kinds (default: all)}
        {--seconds=300 : Time budget of one reconcile run}';

    protected $description = 'Rebuild or show the Redis static resource index used by the pycore delivery diff';

    public function handle(AppQyV1ResourceIndexService $index): int
    {
        $action = (string) $this->argument('action');
        $kinds = $this->option('kind') !== [] ? $this->option('kind') : AppQyV1ResourceIndexService::INDEXED_KINDS;
        $started = 0.0;
        $count = 0;

        if (!in_array($action, self::ACTIONS, true)) {
            $this->error(__('app_qy_v1.messages.unknown_action', [
                'action' => $action,
                'expected' => implode(', ', self::ACTIONS),
            ]));
            return self::INVALID;
        }
        foreach ($kinds as $kind) {
            if (!in_array($kind, AppQyV1ResourceIndexService::INDEXED_KINDS, true)) {
                $this->error(__('app_qy_v1.messages.unknown_kind', [
                    'kind' => $kind,
                    'expected' => implode(', ', AppQyV1ResourceIndexService::INDEXED_KINDS),
                ]));
                return self::INVALID;
            }
        }
        if (!RedisBucketIndex::available()) {
            $this->warn(__('app_qy_v1.messages.resource_index_redis_unavailable'));
            $this->line(self::BUILT_NO);
            return $action === self::ACTION_STATUS ? self::SUCCESS : self::FAILURE;
        }
        if ($action === self::ACTION_REBUILD) {
            foreach ($kinds as $kind) {
                $started = microtime(true);
                $count = $index->rebuild($kind);
                $this->info(__('app_qy_v1.messages.resource_index_kind_rebuilt', [
                    'kind' => $kind,
                    'count' => $count,
                    'seconds' => sprintf('%.1f', microtime(true) - $started),
                ]));
            }
        }
        if ($action === self::ACTION_RECONCILE) {
            $stats = $index->reconcile((float) ($this->option('seconds') ?: self::DEFAULT_RECONCILE_SECONDS));
            $this->info(__('app_qy_v1.messages.resource_index_reconcile_summary', [
                'buckets' => $stats['buckets'],
                'checked' => $stats['checked'],
                'dropped' => $stats['dropped'],
                'updated' => $stats['updated'],
                'added' => $stats['added'],
                'completed' => __($stats['pass_completed'] ? 'app_qy_v1.messages.answer_yes' : 'app_qy_v1.messages.answer_no'),
            ]));
        }
        foreach (RedisBucketIndex::count($kinds) as $kind => $entries) {
            $status = $index->status()['kinds'][$kind] ?? [];
            $this->line(__('app_qy_v1.messages.resource_index_kind_status', [
                'kind' => $kind,
                'entries' => $entries,
                'built_at' => $status['built_at'] ?? __('app_qy_v1.messages.resource_index_never_built'),
            ]));
        }
        // Machine-readable marker parsed by the laravel_main service scripts.
        $this->line($index->built() ? self::BUILT_YES : self::BUILT_NO);

        return self::SUCCESS;
    }
}
