<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserDailyReadingReadModel as AppQyV1DailyRead;

class AppQyV1DailyReadingFeedService
{
    public const MAX_CALENDAR_DAYS = 90;
    public const MAX_BATCH = 200;

    public function __construct(
        private readonly AppQyV1ArticleManagementService $articleManagementService,
    ) {
    }

    /**
     * Cursor page of daily-reading articles for one day with the caller's
     * read state; read is false for every row when no user is given.
     */
    public function feed(?int $userId, ?string $date, ?int $cursorId, int $limit): array
    {
        $limit = max(1, min($limit, 50));
        $page = AppQyV1Article::dailyFeedPage($date, $cursorId, $limit);
        $items = [];
        $ids = [];
        $readAt = [];

        foreach ($page['rows'] as $row) {
            $items[] = $this->articleManagementService->mapArticle($row);
            $ids[] = (string) $row->article_id;
        }
        if ($userId !== null) {
            $readAt = AppQyV1DailyRead::readAtMap($userId, $ids);
        }
        foreach ($items as $index => $item) {
            $articleId = (string) $item['article_id'];
            $items[$index]['read'] = array_key_exists($articleId, $readAt);
            $items[$index]['read_at'] = $readAt[$articleId] ?? null;
        }

        return [
            'items' => $items,
            'date' => $date,
            'total' => $page['total'],
            'has_more' => $page['has_more'],
            'next_cursor' => $page['next_cursor'],
            'limit' => $limit,
        ];
    }

    /**
     * Per-day article and read counts for an inclusive day range.
     */
    public function calendar(?int $userId, string $from, string $to): array
    {
        $pairs = AppQyV1Article::dailyDayRows($from, $to);
        $days = [];
        $readAt = [];
        $ids = [];

        foreach ($pairs as $pair) {
            $ids[] = $pair['article_id'];
        }
        if ($userId !== null) {
            $readAt = AppQyV1DailyRead::readAtMap($userId, $ids);
        }
        foreach ($pairs as $pair) {
            $day = $pair['day'];
            $days[$day] ??= ['date' => $day, 'total' => 0, 'read' => 0];
            $days[$day]['total']++;
            if (array_key_exists($pair['article_id'], $readAt)) {
                $days[$day]['read']++;
            }
        }
        ksort($days);

        return [
            'from' => $from,
            'to' => $to,
            'days' => array_values($days),
            'latest_date' => AppQyV1Article::dailyLatestDay(),
        ];
    }

    /**
     * Mark daily-reading articles read or unread for a user. Ids resolve to
     * their canonical article; unknown ids are reported back, never stored.
     *
     * @param  array<int,string>  $articleIds
     */
    public function setRead(int $userId, array $articleIds, bool $read): array
    {
        $canonicalIds = [];
        $unknown = [];
        $readAt = [];

        foreach (array_slice(array_values(array_unique($articleIds)), 0, self::MAX_BATCH) as $articleId) {
            $article = AppQyV1Article::findByArticleId((string) $articleId);
            if ($article === null) {
                $unknown[] = (string) $articleId;
                continue;
            }
            $canonicalIds[(string) $articleId] = (string) AppQyV1Article::resolveCanonicalArticle($article)->article_id;
        }
        $storedIds = array_values(array_unique($canonicalIds));
        if ($read) {
            AppQyV1DailyRead::markRead($userId, $storedIds);
        } else {
            AppQyV1DailyRead::markUnread($userId, $storedIds);
        }
        $readAt = AppQyV1DailyRead::readAtMap($userId, $storedIds);

        $states = [];
        foreach ($canonicalIds as $requestedId => $canonicalId) {
            $states[] = [
                'article_id' => $requestedId,
                'canonical_article_id' => $canonicalId,
                'read' => array_key_exists($canonicalId, $readAt),
                'read_at' => $readAt[$canonicalId] ?? null,
            ];
        }

        return ['states' => $states, 'unknown' => $unknown];
    }
}
