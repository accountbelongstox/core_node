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
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\Log;

/**
 * Per-user notification inbox (SOCIAL_FEATURE_SPECIFICATION.md §1/§2).
 * read_at null = unread. created_at only (no updated_at).
 */
class AppQyV1NotificationModel extends Model
{
    // created_at only; read_at flips on read. No updated_at column.
    public $timestamps = false;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('NOTIFICATIONS');
    }

    protected $fillable = [
        'user_id',
        'type',
        'payload',
        'read_at',
        'created_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'payload' => 'array',
        'read_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Create a notification for a recipient. Best-effort: a failure is logged and
     * swallowed so it never breaks the triggering action. Returns the row id or 0.
     */
    public static function notify(int $userId, string $type, array $payload = []): int
    {
        try {
            $row = static::query()->create([
                'user_id' => $userId,
                'type' => $type,
                'payload' => $payload,
                'read_at' => null,
                'created_at' => now(),
            ]);
            return (int) $row->id;
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1Notification] create failed', [
                'user_id' => $userId,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }
}
