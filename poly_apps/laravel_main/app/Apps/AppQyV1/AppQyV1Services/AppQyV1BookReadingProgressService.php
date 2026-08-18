<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserBookReadingProgressModel;

class AppQyV1BookReadingProgressService
{
    private const DAILY_READING_SOURCE_KEY = '__daily_reading__';

    public function getForBook(int $userId, string $sourceKey): ?array
    {
        $row = AppQyV1UserBookReadingProgressModel::findForSource($userId, $sourceKey);

        if (!$row) {
            return null;
        }

        return $this->toPayload($row);
    }

    public function listForUser(int $userId, int $limit = 100): array
    {
        return AppQyV1UserBookReadingProgressModel::forUser($userId, $limit)
            ->map(fn ($row) => $this->toPayload($row))
            ->values()
            ->all();
    }

    public function saveForBook(int $userId, string $sourceKey, array $payload): array
    {
        $row = AppQyV1UserBookReadingProgressModel::findOrNewForSource($userId, $sourceKey);

        if (array_key_exists('chapter_index', $payload)) {
            $row->chapter_index = $payload['chapter_index'];
        }
        if (array_key_exists('verse_seq', $payload)) {
            $row->verse_seq = (int) $payload['verse_seq'];
        }
        if (array_key_exists('grain', $payload)) {
            $row->grain = $payload['grain'] ?? 'sentence';
        }
        if (array_key_exists('page', $payload)) {
            $row->page = max(1, (int) $payload['page']);
        }

        $row->saveRecord();

        return $this->toPayload($row);
    }

    public function getDailyReadingForUser(int $userId): ?array
    {
        $row = AppQyV1UserBookReadingProgressModel::findForSource(
            $userId,
            self::DAILY_READING_SOURCE_KEY
        );

        return $row ? $this->toDailyReadingPayload($row) : null;
    }

    public function saveDailyReadingForUser(int $userId, array $payload): array
    {
        $row = AppQyV1UserBookReadingProgressModel::findOrNewForSource(
            $userId,
            self::DAILY_READING_SOURCE_KEY
        );

        if (array_key_exists('article_id', $payload)) {
            $row->article_id = $payload['article_id'];
        }
        if (array_key_exists('selection_mode', $payload)) {
            $row->selection_mode = $payload['selection_mode'];
        }

        $row->saveRecord();

        return $this->toDailyReadingPayload($row);
    }

    private function toPayload(AppQyV1UserBookReadingProgressModel $row): array
    {
        return [
            'source_key' => $row->source_key,
            'chapter_index' => $row->chapter_index,
            'verse_seq' => (int) ($row->verse_seq ?? 0),
            'grain' => $row->grain ?? 'sentence',
            'page' => (int) ($row->page ?? 1),
            'updated_at' => $row->updated_at?->toIso8601String(),
        ];
    }

    private function toDailyReadingPayload(AppQyV1UserBookReadingProgressModel $row): array
    {
        return [
            'article_id' => $row->article_id,
            'selection_mode' => $row->selection_mode ?? 'latest',
            'updated_at' => $row->updated_at?->toIso8601String(),
        ];
    }
}
