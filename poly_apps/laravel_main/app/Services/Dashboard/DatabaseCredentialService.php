<?php

namespace App\Services\Dashboard;

use App\Support\CoreNodeSecrets;
use Illuminate\Support\Facades\DB;

/**
 * Database superuser/root credential management for the dashboard (driver-aware).
 *
 * Changing the password does TWO things atomically from the operator's view:
 *  1. ALTER the role/user password on the live (already-authenticated) connection.
 *  2. SYNC the new password back into the credential store that config/database.php
 *     reads (CoreNodeSecrets / global-var, e.g. POSTGRES_PASSWORD) -- NEVER .env --
 *     and into the running process's runtime config, then reconnect. So Laravel and
 *     the .sh toolchain keep connecting with the new password, with no downtime.
 *
 * pgsql -> ALTER USER ... WITH PASSWORD ; sync POSTGRES_PASSWORD.
 * mysql -> ALTER USER ...@'localhost' IDENTIFIED BY ... ; sync MYSQL_PASSWORD.
 * sqlite -> not applicable (file-based, no password).
 */
class DatabaseCredentialService
{
    /**
     * Describe the credential surface for a connection. Includes the CURRENT
     * working password (from runtime config, which mirrors the CoreNodeSecrets
     * store) and the database account list — this endpoint sits behind the
     * `dashboard.auth` admin gate, the same trust level that can already
     * change/reset the password.
     */
    public static function info(string $connection): array
    {
        $desc = DatabaseManagerService::resolve($connection);
        $driver = $desc['driver'];
        $supports = in_array($driver, ['pgsql', 'mysql', 'mariadb'], true);

        return [
            'connection' => $connection,
            'driver' => $driver,
            'supports_password' => $supports,
            'superuser' => $supports ? self::superuser($connection, $driver) : null,
            'password' => $supports
                ? (string) config("database.connections.{$connection}.password", '')
                : null,
            'users' => $supports ? self::listUsers($connection, $driver) : [],
            'secret_key' => self::secretKey($driver),
            'note' => $supports
                ? 'Changing this password re-syncs it into Laravel\'s own credential store.'
                : 'SQLite databases are file-based and have no password or accounts.',
        ];
    }

    /**
     * List database accounts (driver-aware). pgsql: pg_roles (system pg_*
     * roles hidden); mysql/mariadb: mysql.user; sqlite: none.
     *
     * @return array<int, array{name: string, super: bool, can_login: bool, host: string|null}>
     */
    public static function listUsers(string $connection, ?string $driver = null): array
    {
        $driver = $driver ?? DatabaseManagerService::resolve($connection)['driver'];
        $conn = DB::connection($connection);
        $users = [];

        try {
            if ($driver === 'pgsql') {
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
            } elseif ($driver === 'mysql' || $driver === 'mariadb') {
                $rows = $conn->select('SELECT user, host, Super_priv FROM mysql.user ORDER BY user, host');
                foreach ($rows as $r) {
                    $users[] = [
                        'name' => (string) $r->user,
                        'super' => (($r->Super_priv ?? 'N') === 'Y'),
                        'can_login' => true,
                        'host' => (string) $r->host,
                    ];
                }
            }
        } catch (\Throwable $e) {
            // listing is best-effort (e.g. missing catalog privilege) -> empty
        }

        return $users;
    }

