<?php

namespace App\Services;

use App\Providers\PathMapper;

class GeminiRateLimiter
{
    private const LIMITS = [
        'rpm' => 5,
        'tpm' => 250000,
        'rpd' => 100,
    ];

    private string $statsPath;

    public function __construct()
    {
        $this->statsPath = PathMapper::getCachePath() . '/gemini_rate_limit.json';
        PathMapper::ensureDirectoryExists(dirname($this->statsPath));
    }

    public function reserve(int $tokens = 0, int $requests = 1): array
    {
        return $this->withState(function (&$state) use ($tokens, $requests) {
            $now = time();

            if ($now - $state['minute']['start'] >= 60) {
                $state['minute'] = ['start' => $now, 'requests' => 0, 'tokens' => 0];
            }

            $currentDate = date('Y-m-d', $now);
            if ($state['day']['date'] !== $currentDate) {
                $state['day'] = ['date' => $currentDate, 'requests' => 0, 'tokens' => 0];
            }

            if ($state['minute']['requests'] + $requests > self::LIMITS['rpm']
                || $state['minute']['tokens'] + $tokens > self::LIMITS['tpm']) {
                $retry = max(1, $state['minute']['start'] + 60 - $now);
                return [
                    'allowed' => false,
                    'retry_after' => $retry,
                    'reason' => 'minute',
                ];
            }

            if ($state['day']['requests'] + $requests > self::LIMITS['rpd']) {
                $retry = max(1, strtotime('tomorrow', $now) - $now);
                return [
                    'allowed' => false,
                    'retry_after' => $retry,
                    'reason' => 'day',
                ];
            }

            $state['minute']['requests'] += $requests;
            $state['minute']['tokens'] += $tokens;
            $state['day']['requests'] += $requests;
            $state['day']['tokens'] += $tokens;

            return [
                'allowed' => true,
                'retry_after' => 0,
                'reason' => null,
            ];
        });
    }

    private function withState(callable $callback): array
    {
        $handle = fopen($this->statsPath, 'c+');
        if (!$handle) {
            throw new \RuntimeException('Failed to open Gemini rate limit cache.');
        }

        try {
            flock($handle, LOCK_EX);
            $contents = stream_get_contents($handle);
            $state = $contents ? json_decode($contents, true) : $this->defaultState();

            $result = $callback($state);

            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($state));

            return $result;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function defaultState(): array
    {
        return [
            'minute' => [
                'start' => time(),
                'requests' => 0,
                'tokens' => 0,
            ],
            'day' => [
                'date' => date('Y-m-d'),
                'requests' => 0,
                'tokens' => 0,
            ],
        ];
    }
}
