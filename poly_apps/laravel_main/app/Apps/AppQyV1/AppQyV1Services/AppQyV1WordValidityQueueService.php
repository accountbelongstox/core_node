<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Services\QueueCenter\DiffIdPageCatalog;
use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Schema;

class AppQyV1WordValidityQueueService
{
    private DiffIdPageCatalog $catalog;
    private QueueCenterRealtimeService $realtime;

    public function __construct(
        ?DiffIdPageCatalog $catalog = null,
        ?QueueCenterRealtimeService $realtime = null
    ) {
        $this->catalog = $catalog ?: new DiffIdPageCatalog();
        $this->realtime = $realtime ?: new QueueCenterRealtimeService();
    }

    public function pendingPage(
        array $languages,
        int $start,
        int $limit,
        string $search = '',
        bool $includeTotal = false
    ): array {
        $languages = $this->normalizeLanguages($languages);
        $start = max(0, $start);
        $segmentLimit = max(
            1,
            (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128)
        );
        $limit = max(1, min($segmentLimit, $limit));
        $search = trim($search);
        $revision = $this->realtime->revision();
        $remainingStart = $start;
        $remainingLimit = $limit;
        $total = 0;
        $words = [];
        $counts = [];

        foreach ($languages as $language) {
            $model = AppQyV1LangDictionaryModel::forLanguage($language);
            if (!Schema::connection($model->getConnectionName())->hasTable($model->getTable())) {
                $counts[$language] = 0;
                continue;
            }

            $query = $this->pendingQuery($model, $search);
            $languageTotal = $includeTotal || count($languages) > 1
                ? (int) (clone $query)->count()
                : null;
            if ($languageTotal !== null) {
                $counts[$language] = $languageTotal;
                $total += $languageTotal;
                if ($remainingStart >= $languageTotal) {
                    $remainingStart -= $languageTotal;
                    continue;
                }
            }

            if ($remainingLimit <= 0) {
                continue;
            }

            $languageRows = $this->materializeLanguagePage(
                $language,
                $model,
                $query,
                $remainingStart,
                $remainingLimit,
                $search,
                $revision
            );
            $words = array_merge($words, $languageRows);
            $remainingLimit = $limit - count($words);
            $remainingStart = 0;
        }

        if (!$includeTotal && count($languages) === 1) {
            $total = count($words);
        }

        return [
            'language' => count($languages) === 1 ? $languages[0] : null,
            'languages' => $languages,
            'count' => count($words),
            'total' => $includeTotal ? $total : null,
            'start' => $start,
            'limit' => $limit,
            'revision' => $revision,
            'by_language' => $includeTotal ? $counts : null,
            'words' => $words,
        ];
    }

    public function notifyChanged(string $language): int
    {
        return $this->realtime->publishBatch('word_validity', strtolower($language));
    }

    private function materializeLanguagePage(
        string $language,
        AppQyV1LangDictionaryModel $model,
        object $query,
        int $start,
        int $limit,
        string $search,
        int $revision
    ): array {
        $page = intdiv($start, $limit) + 1;
        $scope = 'word_validity:view:' . $language . ':' . sha1($search)
            . ':s' . $start . ':l' . $limit . ':r' . $revision;
        $idQuery = (clone $query)
            ->select('id')
            ->orderByDesc('query_count')
            ->orderBy('id')
            ->offset($start)
            ->limit($limit);
        $snapshot = $this->catalog->snapshotPage($scope, $page, $idQuery);
        $ids = $snapshot['ids'];
        $rows = $this->catalog->materialize(
            $scope,
            $snapshot['segment'],
            $ids,
            static function (array $pageIds) use ($model, $language): array {
                $positions = array_flip(array_map('intval', $pageIds));

                return $model->newQuery()
                    ->whereIn('id', $pageIds)
                    ->get(['id', 'content', 'md5', 'query_count', 'has_translation', 'validity_checked_at'])
                    ->sortBy(static fn ($row): int => $positions[(int) $row->id] ?? PHP_INT_MAX)
                    ->map(static fn ($row): array => [
                        'id' => (int) $row->id,
                        'word' => (string) $row->content,
                        'md5' => (string) $row->md5,
                        'language' => $language,
                        'query_count' => (int) ($row->query_count ?? 0),
                        'needs_validity' => $row->validity_checked_at === null,
                        'needs_translation' => !(bool) $row->has_translation,
                    ])
                    ->values()
                    ->all();
            }
        );
        $this->catalog->compactSegment($scope, $snapshot['segment'], $ids);

        return $rows;
    }

    private function pendingQuery(AppQyV1LangDictionaryModel $model, string $search): object
    {
        $query = $model->newQuery()
            ->where(function ($builder) {
                $builder->whereNull('validity_checked_at')
                    ->orWhere(function ($untranslated) {
                        $untranslated->where('has_translation', false)
                            ->where('is_valid', true);
                    });
            });

        if ($search !== '') {
            $query->where('content', 'like', '%' . $search . '%');
        }

        return $query;
    }

    private function normalizeLanguages(array $languages): array
    {
        $normalized = [];

        foreach ($languages as $language) {
            $code = strtolower(trim((string) $language));
            if ($code !== '' && preg_match('/^[a-z]{2,3}(?:-[a-z]{2,})?$/', $code) === 1) {
                $normalized[$code] = true;
            }
        }

        return $normalized === [] ? ['en'] : array_slice(array_keys($normalized), 0, 32);
    }
}
