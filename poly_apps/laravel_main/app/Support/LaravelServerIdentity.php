<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Services\DataSync\DataSyncMachineIdentity;
use App\Utils\FileSystemManager;

/**
 * Stable identity of this Laravel server, used by pycore to namespace its
 * delivery state per server. Derived from the OS installation id
 * (DataSyncMachineIdentity) plus a nonce persisted in the Laravel data dir,
 * so it survives restarts, differs per OS installation (dual-boot systems
 * sharing one data dir) and changes when the data dir is fresh or copied to
 * another machine. Never stored in PostgreSQL, so DataSync copies never clone it.
 */
final class LaravelServerIdentity
{
    private const IDENTITY_SUBDIR = 'identity';
    private const ID_LENGTH = 32;
    private const NONCE_BYTES = 16;
    private const MACHINE_PREFIX_LENGTH = 16;
    private const DOMAIN = 'laravel-server';

    private static ?string $serverId = null;

    public static function id(): string
    {
        $machineCode = '';
        $path = '';
        $nonce = '';

        if (self::$serverId !== null) {
            return self::$serverId;
        }
        $machineCode = (new DataSyncMachineIdentity())->code();
        $path = PathMapper::getLaravelDataDir(self::IDENTITY_SUBDIR . '/server_'
            . substr($machineCode, 0, self::MACHINE_PREFIX_LENGTH) . '.json');
        $nonce = self::readNonce($path);
        if ($nonce === '') {
            $nonce = bin2hex(random_bytes(self::NONCE_BYTES));
            FileSystemManager::runWithExclusiveFileLock($path . '.lock', static function () use ($path, &$nonce): void {
                $stored = self::readNonce($path);
                if ($stored !== '') {
                    $nonce = $stored;
                    return;
                }
                FileSystemManager::writeFileAtomic($path, (string) json_encode([
                    'nonce' => $nonce,
                    'created_at' => gmdate('c'),
                ]));
            }, true);
        }
        self::$serverId = substr(hash('sha256', self::DOMAIN . "\n" . $machineCode . "\n" . $nonce), 0, self::ID_LENGTH);

        return self::$serverId;
    }

    private static function readNonce(string $path): string
    {
        $content = FileSystemManager::readFile($path, false);
        $document = is_string($content) ? json_decode($content, true) : null;
        $nonce = is_array($document) ? (string) ($document['nonce'] ?? '') : '';

        return preg_match('/^[a-f0-9]{32}$/', $nonce) === 1 ? $nonce : '';
    }
}
