<?php

namespace App\Services\DataSync;

final class DataSyncSessionId
{
    private const PATTERN = '/^[A-Za-z0-9_-]{1,64}$/';

    public static function require(string $value): string
    {
        if (preg_match(self::PATTERN, $value) !== 1) {
            throw new \InvalidArgumentException(__('data_sync.session_id_invalid'));
        }

        return $value;
    }

    public static function valid(string $value): bool
    {
        return preg_match(self::PATTERN, $value) === 1;
    }
}
