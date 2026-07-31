<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Models\Book;
use App\Models\Subtitle;

class AppQyV1PosterPriorityService
{
    public function promote(array $items): int
    {
        $grouped = ['book' => [], 'subtitle' => []];
        foreach ($items as $item) {
            $mediaType = (string) ($item['media_type'] ?? '');
            $id = (int) ($item['id'] ?? 0);
            if (isset($grouped[$mediaType]) && $id > 0) {
                $grouped[$mediaType][] = $id;
            }
        }

        $promoted = 0;
        $promoted += $this->promoteModel(Book::class, $grouped['book']);
        $promoted += $this->promoteModel(Subtitle::class, $grouped['subtitle']);
        return $promoted;
    }

    private function promoteModel(string $modelClass, array $ids): int
    {
        $uniqueIds = array_values(array_unique(array_map('intval', $ids)));
        $model = new $modelClass();
        $updates = [
            'poster_status' => 'pending',
            'poster_fetched_at' => null,
            'assist_claimed_by' => null,
            'assist_claimed_at' => null,
        ];

        if (empty($uniqueIds)) {
            return 0;
        }
        if ($model->getConnection()->getSchemaBuilder()->hasColumn($model->getTable(), 'poster_mcp_submitted_at')) {
            $updates['poster_mcp_submitted_at'] = null;
        }

        return $modelClass::query()->whereIn('id', $uniqueIds)->update($updates);
    }
}
