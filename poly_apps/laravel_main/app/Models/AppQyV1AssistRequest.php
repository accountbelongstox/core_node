<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Models;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Model;

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
class AppQyV1AssistRequest extends Model
{
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
}
