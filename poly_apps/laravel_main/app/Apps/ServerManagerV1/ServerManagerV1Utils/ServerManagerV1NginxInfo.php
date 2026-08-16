<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

/**
 * Shared nginx host capability probing: binary detection, version,
 * OpenSSL build version and HTTP/3 module availability. Mirrors the shell
 * helpers in scripts/shells/linux/common/nginx_common.sh so PHP and the
 * installers reason about the same facts.
 */
class ServerManagerV1NginxInfo
{
    /**
     * Minimum nginx version required by the platform (HTTP/3 era builds).
     */
    public const MINIMUM_VERSION = '1.30.0';

    /**
     * Cached nginx binary detection result. Only positive results are
     * cached so a worker booted before nginx was installed picks up a
     * fresh install on its next request without octane:reload.
     */
    private static bool $binaryResolved = false;
    private static ?string $binary = null;

    /**
     * Detect the full path of the nginx binary; null when absent.
     */
    public static function getBinary(): ?string
    {
        if (self::$binaryResolved) {
            return self::$binary;
        }

        $candidates = [
            '/usr/sbin/nginx',
            '/usr/local/sbin/nginx',
            '/usr/local/nginx/sbin/nginx',
            '/usr/bin/nginx',
            '/usr/local/bin/nginx',
        ];

        foreach ($candidates as $candidate) {
            if (is_file($candidate) && is_executable($candidate)) {
                self::$binary = $candidate;
                self::$binaryResolved = true;
                return self::$binary;
            }
        }

        $which = ServerManagerV1Utils::executeCommand('which', ['nginx']);
        if ($which['success']) {
            $path = trim($which['output']);
            if ($path !== '' && is_file($path) && is_executable($path)) {
                self::$binary = $path;
                self::$binaryResolved = true;
                return self::$binary;
            }
        }

        return null;
    }

    /**
     * Reset the static binary cache (after a fresh install).
     */
    public static function resetCache(): void
    {
        self::$binaryResolved = false;
        self::$binary = null;
    }

    /**
     * Get the nginx version ("1.31.3"); null when unavailable.
     */
    public static function getVersion(): ?string
    {
        $binary = self::getBinary();
        if ($binary === null) {
            return null;
        }

        $result = ServerManagerV1Utils::executeCommand($binary, ['-v']);
        $text = trim(($result['output'] ?? '') . "\n" . ($result['error'] ?? ''));
        if (preg_match('#nginx/([0-9][^\s]*)#', $text, $matches)) {
            return $matches[1];
        }

        return null;
    }

    /**
     * Full `nginx -V` banner (configure arguments included).
     */
    public static function getBuildBanner(): ?string
    {
        $binary = self::getBinary();
        if ($binary === null) {
            return null;
        }

        $result = ServerManagerV1Utils::executeCommand($binary, ['-V']);
        $text = trim(($result['output'] ?? '') . "\n" . ($result['error'] ?? ''));

        return $text !== '' ? $text : null;
    }

    /**
     * Whether the binary was built with the HTTP/3 (QUIC) module.
     */
    public static function hasHttp3(): bool
    {
        $banner = self::getBuildBanner();

        return $banner !== null && str_contains($banner, 'http_v3_module');
    }

    /**
     * OpenSSL version the binary was built with ("3.0.13"); null when unknown.
     */
    public static function getOpensslVersion(): ?string
    {
        $banner = self::getBuildBanner();
        if ($banner !== null && preg_match('#built with OpenSSL ([0-9]+\.[0-9]+\.[0-9]+[a-z]*)#', $banner, $matches)) {
            return $matches[1];
        }

        return null;
    }

    /**
     * Whether the build supports QUIC 0-RTT early data (OpenSSL >= 3.5.1).
     */
    public static function quicEarlyDataSupported(): bool
    {
        $openssl = self::getOpensslVersion();
        if ($openssl === null) {
            return false;
        }

        return self::versionGe($openssl, '3.5.1');
    }

    /**
     * Whether the installed nginx meets the platform minimum version.
     */
    public static function meetsMinimum(): bool
    {
        $version = self::getVersion();
        if ($version === null) {
            return false;
        }

        return self::versionGe($version, self::MINIMUM_VERSION);
    }

    /**
     * Dotted version comparison: true when $a >= $b.
     */
    public static function versionGe(string $a, string $b): bool
    {
        $normalize = static function (string $v): array {
            $parts = array_map('intval', explode('.', preg_replace('/[^0-9.].*$/', '', $v)));

            return array_pad($parts, 3, 0);
        };

        $left = $normalize($a);
        $right = $normalize($b);

        for ($i = 0; $i < 3; $i++) {
            if ($left[$i] > $right[$i]) {
                return true;
            }
            if ($left[$i] < $right[$i]) {
                return false;
            }
        }

        return true;
    }
}
