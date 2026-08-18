<?php

namespace App\Services\AiGateway;

class AiUsageRollup
{
    public static function emptyStat(): array
    {
        return [
            'calls' => 0,
            'ok' => 0,
            'failed' => 0,
            'latency_total_ms' => 0.0,
            'latency_count' => 0,
        ];
    }

    public static function increment(array &$stat, array $entry): void
    {
        $resultKey = ($entry['success'] ?? false) ? 'ok' : 'failed';
        $stat['calls'] = (int) ($stat['calls'] ?? 0) + 1;
        $stat[$resultKey] = (int) ($stat[$resultKey] ?? 0) + 1;
        if (is_numeric($entry['latency_ms'] ?? null)) {
            $stat['latency_total_ms'] = (float) ($stat['latency_total_ms'] ?? 0.0) + (float) $entry['latency_ms'];
            $stat['latency_count'] = (int) ($stat['latency_count'] ?? 0) + 1;
        }
    }

    public static function update(array &$rollups, array $entry): void
    {
        $source = trim((string) ($entry['source'] ?? ''));
        if ($source === '') {
            return;
        }
        if (!isset($rollups[$source]) || !is_array($rollups[$source])) {
            $rollups[$source] = self::emptyStat();
        }
        self::increment($rollups[$source], $entry);
        $rollups[$source]['last_ts'] = $entry['ts'] ?? null;
        $rollups[$source]['last_model'] = $entry['model'] ?? '';
        $day = substr((string) ($entry['iso'] ?? ''), 0, 10);
        if ($day === '') {
            return;
        }
        if (!isset($rollups[$source]['days'][$day]) || !is_array($rollups[$source]['days'][$day])) {
            $rollups[$source]['days'][$day] = self::emptyStat();
        }
        self::increment($rollups[$source]['days'][$day], $entry);
    }

    public static function rebuild(array $entries): array
    {
        $rollups = [];
        foreach ($entries as $entry) {
            if (is_array($entry)) {
                self::update($rollups, $entry);
            }
        }
        return $rollups;
    }
}
