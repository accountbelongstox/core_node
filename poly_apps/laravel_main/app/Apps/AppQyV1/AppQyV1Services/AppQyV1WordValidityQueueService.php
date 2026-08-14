<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Services\QueueCenter\DiffIdPageCatalog;
use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Support\QueueCenterContract;

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
            if (!$model->diffIdTableExists()) {
                $counts[$language] = 0;
                continue;
            }

            $languageTotal = $includeTotal || count($languages) > 1
                ? AppQyV1LangDictionaryModel::pendingValidityCount($language, $search)
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
        int $start,
        int $limit,
        string $search,
        int $revision
    ): array {
        $page = intdiv($start, $limit) + 1;
        $scope = 'word_validity:view:' . $language . ':' . sha1($search)
            . ':s' . $start . ':l' . $limit . ':r' . $revision;
        $ids = AppQyV1LangDictionaryModel::pendingValidityPageIds(
            $language,
            $search,
            $start,
            $limit
        );
        $snapshot = $this->catalog->snapshotIds($scope, $page, $ids);
        $ids = $snapshot['ids'];
        $rows = $this->catalog->materialize(
            $scope,
            $snapshot['segment'],
            $ids,
            static fn (array $pageIds): array => AppQyV1LangDictionaryModel::pendingValidityRows(
                $language,
                $pageIds
            )
        );
        $this->catalog->compactSegment($scope, $snapshot['segment'], $ids);

        return $rows;
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
