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

use Illuminate\Support\Collection;

/**
 * Live chat message (Social Center expansion §LIVE chat). Append-only; polled by
 * the FE (cursor by id) and mirrored to viewers/host via the social_events SSE
 * outbox. created_at only.
 */
class AppQyV1LiveMessageModel extends AppQyV1Model
{
    public $timestamps = false;


    protected ?string $appTableMapKey = 'LIVE_MESSAGES';

    protected $fillable = [
        'session_id',
        'user_id',
        'body',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'session_id' => 'integer',
            'user_id' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public static function afterCursor(int $sessionId, int $cursor, int $limit): Collection
    {
        return static::query()
            ->where('session_id', $sessionId)
            ->where('id', '>', $cursor)
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public static function append(int $sessionId, int $userId, string $body): self
    {
        return static::query()->create([
            'session_id' => $sessionId,
            'user_id' => $userId,
            'body' => $body,
            'created_at' => now(),
        ]);
    }
}
