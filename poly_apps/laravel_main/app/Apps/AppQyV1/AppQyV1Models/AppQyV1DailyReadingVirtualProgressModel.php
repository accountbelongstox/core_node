<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

class AppQyV1DailyReadingVirtualProgressModel extends AppQyV1Model
{
    protected ?string $appTableMapKey = 'DAILY_READING_VIRTUAL_PROGRESS';

    protected $fillable = [
        'user_id',
        'batch_name',
        'language_code',
        'words',
        'requests',
        'total_words',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'words' => 'array',
            'requests' => 'array',
            'total_words' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public static function findForBatch(int $userId, string $batchName, string $languageCode): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('batch_name', $batchName)
            ->where('language_code', $languageCode)
            ->first();
    }

    public static function createMissingForBatch(int $userId, string $batchName, string $languageCode): void
    {
        $timestamp = now();

        static::query()->insertOrIgnore([
            'user_id' => $userId,
            'batch_name' => $batchName,
            'language_code' => $languageCode,
            'words' => json_encode([], JSON_THROW_ON_ERROR),
            'requests' => json_encode([], JSON_THROW_ON_ERROR),
            'total_words' => 0,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    public static function lockForBatch(int $userId, string $batchName, string $languageCode): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('batch_name', $batchName)
            ->where('language_code', $languageCode)
            ->lockForUpdate()
            ->first();
    }

    public function readCounts(): array
    {
        $words = $this->words;
        $counts = [];

        if (!is_array($words)) {
            return [];
        }
        foreach ($words as $wordId => $readCount) {
            $normalizedWordId = (int) $wordId;
            $normalizedReadCount = max(0, (int) $readCount);
            if ($normalizedWordId > 0 && $normalizedReadCount > 0) {
                $counts[(string) $normalizedWordId] = $normalizedReadCount;
            }
        }

        return $counts;
    }

    public function requestWordIds(string $requestKey): ?array
    {
        $requests = is_array($this->requests) ? $this->requests : [];
        $request = $requests[$requestKey] ?? null;

        return is_array($request) && is_array($request['word_ids'] ?? null)
            ? array_values(array_map('intval', $request['word_ids']))
            : null;
    }

    public function recordReads(array $wordIds, ?string $requestKey = null): int
    {
        $counts = $this->readCounts();
        $requests = is_array($this->requests) ? $this->requests : [];
        $uniqueWordIds = [];
        $changed = 0;
        $normalizedRequestKey = trim((string) $requestKey);

        if ($normalizedRequestKey !== '' && array_key_exists($normalizedRequestKey, $requests)) {
            return 0;
        }

        foreach ($wordIds as $wordId) {
            $normalizedWordId = (int) $wordId;
            if ($normalizedWordId > 0) {
                $uniqueWordIds[(string) $normalizedWordId] = true;
            }
        }
        foreach (array_keys($uniqueWordIds) as $wordId) {
            $counts[$wordId] = ((int) ($counts[$wordId] ?? 0)) + 1;
            $changed++;
        }
        if ($normalizedRequestKey !== '') {
            $requests[$normalizedRequestKey] = [
                'word_ids' => array_values(array_map('intval', array_keys($uniqueWordIds))),
                'created_at' => now()->toIso8601String(),
            ];
            if (count($requests) > 500) {
                $requests = array_slice($requests, -500, null, true);
            }
        }
        if ($changed > 0 || $normalizedRequestKey !== '') {
            $this->words = $counts;
            $this->requests = $requests;
            $this->total_words = count($counts);
            $this->save();
        }

        return $changed;
    }
}
