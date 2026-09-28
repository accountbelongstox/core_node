<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class CloudClipboardContract
{
    private static ?array $contract = null;

    public static function get(string $key): mixed
    {
        self::$contract ??= json_decode(FileSystemManager::readFile(
            PathMapper::getCoreNodeDir().'/config/cloud_clipboard_contract.json'
        ), true, 512, JSON_THROW_ON_ERROR);

        return self::$contract[$key];
    }
}
