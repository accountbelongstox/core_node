<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Utils\RunsModelTransactions;
use App\Models\Model;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Record-scoped assist request (CoreBook §6).
 *
 * One row = "complete this specific missing piece for ONE record". Filed by the
 * Task Center modal (human selection) or by pycore on a partial CoreBook submit,
 * then claimed/processed by the existing assist/global-task workers via
 * request_type:
 *   - fill_audio   -> sentence-TTS pool
 *   - cover/poster -> existing cover/poster pools
 *   - add_language -> translation-assist consumer
 *
 * Status vocab: pending|claimed|processing|completed|failed. Claims carry a
 * 60-minute lease (claimed_at + claimed_by), mirroring the assist pool.
 */
class AppQyV1AssistRequestModel extends Model
{
    use RunsModelTransactions;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'assist_requests');
    }

    protected $fillable = [
        'record_type',
        'source_key',
        'request_type',
        'language',
        'status',
        'priority',
        'claimed_by',
        'claimed_at',
        'payload',
        'result',
        'error',
    ];

    protected $casts = [
        'payload' => 'array',
        'result' => 'array',
        'claimed_at' => 'datetime',
        'priority' => 'integer',
    ];

    // Status constants
    public const STATUS_PENDING = 'pending';
    public const STATUS_CLAIMED = 'claimed';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    // Lease length (minutes) — matches the assist pool's 60-minute lease.
    public const LEASE_MINUTES = 60;

    /** Scope: claimable pending rows (no live lease). */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING)
            ->where(function ($q) {
                $q->whereNull('claimed_at')
                    ->orWhere('claimed_at', '<', now()->subMinutes(self::LEASE_MINUTES));
            });
    }

    public static function filteredPage(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = self::query();

        foreach (['record_type', 'source_key', 'status', 'request_type'] as $column) {
            if (isset($filters[$column]) && $filters[$column] !== '') {
                $query->where($column, $filters[$column]);
            }
        }

        return $query->orderByDesc('priority')->orderByDesc('id')->paginate($perPage);
    }

    public static function fileRequests(
        string $recordType,
        string $sourceKey,
        int $priority,
        array $items
    ): array {
        return self::runInTransaction(function () use ($recordType, $sourceKey, $priority, $items) {
            $created = 0;
            $existing = 0;
            $rows = [];

            foreach ($items as $item) {
                $requestType = $item['request_type'];
                $language = in_array($requestType, ['cover', 'poster'], true)
                    ? null
                    : (isset($item['language']) && $item['language'] !== '' ? (string) $item['language'] : null);
                $payload = $item['payload'] ?? null;
                $query = self::query()
                    ->where('record_type', $recordType)
                    ->where('source_key', $sourceKey)
                    ->where('request_type', $requestType);

                $language === null
                    ? $query->whereNull('language')
                    : $query->where('language', $language);

                $row = $query->lockForUpdate()->first();
                if ($row !== null) {
                    if ($row->status === self::STATUS_FAILED) {
                        $row->status = self::STATUS_PENDING;
                        $row->error = null;
                        $row->claimed_at = null;
                        $row->claimed_by = null;
                        if ($payload !== null) {
                            $row->payload = $payload;
                        }
                        $row->save();
                    }
                    $existing++;
                    $rows[] = $row;
                    continue;
                }

                $rows[] = self::create([
                    'record_type' => $recordType,
                    'source_key' => $sourceKey,
                    'request_type' => $requestType,
                    'language' => $language,
                    'status' => self::STATUS_PENDING,
                    'priority' => $priority,
                    'payload' => $payload,
                ]);
                $created++;
            }

            return ['created' => $created, 'existing' => $existing, 'items' => $rows];
        });
    }

    public static function findRequest(int $id): ?self
    {
        return self::query()->find($id);
    }

    public static function releaseRequests(array $ids, ?string $error): int
    {
        $rows = self::query()
            ->whereIn('id', $ids)
            ->whereIn('status', [self::STATUS_CLAIMED, self::STATUS_PROCESSING])
            ->get();

        foreach ($rows as $row) {
            $row->release($error);
        }

        return $rows->count();
    }

    public static function deleteRequest(int $id): int
    {
        return self::query()->whereKey($id)->delete();
    }

    public static function claimPending(array $types, int $limit, string $claimer): array
    {
        $model = new self();

        return $model->getConnection()->transaction(function () use ($types, $limit, $claimer) {
            $leaseFloor = now()->subMinutes(self::LEASE_MINUTES);
            $rows = self::query()
                ->whereIn('request_type', $types)
                ->where('status', self::STATUS_PENDING)
                ->where(function ($query) use ($leaseFloor) {
                    $query->whereNull('claimed_at')
                        ->orWhere('claimed_at', '<', $leaseFloor);
                })
                ->orderByDesc('priority')
                ->orderBy('id')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            foreach ($rows as $row) {
                $row->claim($claimer);
            }

            return $rows->all();
        }, 1);
    }

    /**
     * Atomically lease this row to a worker (60-minute lease).
     */
    public function claim(string $workerId): void
    {
        $this->status = self::STATUS_CLAIMED;
        $this->claimed_by = mb_substr($workerId, 0, 64);
        $this->claimed_at = now();
        $this->save();
    }

    /** Mark the leased row as actively processing. */
    public function markProcessing(): void
    {
        $this->status = self::STATUS_PROCESSING;
        $this->save();
    }

    /** Complete the request with an optional result payload, clearing the lease. */
    public function complete(?array $result = null): void
    {
        $this->status = self::STATUS_COMPLETED;
        if ($result !== null) {
            $this->result = $result;
        }
        $this->error = null;
        $this->claimed_at = null;
        $this->claimed_by = null;
        $this->save();
    }

    /** Fail the request with an error, clearing the lease. */
    public function fail(?string $error = null): void
    {
        $this->status = self::STATUS_FAILED;
        if ($error !== null && $error !== '') {
            $this->error = mb_substr($error, 0, 2000);
        }
        $this->claimed_at = null;
        $this->claimed_by = null;
        $this->save();
    }

    /** Release the lease back to pending (no attempt consumed). */
    public function release(?string $error = null): void
    {
        $this->status = self::STATUS_PENDING;
        if ($error !== null && $error !== '') {
            $this->error = mb_substr($error, 0, 2000);
        }
        $this->claimed_at = null;
        $this->claimed_by = null;
        $this->save();
    }

    public static function groupedOverview(string $recordType, string $requestType, int $limit): array
    {
        $base = static fn () => self::query()
            ->where('record_type', $recordType)
            ->where('request_type', $requestType);
        $byStatus = $base()->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status');
        $byLanguage = $base()->groupBy('language')->selectRaw('language, count(*) as total')->pluck('total', 'language');
        $sample = $base()
            ->whereIn('status', [self::STATUS_PENDING, self::STATUS_CLAIMED, self::STATUS_PROCESSING])
            ->orderByDesc('priority')
            ->orderBy('id')
            ->limit($limit)
            ->get(['id', 'source_key', 'language']);

        return ['by_status' => $byStatus, 'by_language' => $byLanguage, 'sample' => $sample];
    }

    public static function queuePage(
        string $recordType,
        string $requestType,
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array {
        $query = self::query()->where('record_type', $recordType)->where('request_type', $requestType);

        if ($status === 'leased') {
            $query->whereNotNull('claimed_at')
                ->where('claimed_at', '>=', now()->subMinutes(self::LEASE_MINUTES));
        } elseif (in_array($status, ['pending', 'processing', 'completed', 'failed'], true)) {
            $query->where('status', $status);
        }
        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($builder) use ($like): void {
                $builder->where('record_id', 'like', $like)
                    ->orWhere('language', 'like', $like)
                    ->orWhere('claimed_by', 'like', $like);
            });
        }

        return [
            'total' => (int) (clone $query)->count(),
            'rows' => $query->orderByDesc('priority')->orderByDesc('id')->offset($start)->limit($limit)
                ->get(['id', 'status', 'priority', 'language', 'record_id', 'claimed_by', 'claimed_at', 'created_at']),
        ];
    }
}
