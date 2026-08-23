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
        'total_words',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'words' => 'array',
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

    public function recordReads(array $wordIds): int
    {
        $counts = $this->readCounts();
        $uniqueWordIds = [];
        $changed = 0;

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
        if ($changed > 0) {
            $this->words = $counts;
            $this->total_words = count($counts);
            $this->save();
        }

        return $changed;
    }
}
