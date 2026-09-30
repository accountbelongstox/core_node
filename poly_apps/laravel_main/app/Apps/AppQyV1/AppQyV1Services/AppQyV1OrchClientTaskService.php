<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1OrchClientTaskModel as ClientTask;
use Illuminate\Support\Carbon;

/**
 * Per-user manifest of client orchestration tasks. Last writer by
 * client_updated_at wins; a tombstone (deleted_at) is overwritten only by a
 * strictly newer edit.
 */
final class AppQyV1OrchClientTaskService
{
    public const ERROR_CONFIG_TOO_LARGE = 'ORCH_CLIENT_TASK_CONFIG_TOO_LARGE';

    public const CONFIG_MAX_BYTES = 262144;
    private const TOMBSTONE_SOURCE = 'unknown';
    private const DEFAULT_STATUS = 'draft';

    public function list(int $userId, ?string $since, int $page, int $perPage): array
    {
        $sinceAt = $since !== null ? $this->parseTime($since) : null;
        $result = ClientTask::pageForUser($userId, $sinceAt?->toDateTimeString(), $page, $perPage);

        return [
            'items' => $result['items']->map(fn (ClientTask $row): array => $this->present($row))->all(),
            'total' => $result['total'],
            'page' => $page,
            'per_page' => $perPage,
            'server_time' => $this->iso(now()),
        ];
    }

    /** @return array{error_code?:string,http?:int,data?:array} */
    public function upsert(int $userId, string $clientTaskId, array $fields): array
    {
        $clientUpdatedAt = $this->parseTime((string) $fields['client_updated_at']);
        $config = $fields['config'] ?? null;
        $row = null;

        if ($config !== null && strlen((string) json_encode($config)) > self::CONFIG_MAX_BYTES) {
            return ['error_code' => self::ERROR_CONFIG_TOO_LARGE, 'http' => 413];
        }

        $row = ClientTask::findForUser($userId, $clientTaskId);
        if ($row !== null && $this->isNotNewer($clientUpdatedAt, $row)) {
            return ['data' => ['applied' => false, 'task' => $this->present($row)]];
        }
        if ($row === null) {
            $row = new ClientTask(['user_id' => $userId, 'client_task_id' => $clientTaskId]);
        }
        $row->fill([
            'name' => $fields['name'] ?? null,
            'source' => $fields['source'],
            'language' => $fields['language'] ?? null,
            'source_ref' => $fields['source_ref'] ?? null,
            'config' => $config,
            'plan_hash' => $fields['plan_hash'] ?? null,
            'status' => $fields['status'] ?? self::DEFAULT_STATUS,
            'segment_count' => (int) ($fields['segment_count'] ?? 0),
            'item_count' => (int) ($fields['item_count'] ?? 0),
            'duration_ms' => (int) ($fields['duration_ms'] ?? 0),
            'device_id' => $fields['device_id'] ?? null,
            'client_updated_at' => $clientUpdatedAt,
            'deleted_at' => null,
        ]);
        $row->save();

        return ['data' => ['applied' => true, 'task' => $this->present($row)]];
    }

    /** Idempotent: an older or equal stamp than the stored one changes nothing. */
    public function tombstone(int $userId, string $clientTaskId, string $clientUpdatedAt): array
    {
        $stamp = $this->parseTime($clientUpdatedAt);
        $row = ClientTask::findForUser($userId, $clientTaskId);

        if ($row === null) {
            $row = new ClientTask([
                'user_id' => $userId,
                'client_task_id' => $clientTaskId,
                'source' => self::TOMBSTONE_SOURCE,
                'status' => self::DEFAULT_STATUS,
            ]);
        } elseif ($row->deleted_at !== null || $this->isNotNewer($stamp, $row)) {
            return ['applied' => false, 'task' => $this->present($row)];
        }
        $row->deleted_at = $stamp;
        $row->client_updated_at = $stamp;
        $row->save();

        return ['applied' => true, 'task' => $this->present($row)];
    }

    private function isNotNewer(Carbon $stamp, ClientTask $row): bool
    {
        $stored = $row->client_updated_at;

        if ($stored === null) {
            return false;
        }
        if ($row->deleted_at !== null) {
            return $stamp->lessThanOrEqualTo($stored);
        }

        return $stamp->lessThan($stored);
    }

    private function parseTime(string $value): Carbon
    {
        return Carbon::parse($value)->setTimezone(config('app.timezone'));
    }

    private function iso(Carbon $time): string
    {
        return $time->copy()->utc()->toIso8601ZuluString('millisecond');
    }

    private function present(ClientTask $row): array
    {
        return [
            'client_task_id' => $row->client_task_id,
            'name' => $row->name,
            'source' => $row->source,
            'language' => $row->language,
            'source_ref' => $row->source_ref,
            'config' => $row->config,
            'plan_hash' => $row->plan_hash,
            'status' => $row->status,
            'segment_count' => $row->segment_count,
            'item_count' => $row->item_count,
            'duration_ms' => $row->duration_ms,
            'device_id' => $row->device_id,
            'client_updated_at' => $row->client_updated_at !== null ? $this->iso($row->client_updated_at) : null,
            'deleted' => $row->deleted_at !== null,
            'updated_at' => $row->updated_at !== null ? $this->iso($row->updated_at) : null,
        ];
    }
}
