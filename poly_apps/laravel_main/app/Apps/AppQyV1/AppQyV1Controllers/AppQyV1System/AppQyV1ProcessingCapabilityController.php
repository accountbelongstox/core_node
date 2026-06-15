<?php
// ### AI SPECIAL ATTENTION RULES START ###
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// ### AI SPECIAL ATTENTION RULES END ###

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
 * Reports THIS host's load + hardware (CPU load, memory, disk, ffmpeg, GPU via
 * nvidia-smi) and a per-task RECOMMENDATION of whether laravel can process
 * directly. Laravel is the FALLBACK: light document work always runs locally;
 * heavy video work (ffmpeg + transcription) is recommended to pycore (the GPU
 * host) when this host lacks ffmpeg/GPU or is under load — but the UI may still
 * choose local. Probe is laravel-host-only (no pycore dependency).
 *
 * Everything is guarded + degrades to null on unsupported platforms (Windows
 * sys_getloadavg, disabled shell_exec, etc.). NO try-catch; NO ?? / ||.
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
        $ffmpeg = $this->probeFfmpeg();
        $gpu = $this->probeGpu();

        $busy = false;
        if ($cpu['load_ratio'] !== null && $cpu['load_ratio'] > self::BUSY_LOAD_RATIO) {
            $busy = true;
        }
        $lowMemory = false;
        if ($memory['used_percent'] !== null && $memory['used_percent'] > 90) {
            $lowMemory = true;
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

        // Video: needs ffmpeg + (GPU or enough CPU) + not busy. Else -> pycore.
        $hasCpuFloor = false;
        if ($cpu['count'] !== null && $cpu['count'] >= 4) {
            $hasCpuFloor = true;
        }
        $videoCanLocal = false;
        if ($ffmpeg['available'] === true && ($gpu['available'] === true || $hasCpuFloor)) {
            $videoCanLocal = true;
        }
        $videoSuggested = 'pycore';
        $videoReason = 'Recommend pycore: ';
        if ($ffmpeg['available'] !== true) {
            $videoReason .= 'ffmpeg not found on this host.';
        } elseif ($gpu['available'] !== true && !$hasCpuFloor) {
            $videoReason .= 'no GPU and limited CPU for transcription.';
        } elseif ($busy || $lowMemory) {
            $videoReason .= 'host is currently under load.';
        } else {
            $videoSuggested = 'local';
            $videoReason = 'This host can extract video directly';
            if ($gpu['available'] === true) {
                $videoReason .= ' (GPU available)';
            }
            $videoReason .= '.';
        }
        $videoRec = [
            'can_local' => $videoCanLocal,
            'suggested' => $videoSuggested,
            'reason' => $videoReason,
        ];

        return $this->success([
            'host' => gethostname(),
            'os' => PHP_OS_FAMILY,
            'busy' => $busy,
            'cpu' => $cpu,
            'memory' => $memory,
            'disk' => $disk,
            'ffmpeg' => $ffmpeg,
            'gpu' => $gpu,
            'recommendations' => [
                'document' => $documentRec,
                'video' => $videoRec,
            ],
            'probed_at' => date('c'),
        ], 'Processing capability probed');
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

    private function probeFfmpeg(): array
    {
        $available = false;
        $version = null;

        if (function_exists('shell_exec')) {
            $out = @shell_exec('ffmpeg -version 2>&1');
            if (is_string($out) && stripos($out, 'ffmpeg version') !== false) {
                $available = true;
                $matches = [];
                if (preg_match('/ffmpeg version (\S+)/i', $out, $matches) === 1) {
                    $version = $matches[1];
                }
            }
        }

        return [
            'available' => $available,
            'version' => $version,
        ];
    }

    private function probeGpu(): array
    {
        $available = false;
        $name = null;
        $memoryTotalMb = null;
        $memoryUsedMb = null;
        $utilization = null;

        if (function_exists('shell_exec')) {
            $cmd = 'nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits 2>&1';
            $out = @shell_exec($cmd);
            if (is_string($out) && trim($out) !== '' && stripos($out, 'not found') === false && stripos($out, 'failed') === false) {
                $line = trim(strtok($out, "\n"));
                $parts = array_map('trim', explode(',', $line));
                if (count($parts) >= 4 && $parts[0] !== '') {
                    $available = true;
                    $name = $parts[0];
                    if (is_numeric($parts[1])) {
                        $memoryTotalMb = (int) $parts[1];
                    }
                    if (is_numeric($parts[2])) {
                        $memoryUsedMb = (int) $parts[2];
                    }
                    if (is_numeric($parts[3])) {
                        $utilization = (int) $parts[3];
                    }
                }
            }
        }

        return [
            'available' => $available,
            'name' => $name,
            'memory_total_mb' => $memoryTotalMb,
            'memory_used_mb' => $memoryUsedMb,
            'utilization' => $utilization,
        ];
    }
}