    /**
     * Change a database account's password. Defaults to the configured
     * superuser. The CoreNodeSecrets store + runtime config are re-synced
     * ONLY when the changed account IS the configured superuser (other
     * accounts are not what Laravel connects as).
     */
    public static function changePassword(string $connection, string $newPassword, ?string $user = null): array
    {
        $desc = DatabaseManagerService::resolve($connection);
        $driver = $desc['driver'];

        if (!in_array($driver, ['pgsql', 'mysql', 'mariadb'], true)) {
            throw new \RuntimeException('SQLite databases are file-based and have no password.');
        }
        if ($newPassword === '') {
            throw new \InvalidArgumentException('Password cannot be empty.');
        }

        $superuser = self::superuser($connection, $driver);
        $user = $user !== null && $user !== '' ? $user : $superuser;
        self::assertAccountName($user);
        $isConfiguredAccount = $user === $superuser;

        $conn = DB::connection($connection);
        $literal = $conn->getPdo()->quote($newPassword); // driver-safe string literal

        // 1) ALTER on the live connection (authenticated as the superuser already).
        if ($driver === 'pgsql') {
            $conn->statement('ALTER USER ' . self::quoteIdentPg($user) . ' WITH PASSWORD ' . $literal);
        } else {
            $conn->statement('ALTER USER ' . self::quoteIdentMy($user) . "@'localhost' IDENTIFIED BY " . $literal);
            $conn->statement('FLUSH PRIVILEGES');
        }

        // 2+3) Store sync + runtime reconnect apply only to the account Laravel
        // itself connects as; other accounts never touch the credential store.
        $key = $isConfiguredAccount ? self::secretKey($driver) : null;
        $synced = $key !== null ? CoreNodeSecrets::put($key, $newPassword) : false;
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
     * Create a database account (driver-aware). Empty password -> a strong one
     * is generated and returned ONCE. pgsql: LOGIN role + CONNECT/ALL on the
     * connection's database (database-level privileges; table grants are up to
     * the operator). mysql: user@'localhost' + ALL on the connection's schema.
     */
    public static function createUser(string $connection, string $username, ?string $password = null): array
    {
        $desc = DatabaseManagerService::resolve($connection);
        $driver = $desc['driver'];

        if (!in_array($driver, ['pgsql', 'mysql', 'mariadb'], true)) {
            throw new \RuntimeException('SQLite databases are file-based and have no accounts.');
        }
        self::assertAccountName($username);

        $generated = $password === null || $password === '';
        $password = $generated ? self::generatePassword() : $password;

        $conn = DB::connection($connection);
        $literal = $conn->getPdo()->quote($password);
        $database = (string) config("database.connections.{$connection}.database");

        if ($driver === 'pgsql') {
            $conn->statement('CREATE ROLE ' . self::quoteIdentPg($username) . ' WITH LOGIN PASSWORD ' . $literal);
            $conn->statement('GRANT ALL PRIVILEGES ON DATABASE ' . self::quoteIdentPg($database) . ' TO ' . self::quoteIdentPg($username));
        } else {
            $conn->statement('CREATE USER ' . self::quoteIdentMy($username) . "@'localhost' IDENTIFIED BY " . $literal);
            $conn->statement('GRANT ALL PRIVILEGES ON ' . self::quoteIdentMy($database) . '.* TO ' . self::quoteIdentMy($username) . "@'localhost'");
            $conn->statement('FLUSH PRIVILEGES');
        }

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

        if (!in_array($driver, ['pgsql', 'mysql', 'mariadb'], true)) {
            throw new \RuntimeException('SQLite databases are file-based and have no accounts.');
        }
        self::assertAccountName($username);
        if ($username === self::superuser($connection, $driver)) {
            throw new \RuntimeException('Refusing to drop the account Laravel itself connects as.');
        }

        $conn = DB::connection($connection);
        $database = (string) config("database.connections.{$connection}.database");
        if ($driver === 'pgsql') {
            // The createUser() database-level GRANT is a dependency that blocks
            // DROP ROLE ("dependent objects still exist") — revoke it first.
            // Objects the role OWNS still block the drop on purpose (the
            // operator must reassign/drop them consciously).
            $conn->statement('REVOKE ALL PRIVILEGES ON DATABASE ' . self::quoteIdentPg($database) . ' FROM ' . self::quoteIdentPg($username));
            $conn->statement('DROP ROLE ' . self::quoteIdentPg($username));
        } else {
            $conn->statement('DROP USER ' . self::quoteIdentMy($username) . "@'localhost'");
            $conn->statement('FLUSH PRIVILEGES');
        }

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

    private static function superuser(string $connection, string $driver): string
    {
        $default = $driver === 'pgsql' ? 'postgres' : 'root';

        return (string) config("database.connections.{$connection}.username", $default);
    }

    private static function secretKey(string $driver): ?string
    {
        if ($driver === 'pgsql') {
            return 'POSTGRES_PASSWORD';
        }
        if ($driver === 'mysql' || $driver === 'mariadb') {
            return 'MYSQL_PASSWORD';
        }

        return null;
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

    private static function quoteIdentMy(string $ident): string
    {
        return '`' . str_replace('`', '``', $ident) . '`';
    }

    private static function generatePassword(int $bytes = 24): string
    {
        // URL/SQL-safe, no quote/backslash chars; ~32 chars of entropy.
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/=', 'AaB'), 'B');
    }
}
