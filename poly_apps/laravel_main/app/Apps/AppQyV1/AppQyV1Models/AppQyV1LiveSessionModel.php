<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Collection;

/**
 * Live session (Social Center expansion §LIVE). No native broadcast — an
 * external embed (external_url) plus SSE chat. status live|ended; viewer_count
 * recomputed from recent live_viewers heartbeats. created_at only.
 */
class AppQyV1LiveSessionModel extends Model
{
    public const STATUS_LIVE = 'live';
    public const STATUS_ENDED = 'ended';

    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('LIVE_SESSIONS');
    }

    protected $fillable = [
        'host_id',
        'title',
        'description',
        'status',
        'external_url',
        'viewer_count',
        'started_at',
        'ended_at',
        'created_at',
    ];

    protected $casts = [
        'host_id' => 'integer',
        'viewer_count' => 'integer',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function messages(): HasMany
    {
        return $this->hasMany(AppQyV1LiveMessageModel::class, 'session_id');
    }

    public static function listed(string $status, int $limit): Collection
    {
        $query = null;

        $query = static::query();
        if ($status === self::STATUS_LIVE) {
            $query->where('status', self::STATUS_LIVE);
        }

        return $query->orderByDesc('id')->limit($limit)->get();
    }

    public static function startForHost(
        int $hostId,
        string $title,
        ?string $description,
        ?string $externalUrl
    ): self {
        return static::query()->create([
            'host_id' => $hostId,
            'title' => $title,
            'description' => $description,
            'status' => self::STATUS_LIVE,
            'external_url' => $externalUrl,
            'viewer_count' => 0,
            'started_at' => now(),
            'ended_at' => null,
            'created_at' => now(),
        ]);
    }

    public static function findSession(int $sessionId): ?self
    {
        return static::query()->find($sessionId);
    }

    public function endSession(): self
    {
        if ((string) $this->status !== self::STATUS_ENDED) {
            $this->status = self::STATUS_ENDED;
            $this->ended_at = now();
            $this->save();
        }

        return $this;
    }

    public function syncViewerCount(int $viewerCount): void
    {
        if ((int) $this->viewer_count === $viewerCount) {
            return;
        }

        $this->viewer_count = $viewerCount;
        $this->save();
    }
}
