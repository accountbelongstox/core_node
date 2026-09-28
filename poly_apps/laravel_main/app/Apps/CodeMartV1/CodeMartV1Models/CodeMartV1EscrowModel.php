<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Platform-held funds. A project_funding escrow holds the client's funded
 * amount; payee_id equals payer_id until funds are released per task, because
 * the payee column is NOT NULL and a pool escrow has no single payee.
 * Remaining = amount - released_amount - refunded_amount.
 */
class CodeMartV1EscrowModel extends CodeMartV1Model
{
    use RunsModelTransactions;

    protected $table = 'codemart_v1_escrows';

    protected $fillable = [
        'project_id',
        'payer_id',
        'payee_id',
        'amount',
        'currency',
        'status',
        'released_at',
        'release_reason',
        'escrow_type',
        'released_amount',
        'refunded_amount',
        'idempotency_key',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'released_amount' => 'decimal:2',
        'refunded_amount' => 'decimal:2',
        'released_at' => 'datetime',
        'metadata' => 'json',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'payer_id');
    }

    public function payee(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1UserModel::class, 'payee_id');
    }

    /**
     * Sum of still-protected funds (amount - released - refunded) over the
     * given query's escrows.
     */
    public static function sumRemaining($query): float
    {
        return (float) (clone $query)
            ->selectRaw('COALESCE(SUM(amount - COALESCE(released_amount, 0) - COALESCE(refunded_amount, 0)), 0) AS remaining_total')
            ->value('remaining_total');
    }

    public function remainingAmount(): string
    {
        return bcsub(
            bcsub((string) $this->amount, (string) ($this->released_amount ?? '0'), 2),
            (string) ($this->refunded_amount ?? '0'),
            2
        );
    }

    public static function lockHeldForProject(int $projectId): ?self
    {
        return static::query()
            ->where('project_id', $projectId)
            ->where('escrow_type', CodeMartV1Constants::ESCROW_TYPE_PROJECT_FUNDING)
            ->where('status', CodeMartV1Constants::ESCROW_STATUS_HELD)
            ->orderBy('id')
            ->lockForUpdate()
            ->first();
    }

    public static function findByIdempotencyKey(int $payerId, string $key): ?self
    {
        return static::query()->where('payer_id', $payerId)->where('idempotency_key', $key)->first();
    }

    /** Records a release of $amount; closes the escrow when nothing remains. Caller holds the row lock. */
    public function recordRelease(string $amount, string $reason): void
    {
        $this->released_amount = bcadd((string) ($this->released_amount ?? '0'), $amount, 2);
        $this->release_reason = $reason;
        if (bccomp($this->remainingAmount(), '0', 2) <= 0) {
            $this->status = CodeMartV1Constants::ESCROW_STATUS_RELEASED;
            $this->released_at = now();
        }
        $this->save();
    }

    /** Records a refund of $amount back to the payer. Caller holds the row lock. */
    public function recordRefund(string $amount, string $reason): void
    {
        $this->refunded_amount = bcadd((string) ($this->refunded_amount ?? '0'), $amount, 2);
        $this->release_reason = $reason;
        if (bccomp($this->remainingAmount(), '0', 2) <= 0) {
            $this->status = bccomp((string) $this->released_amount, '0', 2) > 0
                ? CodeMartV1Constants::ESCROW_STATUS_RELEASED
                : CodeMartV1Constants::ESCROW_STATUS_REFUNDED;
            $this->released_at = now();
        }
        $this->save();
    }

    public static function adminPage(?string $status, ?int $projectId, int $page, int $pageSize): array
    {
        $query = static::query()->with(['payer:id,username,name', 'payee:id,username,name', 'project:id,title,status']);
        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }
        if ($projectId !== null) {
            $query->where('project_id', $projectId);
        }

        return self::paginateQuery($query->orderByDesc('id'), 'escrows', $page, $pageSize);
    }
}
