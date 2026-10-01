<?php

namespace App\Support;

/**
 * Builds the contract `progress_template` ({total, done, failed, pending,
 * cursor, updated_at}, optional languages) for every queue and lane.
 */
final class QueueProgress
{
    /**
     * @param array<string, array{done: int, failed: int, pending: int}> $languages
     * @return array{total: int, done: int, failed: int, pending: int, cursor: ?int, updated_at: string, languages?: array}
     */
    public static function make(int $done, int $failed, int $pending, ?int $cursor = null, array $languages = []): array
    {
        $progress = self::counts($done, $failed, $pending) + [
            'cursor' => $cursor,
            'updated_at' => now()->toIso8601String(),
        ];

        if ($languages !== []) {
            $progress['languages'] = array_map(
                static fn (array $row): array => self::counts((int) $row['done'], (int) $row['failed'], (int) $row['pending']),
                $languages
            );
        }

        return $progress;
    }

    /** @return array{total: int, done: int, failed: int, pending: int} */
    private static function counts(int $done, int $failed, int $pending): array
    {
        return [
            'total' => $done + $failed + $pending,
            'done' => $done,
            'failed' => $failed,
            'pending' => $pending,
        ];
    }

    private function __construct()
    {
    }
}
