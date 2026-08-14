<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Models\Model;

class CodeMartV1EmailVerificationModel extends Model
{
    protected $guarded = [];
    protected $table;

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::CODEMARTV1);
        $this->table = CodeMartV1TablesMaps::EMAIL_VERIFICATIONS_TABLE;
    }

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
