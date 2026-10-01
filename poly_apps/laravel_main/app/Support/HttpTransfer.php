<?php

namespace App\Support;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Progress-driven outbound HTTP (config/queue_center_contract.json `http_transfer`),
 * the PHP side of pycore's `http_client` transfer rule: connect is bounded,
 * there is no total deadline, an upload aborts only when no byte moves for
 * `idle_timeout_seconds`, and TCP keepalive detects a dead peer while the
 * response is pending.
 */
final class HttpTransfer
{
    public static function request(): PendingRequest
    {
        $contract = QueueCenterContract::httpTransfer();

        return Http::connectTimeout((int) $contract['connect_timeout_seconds'])
            ->timeout(0)
            ->withOptions([
                'curl' => self::keepaliveOptions($contract),
                'progress' => self::uploadStallGuard((float) $contract['idle_timeout_seconds']),
            ]);
    }

    private static function keepaliveOptions(array $contract): array
    {
        $options = [
            CURLOPT_TCP_KEEPALIVE => 1,
            CURLOPT_TCP_KEEPIDLE => (int) $contract['keepalive_idle_seconds'],
            CURLOPT_TCP_KEEPINTVL => (int) $contract['keepalive_interval_seconds'],
        ];
        // libcurl >= 8.9 only; older builds keep the OS probe count.
        if (defined('CURLOPT_TCP_KEEPCNT')) {
            $options[CURLOPT_TCP_KEEPCNT] = (int) $contract['keepalive_probe_count'];
        }

        return $options;
    }

    /** Guzzle progress callback: true (abort) once an unfinished upload stops moving. */
    private static function uploadStallGuard(float $idleSeconds): callable
    {
        $lastUploaded = -1;
        $lastProgressAt = microtime(true);

        return static function (int $downloadTotal, int $downloaded, int $uploadTotal, int $uploaded) use ($idleSeconds, &$lastUploaded, &$lastProgressAt): bool {
            $now = microtime(true);

            if ($uploaded !== $lastUploaded) {
                $lastUploaded = $uploaded;
                $lastProgressAt = $now;

                return false;
            }

            return $uploadTotal > 0 && $uploaded < $uploadTotal && $now - $lastProgressAt > $idleSeconds;
        };
    }

    private function __construct()
    {
    }
}
