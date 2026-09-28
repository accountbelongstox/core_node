<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;

class CodeMartV1EmailVerificationModel extends CodeMartV1Model
{
    protected $guarded = [];
    protected $table = CodeMartV1TablesMaps::EMAIL_VERIFICATIONS_TABLE;

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public static function consume(string $email, string $token): bool
    {
        $record = self::query()
            ->where('email', $email)
            ->where('token', $token)
            ->whereNull('verified_at')
            ->first();

        if ($record === null) {
            return false;
        }

        $record->verified_at = now();

        return $record->save();
    }

    public static function replaceForEmail(string $email, string $token): self
    {
        return self::query()->updateOrCreate(
            ['email' => $email],
            ['token' => $token, 'verified_at' => null]
        );
    }

    public static function isVerifiedEmail(string $email): bool
    {
        return self::query()->where('email', $email)->whereNotNull('verified_at')->exists();
    }
}
