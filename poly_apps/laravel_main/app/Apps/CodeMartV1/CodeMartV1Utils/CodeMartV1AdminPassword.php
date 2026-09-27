<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Providers\PathMapper;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Password of every account the CodeMart seeder creates, kept in the secret
 * file of config/service_contract.json#codemart_admin_password under the
 * Laravel data dir. The deploy ensure step (175 / Step175) rotates the file
 * and applies it with codemart:admin-password; the seeder only creates the
 * file when it is missing and never rehashes an existing account.
 */
final class CodeMartV1AdminPassword
{
    private const CONTRACT_SECTION = 'codemart_admin_password';
    private const SECRET_DIRECTORY_MODE = 0700;
    public const RESULT_UPDATED = 'updated';
    public const RESULT_UNCHANGED = 'unchanged';
    public const RESULT_MISSING = 'missing';

    public static function contract(): array
    {
        $section = ServiceContract::document()[self::CONTRACT_SECTION] ?? null;
        if (!is_array($section) || !isset($section['secret_file'], $section['length'], $section['file_mode'])) {
            throw new RuntimeException('Service contract section is incomplete: ' . self::CONTRACT_SECTION);
        }

        return $section;
    }

    public static function defaultPath(): string
    {
        return PathMapper::getLaravelDatabaseDir((string) self::contract()['secret_file']);
    }

    public static function read(string $path): ?string
    {
        $content = false;
        $password = '';

        if (!FileSystemManager::isFile($path) || !FileSystemManager::isReadable($path)) {
            return null;
        }
        $content = FileSystemManager::readFile($path, false);
        $password = is_string($content) ? trim($content) : '';

        return $password !== '' ? $password : null;
    }

    public static function generate(): string
    {
        return Str::random((int) self::contract()['length']);
    }

    public static function write(string $path, string $password): bool
    {
        if (!FileSystemManager::ensureDirectoryExists(dirname($path), self::SECRET_DIRECTORY_MODE)) {
            return false;
        }

        return FileSystemManager::writeFile($path, $password . "\n")
            && FileSystemManager::ensureFileMode($path, octdec((string) self::contract()['file_mode']));
    }

    /**
     * Returns the stored password, creating the secret file when it is missing.
     *
     * @return array{password: string, path: string, generated: bool}
     */
    public static function ensure(?string $path = null): array
    {
        $path ??= self::defaultPath();
        $password = self::read($path);

        if ($password !== null) {
            return ['password' => $password, 'path' => $path, 'generated' => false];
        }

        $password = self::generate();
        if (!self::write($path, $password)) {
            throw new RuntimeException('Unable to write the CodeMart admin password file: ' . $path);
        }

        return ['password' => $password, 'path' => $path, 'generated' => true];
    }

    /**
     * Sets $password on every seeded account whose hash does not already
     * match it (idempotent: the same password changes nothing).
     *
     * @return array<string, string> username => updated|unchanged|missing
     */
    public static function apply(string $password): array
    {
        $usernames = CodeMartV1DemoSeeder::seededUsernames();

        return CodeMartV1UserModel::runInTransaction(function () use ($usernames, $password): array {
            $results = [];
            $users = CodeMartV1UserModel::query()
                ->whereIn('username', $usernames)
                ->lockForUpdate()
                ->get()
                ->keyBy('username');

            foreach ($usernames as $username) {
                $user = $users->get($username);
                if ($user === null) {
                    $results[$username] = self::RESULT_MISSING;
                    continue;
                }
                if (Hash::check($password, (string) $user->password)) {
                    $results[$username] = self::RESULT_UNCHANGED;
                    continue;
                }
                $user->password = Hash::make($password);
                $user->save();
                $results[$username] = self::RESULT_UPDATED;
            }

            return $results;
        });
    }
}
