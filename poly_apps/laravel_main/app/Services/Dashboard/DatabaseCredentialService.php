<?php

namespace App\Services\Dashboard;

use App\Support\RuntimeConfigurationStore;
use Illuminate\Support\Facades\DB;

/**
 * PostgreSQL role credential management for the dashboard.
 *
 * Changing the password does TWO things atomically from the operator's view:
 *  1. ALTER the role/user password on the live (already-authenticated) connection.
 *  2. SYNC the new password back into the credential store that config/database.php
 *     reads (RuntimeConfigurationStore / global-var, e.g. POSTGRES_PASSWORD) -- NEVER .env --
 *     and into the running process's runtime config, then reconnect. So Laravel and
 *     the .sh toolchain keep connecting with the new password, with no downtime.
 *
 * Password changes use ALTER USER and synchronize POSTGRES_PASSWORD.
 */
class DatabaseCredentialService
{
    /**
     * Describe the credential surface for a connection. Includes the CURRENT
     * working password (from runtime config, which mirrors the RuntimeConfigurationStore
     * store) and the database account list — this endpoint sits behind the
     * `dashboard.auth` admin gate, the same trust level that can already
     * change/reset the password.
     */
    public static function info(string $connection): array
    {
        $desc = DatabaseManagerService::resolve($connection);
        $driver = $desc['driver'];

        return [
            'connection' => $connection,
            'driver' => $driver,
            'supports_password' => true,
            'superuser' => self::superuser($connection),
            'password' => (string) config("database.connections.{$connection}.password", ''),
            'users' => self::listUsers($connection),
            'secret_key' => self::secretKey(),
            'note' => 'Changing this password re-syncs it into Laravel\'s own credential store.',
        ];
    }

    /**
     * List PostgreSQL roles, excluding internal pg_* roles.
     *
     * @return array<int, array{name: string, super: bool, can_login: bool, host: string|null}>
     */
    public static function listUsers(string $connection): array
    {
        $conn = DB::connection($connection);
        $users = [];

        try {
            $rows = $conn->select(
                "SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg\\_%' ORDER BY rolname"
            );
            foreach ($rows as $r) {
                $users[] = [
                    'name' => (string) $r->rolname,
                    'super' => (bool) $r->rolsuper,
                    'can_login' => (bool) $r->rolcanlogin,
                    'host' => null,
                ];
            }
        } catch (\Throwable $e) {
            // listing is best-effort (e.g. missing catalog privilege) -> empty
        }

        return $users;
    }

    /**
     * Change a database account's password. Defaults to the configured
     * superuser. The RuntimeConfigurationStore store + runtime config are re-synced
     * ONLY when the changed account IS the configured superuser (other
     * accounts are not what Laravel connects as).
     */
    public static function changePassword(string $connection, string $newPassword, ?string $user = null): array
    {
        $desc = DatabaseManagerService::resolve($connection);
        $driver = $desc['driver'];

        if ($newPassword === '') {
            throw new \InvalidArgumentException('Password cannot be empty.');
        }

        $superuser = self::superuser($connection);
        $user = $user !== null && $user !== '' ? $user : $superuser;
        self::assertAccountName($user);
        $isConfiguredAccount = $user === $superuser;

        $conn = DB::connection($connection);
        $literal = $conn->getPdo()->quote($newPassword); // driver-safe string literal

        // 1) ALTER on the live connection (authenticated as the superuser already).
        $conn->statement('ALTER USER ' . self::quoteIdentPg($user) . ' WITH PASSWORD ' . $literal);

        // 2+3) Store sync + runtime reconnect apply only to the account Laravel
        // itself connects as; other accounts never touch the credential store.
        $key = $isConfiguredAccount ? self::secretKey() : null;
        $synced = $key !== null ? RuntimeConfigurationStore::put($key, $newPassword) : false;
        if ($isConfiguredAccount) {
            config(["database.connections.{$connection}.password" => $newPassword]);
            DB::purge($connection);
        }

        return [
            'connection' => $connection,
            'driver' => $driver,
            'user' => $user,
            'is_configured_account' => $isConfiguredAccount,
            'synced' => $synced,
            'secret_key' => $key,
        ];
    }

    /**
     * Create a PostgreSQL LOGIN role. Empty password generates a strong value
     * returned once. Database-level privileges are granted; table grants remain
     * an explicit operator decision.
     */
    public static function createUser(string $connection, string $username, ?string $password = null): array
    {
        $desc = DatabaseManagerService::resolve($connection);
        $driver = $desc['driver'];

        self::assertAccountName($username);

        $generated = $password === null || $password === '';
        $password = $generated ? self::generatePassword() : $password;

        $conn = DB::connection($connection);
        $literal = $conn->getPdo()->quote($password);
        $database = (string) config("database.connections.{$connection}.database");

        $conn->statement('CREATE ROLE ' . self::quoteIdentPg($username) . ' WITH LOGIN PASSWORD ' . $literal);
        $conn->statement('GRANT ALL PRIVILEGES ON DATABASE ' . self::quoteIdentPg($database) . ' TO ' . self::quoteIdentPg($username));

        return [
            'connection' => $connection,
            'driver' => $driver,
            'username' => $username,
            'password' => $password,
            'generated' => $generated,
        ];
    }

    /** Drop a database account. The configured superuser is guarded. */
    public static function dropUser(string $connection, string $username): array
    {
        $desc = DatabaseManagerService::resolve($connection);
        $driver = $desc['driver'];

        self::assertAccountName($username);
        if ($username === self::superuser($connection)) {
            throw new \RuntimeException('Refusing to drop the account Laravel itself connects as.');
        }

        $conn = DB::connection($connection);
        $database = (string) config("database.connections.{$connection}.database");
        // The createUser() database-level GRANT is a dependency that blocks
        // DROP ROLE. Objects owned by the role still block the drop intentionally.
        $conn->statement('REVOKE ALL PRIVILEGES ON DATABASE ' . self::quoteIdentPg($database) . ' FROM ' . self::quoteIdentPg($username));
        $conn->statement('DROP ROLE ' . self::quoteIdentPg($username));

        return ['connection' => $connection, 'driver' => $driver, 'username' => $username];
    }

    /** Generate a strong password, apply it, and return it ONCE for the operator. */
    public static function resetPassword(string $connection): array
    {
        $new = self::generatePassword();
        $result = self::changePassword($connection, $new);
        $result['new_password'] = $new;

        return $result;
    }

    // ---- helpers -----------------------------------------------------------

    private static function superuser(string $connection): string
    {
        return (string) config("database.connections.{$connection}.username", 'postgres');
    }

    private static function secretKey(): string
    {
        return 'POSTGRES_PASSWORD';
    }

    /**
     * Defense-in-depth account-name validation. Identifiers are also quoted
     * everywhere, but constraining the charset keeps grants/logs sane.
     */
    private static function assertAccountName(string $name): void
    {
        if ($name === '' || strlen($name) > 63 || !preg_match('/^[A-Za-z_][A-Za-z0-9_\-]*$/', $name)) {
            throw new \InvalidArgumentException(
                'Invalid account name (use letters, digits, _ or -, starting with a letter/underscore).'
            );
        }
    }

    private static function quoteIdentPg(string $ident): string
    {
        return '"' . str_replace('"', '""', $ident) . '"';
    }

    private static function generatePassword(int $bytes = 24): string
    {
        // URL/SQL-safe, no quote/backslash chars; ~32 chars of entropy.
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/=', 'AaB'), 'B');
    }
}
