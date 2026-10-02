<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;

/**
 * The one cap for light local work (LARAVEL_GUIDE §1 "Light local work"):
 * every such job may use at most CPU_PERCENT of the machine's CPU and
 * MEMORY_PERCENT of its RAM.
 *
 * - Spawned tools (pdftk, ghostscript, 7z, tar): command() wraps the shell
 *   command in a transient systemd scope (CPUQuota + MemoryMax). Without
 *   systemd-run it falls back to prlimit (address space) + nice/ionice +
 *   cpulimit. The CPU share keeps background work from hogging the box; a
 *   synchronous run inside an HTTP request (a user is waiting on a worker)
 *   drops the CPU quota but keeps the memory cap and a stall guard (timeout,
 *   REQUEST_STALL_SECONDS). Windows has no equivalent reachable from PHP, so
 *   endpoints that spawn tools are linux-only there (supportsSpawnCap() false
 *   -> platform_unsupported).
 * - In-process work (GD thumbnails): imageFits() rejects an image whose
 *   decoded bitmap would exceed the memory share before it is decoded; GD
 *   work on a bounded bitmap is short, so no CPU throttle applies.
 */
final class ResourceLimiter
{
    public const CPU_PERCENT = 5;
    public const MEMORY_PERCENT = 5;
    public const ERROR_PLATFORM_UNSUPPORTED = 'platform_unsupported';

    /** Bytes GD keeps per truecolor pixel, plus working headroom. */
    private const GD_BYTES_PER_PIXEL = 5;
    private const PROBE_CACHE_SECONDS = 86400;
    private const PROBE_CACHE_PREFIX = 'resource_limiter:';
    private const MEMINFO = '/proc/meminfo';
    private const CPUINFO = '/proc/cpuinfo';
    private const KIB = 1024;
    private const REQUEST_STALL_SECONDS = 300;
    private const STALL_KILL_GRACE_SECONDS = 5;

    /** Whether spawned tools can be capped on this OS. */
    public static function supportsSpawnCap(): bool
    {
        return PHP_OS_FAMILY === 'Linux';
    }

    /** $command (one shell command line) wrapped so it runs under the cap. */
    public static function command(string $command): string
    {
        $background = app()->runningInConsole();
        $cpuQuota = self::CPU_PERCENT * self::cpuCount();
        $memory = self::memoryBudgetBytes();
        $shell = 'sh -c '.escapeshellarg($command);

        if (!$background && self::toolAvailable('timeout')) {
            $shell = sprintf('timeout -k %d %d %s', self::STALL_KILL_GRACE_SECONDS, self::REQUEST_STALL_SECONDS, $shell);
        }
        if (self::toolAvailable('systemd-run')) {
            return sprintf(
                'systemd-run --quiet --scope --collect %s-p MemoryMax=%d -- %s',
                $background ? sprintf('-p CPUQuota=%d%% ', $cpuQuota) : '',
                $memory,
                $shell
            );
        }

        return trim(implode(' ', array_filter([
            self::toolAvailable('prlimit') ? sprintf('prlimit --as=%d --', $memory) : null,
            $background ? 'nice -n 19' : null,
            $background && self::toolAvailable('ionice') ? 'ionice -c3' : null,
            $background && self::toolAvailable('cpulimit') ? sprintf('cpulimit -f -l %d --', $cpuQuota) : null,
            $shell,
        ])));
    }

    /** Whether a width x height image may be decoded in-process under the memory share. */
    public static function imageFits(int $width, int $height): bool
    {
        return $width > 0 && $height > 0 && $width * $height * self::GD_BYTES_PER_PIXEL <= self::memoryBudgetBytes();
    }

    /** MEMORY_PERCENT of physical RAM (Linux), else of PHP's memory_limit. */
    public static function memoryBudgetBytes(): int
    {
        return (int) (self::totalMemoryBytes() * self::MEMORY_PERCENT / 100);
    }

    private static function totalMemoryBytes(): int
    {
        $meminfo = is_readable(self::MEMINFO) ? (string) file_get_contents(self::MEMINFO) : '';
        $match = [];
        $limit = '';

        if (preg_match('/^MemTotal:\s+(\d+)\s+kB/m', $meminfo, $match) === 1) {
            return (int) $match[1] * self::KIB;
        }
        $limit = (string) ini_get('memory_limit');

        return $limit === '-1' ? PHP_INT_MAX / 100 : (int) ini_parse_quantity($limit);
    }

    private static function cpuCount(): int
    {
        $cpuinfo = is_readable(self::CPUINFO) ? (string) file_get_contents(self::CPUINFO) : '';

        return max(1, preg_match_all('/^processor\s*:/m', $cpuinfo));
    }

    private static function toolAvailable(string $tool): bool
    {
        return Cache::remember(
            self::PROBE_CACHE_PREFIX.$tool,
            self::PROBE_CACHE_SECONDS,
            static fn (): bool => Process::run('command -v '.escapeshellarg($tool))->successful()
        );
    }

    private function __construct()
    {
    }
}
