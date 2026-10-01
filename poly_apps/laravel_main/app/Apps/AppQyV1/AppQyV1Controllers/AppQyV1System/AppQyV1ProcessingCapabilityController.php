<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System;

use App\Http\Controllers\Controller;
use App\Providers\PathMapper;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Laravel-host processing-capability probe (dashboard).
 *
 * GET /api/app_qy_v1/system/processing-capability
 *
 * Reports THIS host's load (CPU, memory, disk) and a per-task recommendation.
 * Light document parsing runs in PHP here; video extraction and transcription
 * are always pycore tasks (LARAVEL_GUIDE §1 pycore boundary: Laravel never
 * runs ffmpeg, GPU or other heavy tools, so it does not probe them either).
 *
 * Everything is guarded + degrades to null on unsupported platforms (Windows
 * sys_getloadavg, etc.). NO try-catch; NO ?? / ||.
 */
class AppQyV1ProcessingCapabilityController extends Controller
{
    use ApiResponse;

    /** Load ratio (load1 / cpu_count) above which we consider the host "busy". */
    private const BUSY_LOAD_RATIO = 1.5;

    public function show(): JsonResponse
    {
        $cpu = $this->probeCpu();
        $memory = $this->probeMemory();
        $disk = $this->probeDisk();

        $busy = false;
        if ($cpu['load_ratio'] !== null && $cpu['load_ratio'] > self::BUSY_LOAD_RATIO) {
            $busy = true;
        }
        // ---- recommendations -------------------------------------------------
        // Documents: PHP-native (DocumentTextExtractor) — always local.
        $docReason = 'Document parsing is light; handled by PHP on this host.';
        if ($busy) {
            $docReason = 'Host is under load but document parsing is still cheap; local is fine.';
        }
        $documentRec = [
            'can_local' => true,
            'suggested' => 'local',
            'reason' => $docReason,
        ];

        $videoRec = [
            'can_local' => false,
            'suggested' => 'pycore',
            'reason' => __('app_qy_v1.messages.processing_video_pycore'),
        ];

        return $this->success([
            'host' => gethostname(),
            'os' => PHP_OS_FAMILY,
            'busy' => $busy,
            'cpu' => $cpu,
            'memory' => $memory,
            'disk' => $disk,
            'recommendations' => [
                'document' => $documentRec,
                'video' => $videoRec,
            ],
            'probed_at' => date('c'),
        ], __('app_qy_v1.messages.processing_capability_probed'));
    }

    // ----- probes ---------------------------------------------------------- #
    private function probeCpu(): array
    {
        $count = null;
        $load1 = null;
        $load5 = null;
        $load15 = null;

        // CPU core count (Linux /proc/cpuinfo; else null).
        if (is_readable('/proc/cpuinfo')) {
            $info = file_get_contents('/proc/cpuinfo');
            if ($info !== false) {
                $count = substr_count($info, "\nprocessor");
                if ($count < 1) {
                    $count = 1;
                }
            }
        }

        if (function_exists('sys_getloadavg')) {
            $avg = sys_getloadavg();
            if (is_array($avg) && count($avg) >= 3) {
                $load1 = round((float) $avg[0], 2);
                $load5 = round((float) $avg[1], 2);
                $load15 = round((float) $avg[2], 2);
            }
        }

        $loadRatio = null;
        if ($load1 !== null && $count !== null && $count > 0) {
            $loadRatio = round($load1 / $count, 2);
        }

        return [
            'count' => $count,
            'load1' => $load1,
            'load5' => $load5,
            'load15' => $load15,
            'load_ratio' => $loadRatio,
        ];
    }

    private function probeMemory(): array
    {
        $totalMb = null;
        $availableMb = null;
        $usedPercent = null;

        if (is_readable('/proc/meminfo')) {
            $info = file_get_contents('/proc/meminfo');
            if ($info !== false) {
                $total = $this->meminfoValueKb($info, 'MemTotal');
                $available = $this->meminfoValueKb($info, 'MemAvailable');
                if ($total !== null) {
                    $totalMb = (int) round($total / 1024);
                }
                if ($available !== null) {
                    $availableMb = (int) round($available / 1024);
                }
                if ($total !== null && $available !== null && $total > 0) {
                    $usedPercent = (int) round((($total - $available) / $total) * 100);
                }
            }
        }

        return [
            'total_mb' => $totalMb,
            'available_mb' => $availableMb,
            'used_percent' => $usedPercent,
        ];
    }

    private function meminfoValueKb(string $info, string $key): ?int
    {
        $matches = [];
        if (preg_match('/^' . preg_quote($key, '/') . ':\s+(\d+)\s+kB/mi', $info, $matches) === 1) {
            return (int) $matches[1];
        }
        return null;
    }

    private function probeDisk(): array
    {
        $path = PathMapper::getCoreNodeDataDir('appqyv1');
        $freeGb = null;
        $totalGb = null;

        $free = @disk_free_space($path);
        $total = @disk_total_space($path);
        if ($free !== false) {
            $freeGb = round($free / 1073741824, 1);
        }
        if ($total !== false) {
            $totalGb = round($total / 1073741824, 1);
        }

        return [
            'path' => $path,
            'free_gb' => $freeGb,
            'total_gb' => $totalGb,
        ];
    }
}
