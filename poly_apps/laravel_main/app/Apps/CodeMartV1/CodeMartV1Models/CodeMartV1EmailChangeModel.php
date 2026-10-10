<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;

class CodeMartV1EmailChangeModel extends CodeMartV1Model
{
    protected $table = CodeMartV1TablesMaps::EMAIL_CHANGES_TABLE;

    protected $fillable = [
        'user_id',
        'new_email',
        'token_hash',
        'expires_at',
        'confirmed_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'confirmed_at' => 'datetime',
    ];

    /** One pending change per user: a new request replaces the previous one. */
    public static function replacePendingForUser(int $userId, string $newEmail, string $tokenHash, \DateTimeInterface $expiresAt): self
    {
        static::query()->where('user_id', $userId)->whereNull('confirmed_at')->delete();

        return static::createRecord([
            'user_id' => $userId,
            'new_email' => $newEmail,
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
        ]);
    }

    public static function findPendingForUser(int $userId, string $tokenHash): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('token_hash', $tokenHash)
            ->whereNull('confirmed_at')
            ->where('expires_at', '>', now())
            ->first();
    }
}
