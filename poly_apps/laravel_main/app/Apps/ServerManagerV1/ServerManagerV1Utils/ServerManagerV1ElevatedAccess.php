<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ServerManagerV1ElevatedAccess
{
    private const CACHE_PREFIX = 'smgr_elevated_';
    private const ATTEMPT_PREFIX = 'smgr_elevated_attempts_';

    public static function checkRateLimit(string $clientIp): bool
    {
        $attempts = (int) Cache::get(self::ATTEMPT_PREFIX . $clientIp, 0);
        return $attempts < ServerManagerV1Constants::ELEVATED_AUTH_MAX_ATTEMPTS;
    }

    public static function recordFailedAttempt(string $clientIp): void
    {
        $key = self::ATTEMPT_PREFIX . $clientIp;
        $attempts = (int) Cache::get($key, 0) + 1;
        Cache::put($key, $attempts, ServerManagerV1Constants::ELEVATED_AUTH_LOCKOUT_SECONDS);
    }

    public static function clearFailedAttempts(string $clientIp): void
    {
        Cache::forget(self::ATTEMPT_PREFIX . $clientIp);
    }

    public static function authenticate(string $password, string $clientIp): array
    {
        if (!self::checkRateLimit($clientIp)) {
            return [
                'success' => false,
                'error' => 'Too many failed authentication attempts. Try again later.',
                'code' => 429,
            ];
        }

        if ($password === '') {
            self::recordFailedAttempt($clientIp);
            return [
                'success' => false,
                'error' => 'Password is required.',
                'code' => 400,
            ];
        }

        $verified = self::verifyRootPassword($password);
        if (!$verified) {
            self::recordFailedAttempt($clientIp);
            Log::warning('ServerManagerV1: Elevated auth failed', [
                'ip' => $clientIp,
            ]);
            return [
                'success' => false,
                'error' => 'Invalid root password.',
                'code' => 403,
            ];
        }

        self::clearFailedAttempts($clientIp);
        $token = self::issueToken($password, $clientIp);

        return [
            'success' => true,
            'token' => $token,
            'expires_in' => ServerManagerV1Constants::ELEVATED_TOKEN_TTL,
        ];
    }

    public static function validateToken(?string $token, string $clientIp): bool
    {
        if (!$token) {
            return false;
        }

        $entry = Cache::get(self::CACHE_PREFIX . $token);
        if (!is_array($entry)) {
            return false;
        }

        if (($entry['ip'] ?? '') !== $clientIp) {
            return false;
        }

        return isset($entry['password']);
    }

    public static function revokeToken(?string $token): void
    {
        if ($token) {
            Cache::forget(self::CACHE_PREFIX . $token);
        }
    }

    public static function writeFileWithToken(string $filePath, string $content, string $token, string $clientIp): array
    {
        $entry = Cache::get(self::CACHE_PREFIX . $token);
        if (!is_array($entry) || ($entry['ip'] ?? '') !== $clientIp || !isset($entry['password'])) {
            return [
                'success' => false,
                'error' => 'Invalid or expired elevated access token.',
                'code' => 403,
                'needs_elevation' => true,
            ];
        }

        try {
            $password = Crypt::decryptString($entry['password']);
        } catch (\Throwable $e) {
            self::revokeToken($token);
            return [
                'success' => false,
                'error' => 'Elevated access token is invalid.',
                'code' => 403,
                'needs_elevation' => true,
            ];
        }

        $result = self::writeWithSudo($filePath, $content, $password);
        if (!$result['success']) {
            return $result;
        }

        Log::info('ServerManagerV1: Elevated file write', [
            'file_path' => $filePath,
            'ip' => $clientIp,
            'bytes' => strlen($content),
        ]);

        return ['success' => true];
    }

    private static function issueToken(string $password, string $clientIp): string
    {
        $token = hash('sha256', Str::random(40) . microtime(true));
        Cache::put(
            self::CACHE_PREFIX . $token,
            [
                'password' => Crypt::encryptString($password),
                'ip' => $clientIp,
                'issued_at' => now()->toISOString(),
            ],
            ServerManagerV1Constants::ELEVATED_TOKEN_TTL
        );

        return $token;
    }

    private static function verifyRootPassword(string $password): bool
    {
        if (PHP_OS_FAMILY !== 'Linux') {
            return config('app.env') === 'local' || config('app.debug') === true;
        }

        if (!self::commandExists('sudo')) {
            return false;
        }

        $descriptorSpec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open(['sudo', '-S', '-k', '-p', '', 'true'], $descriptorSpec, $pipes);
        if (!is_resource($process)) {
            return false;
        }

        fwrite($pipes[0], $password . "\n");
        fclose($pipes[0]);
        stream_get_contents($pipes[1]);
        stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);
        return $exitCode === 0;
    }

    /**
     * Recursively delete a path via sudo rm -rf (wwwroot is often root-owned).
     * Mirrors writeWithSudo's proc_open + password-stdin pattern. The password is
     * NEVER logged. The caller MUST have already verified the path is safe to
     * purge (inside wwwroot, NOT the core_node tree) and gated behind a confirmed
     * destructive action.
     */
    public static function deletePathWithSudo(string $path, string $password): array
    {
        if ($path === '' || $path === '/') {
            return ['success' => false, 'error' => 'Refused: empty or root path.', 'code' => 400];
        }

        if (PHP_OS_FAMILY !== 'Linux') {
            // Windows dev: best-effort native delete (permissions usually per-user).
            $ok = self::nativeRmdir($path);
            return ['success' => $ok, 'error' => $ok ? '' : 'Failed to delete path.', 'code' => $ok ? 200 : 500];
        }

        if (!self::commandExists('sudo') || !self::commandExists('rm')) {
            return ['success' => false, 'error' => 'sudo/rm is not available on this host.', 'code' => 501];
        }

        $descriptorSpec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        // -- separates flags from the path; -- ensures the path is treated as a
        // path even if it begins with a dash. rm -rf is destructive by design.
        $process = proc_open(['sudo', '-S', '-k', '-p', '', 'rm', '-rf', '--', $path], $descriptorSpec, $pipes);
        if (!is_resource($process)) {
            return ['success' => false, 'error' => 'Failed to start elevated delete process.', 'code' => 500];
        }

        fwrite($pipes[0], $password . "\n");
        fclose($pipes[0]);
        stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);
        if ($exitCode !== 0) {
            return ['success' => false, 'error' => trim($stderr) ?: "rm exited with code $exitCode", 'code' => 500];
        }

        return ['success' => true, 'error' => '', 'code' => 200];
    }

    /** Native recursive rmdir/unlink fallback (non-Linux hosts). */
    private static function nativeRmdir(string $path): bool
    {
        if (is_link($path) || is_file($path)) {
            return @unlink($path);
        }
        if (!is_dir($path)) {
            return true;
        }
        $entries = @scandir($path);
        if ($entries === false) {
            return false;
        }
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $full = $path . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($full) && !is_link($full)) {
                self::nativeRmdir($full);
            } else {
                @unlink($full);
            }
        }
        return @rmdir($path);
    }

    private static function writeWithSudo(string $filePath, string $content, string $password): array
    {
        if (PHP_OS_FAMILY !== 'Linux') {
            if (config('app.env') === 'local' || config('app.debug') === true) {
                $written = @file_put_contents($filePath, $content);
                return [
                    'success' => $written !== false,
                    'error' => $written === false ? 'Failed to write file.' : '',
                    'code' => $written === false ? 500 : 200,
                ];
            }

            return [
                'success' => false,
                'error' => 'Elevated write is only available on Linux hosts.',
                'code' => 501,
            ];
        }

        if (!self::commandExists('sudo') || !self::commandExists('tee')) {
            return [
                'success' => false,
                'error' => 'sudo/tee is not available on this host.',
                'code' => 501,
            ];
        }

        $descriptorSpec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open(['sudo', '-S', '-k', '-p', '', 'tee', $filePath], $descriptorSpec, $pipes);
        if (!is_resource($process)) {
            return [
                'success' => false,
                'error' => 'Failed to start elevated write process.',
                'code' => 500,
            ];
        }

        fwrite($pipes[0], $password . "\n");
        fwrite($pipes[0], $content);
        fclose($pipes[0]);
        stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);
        if ($exitCode !== 0) {
            return [
                'success' => false,
                'error' => trim($stderr) ?: 'Elevated write failed.',
                'code' => 500,
            ];
        }

        return ['success' => true];
    }

    private static function commandExists(string $command): bool
    {
        $which = PHP_OS_FAMILY === 'Windows' ? 'where' : 'command -v';
        $result = ServerManagerV1Utils::executeCommand($which, [$command], 5);
        return $result['success'] && trim($result['output']) !== '';
    }
}
