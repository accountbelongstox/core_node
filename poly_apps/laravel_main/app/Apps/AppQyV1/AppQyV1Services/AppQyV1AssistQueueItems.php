<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Services\MoviePoster\MoviePosterStore;
use App\Services\TimerTasks\AppQyV1CoverGenerationTask;
use App\Support\QueueCenterContract;
use App\Models\Model;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

trait AppQyV1AssistQueueItems
{
    /**
     * Paginated drill-down rows for one assist/overview category.
     *
     * GET /api/app_qy_v1/assist/overview/items
     *   ?category=word_audio&status=all|pending|processing|completed|failed|leased&start=0&limit=50
     *
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    public function categoryItems(
        string $category,
        ?string $status,
        int $start,
        int $limit,
        string $search = ''
    ): array
    {
        $category = strtolower(trim($category));
        $search = trim($search);
        if (!in_array($category, QueueCenterContract::categoryKeys(), true)) {
            return [
                'category' => $category,
                'status' => $status,
                'total' => 0,
                'start' => $start,
                'limit' => $limit,
                'items' => [],
            ];
        }

        $limit = max(1, min(500, $limit));
        $start = max(0, $start);

        if ($category === 'word_audio') {
            return $this->categoryItemsFromWordAudio($status, $start, $limit, $search);
        }
        if ($category === 'sentence_audio') {
            return $this->categoryItemsFromSentenceAudio($status, $start, $limit, $search);
        }
        if ($category === 'cover') {
            return $this->categoryItemsFromCovers($status, $start, $limit, $search);
        }
        if ($category === 'gemini_image') {
            return $this->categoryItemsFromGeminiImages($status, $start, $limit, $search);
        }
        if ($category === 'poster') {
            return $this->categoryItemsFromPosters($status, $start, $limit, $search);
        }
        if ($category === 'subtitle_lang') {
            return $this->categoryItemsFromAssistRequests('subtitle', 'add_language', $status, $start, $limit, $search);
        }
        if ($category === 'book_lang') {
            return $this->categoryItemsFromAssistRequests('book', 'add_language', $status, $start, $limit, $search);
        }

        $globalTaskType = QueueCenterContract::globalTaskTypeForCategory($category);
        if ($globalTaskType !== null) {
            return $this->categoryItemsFromGlobalTasks(
                $category,
                $globalTaskType,
                $status,
                $start,
                $limit,
                $search
            );
        }

        return [
            'category' => $category,
            'status' => $status,
            'total' => 0,
            'start' => $start,
            'limit' => $limit,
            'items' => [],
        ];
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromGlobalTasks(
        string $category,
        string $taskType,
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array {
        $statuses = $status !== null && !in_array($status, ['', 'all', 'leased'], true)
            ? $this->mapOverviewStatusToGlobal($status)
            : [];
        $capabilityMode = match ($category) {
            'ai_translate' => 'include_ai_translate',
            'word_translation' => 'exclude_ai_translate',
            default => '',
        };
        $page = GlobalTask::assistQueuePage(
            $taskType,
            $capabilityMode,
            $statuses,
            $status === 'leased',
            $search,
            $start,
            $limit
        );
        $total = (int) $page['total'];
        $rows = $page['rows'];

        $items = [];
        foreach ($rows as $row) {
            $payload = is_array($row->payload) ? $row->payload : [];
            $content = $this->extractPayloadContent($payload);
            $item = [
                'id' => (int) $row->id,
                'task_id' => (string) $row->task_id,
                'category' => $category,
                'task_type' => (string) $row->task_type,
                'status' => $status === 'leased' ? 'leased' : (string) $row->status,
                'queue_position' => (int) ($row->queue_position ?? 0),
                'content_text' => $content,
                'language' => $payload['language'] ?? null,
                'assigned_to' => $row->assigned_to,
                'retry_count' => (int) ($row->retry_count ?? 0),
                'created_at' => $row->created_at !== null ? $row->created_at->toIso8601String() : null,
                'updated_at' => $row->updated_at !== null ? $row->updated_at->toIso8601String() : null,
            ];
            if (!QueueCenterContract::isQueuePositionOrdered($taskType)) {
                $item['priority'] = (int) ($row->priority ?? 0);
            }
            $items[] = $item;
        }

        return [
            'category' => $category,
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /** @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>} */
    private function categoryItemsFromWordAudio(
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array
    {
        return $this->categoryItemsFromGlobalTasks(
            'word_audio',
            'word_audio',
            $status,
            $start,
            $limit,
            $search
        );
    }

    /** @return array<int,string> */
    private function mapOverviewStatusToGlobal(string $status): array
    {
        return match ($status) {
            'pending' => [GlobalTask::status('pending')],
            'processing' => [GlobalTask::status('processing')],
            'completed' => [GlobalTask::status('completed'), GlobalTask::status('completed_demo')],
            'failed' => [GlobalTask::status('failed')],
            default => [],
        };
    }

    /** @param array<string,mixed> $payload */
    private function extractPayloadContent(array $payload): ?string
    {
        $words = $payload['words'] ?? null;
        if (is_array($words) && $words !== []) {
            $first = $words[0];
            if (is_array($first)) {
                $w = $first['word'] ?? $first['content'] ?? null;
                if (is_string($w) && trim($w) !== '') {
                    return trim($w);
                }
            }
            if (is_string($first) && trim($first) !== '') {
                return trim($first);
            }
        }
        foreach (['content', 'text', 'word', 'title'] as $key) {
            $candidate = $payload[$key] ?? null;
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }
        return null;
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromSentenceAudio(
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array
    {
        return $this->categoryItemsFromGlobalTasks(
            'sentence_audio',
            'sentence_audio',
            $status,
            $start,
            $limit,
            $search
        );

    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromCovers(
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array
    {
        $result = AppQyV1VocabularyLibraryModel::coverQueuePage(
            $status,
            $start,
            $limit,
            $search,
            self::LEASE_MINUTES
        );
        $total = $result['total'];
        $rows = $result['rows'];

        $items = [];
        foreach ($rows as $row) {
            $coverStatus = (string) ($row->cover_status ?? 'pending');
            $mapped = in_array($coverStatus, ['pending', 'retry'], true) ? 'pending' : $coverStatus;
            $items[] = [
                'id' => (int) $row->id,
                'category' => 'cover',
                'task_type' => 'cover',
                'status' => $status === 'leased' ? 'leased' : ($mapped === 'ready' ? 'completed' : $mapped),
                'priority' => (int) ($row->cover_priority ?? 0),
                'content_text' => (string) ($row->name ?? ''),
                'language' => $row->language ?? null,
                'assigned_to' => $row->assist_claimed_by,
                'leased_at' => $row->assist_claimed_at !== null ? $row->assist_claimed_at->toIso8601String() : null,
                'retry_count' => 0,
            ];
        }

        return [
            'category' => 'cover',
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /**
     * Gemini image work combines vocabulary-library cover generation with any
     * explicitly enqueued gemini_image global tasks. Both are activated by the
     * same Chrome capability and shown as one operator-facing queue.
     *
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromGeminiImages(
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array
    {
        $window = $start + $limit;
        $covers = $this->categoryItemsFromCovers($status, 0, $window, $search);
        $tasks = $this->categoryItemsFromGlobalTasks(
            'gemini_image',
            'gemini_image',
            $status,
            0,
            $window,
            $search
        );
        $items = array_merge($covers['items'], $tasks['items']);

        usort($items, static function ($a, $b) {
            return ($b['priority'] ?? 0) <=> ($a['priority'] ?? 0);
        });

        foreach ($items as &$item) {
            $item['category'] = 'gemini_image';
        }
        unset($item);

        return [
            'category' => 'gemini_image',
            'status' => $status,
            'total' => (int) $covers['total'] + (int) $tasks['total'],
            'start' => $start,
            'limit' => $limit,
            'items' => array_slice($items, $start, $limit),
        ];
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromPosters(
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array
    {
        if (!self::posterColumnsReady()) {
            return [
                'category' => 'poster',
                'status' => $status,
                'total' => 0,
                'start' => $start,
                'limit' => $limit,
                'items' => [],
            ];
        }

        $allRows = [];
        $total = 0;
        foreach ([['book', Book::class], ['subtitle', Subtitle::class]] as [$mediaType, $modelClass]) {
            $page = $modelClass::posterAssistPage($status, $start, $limit, $search, self::LEASE_MINUTES);
            $total += (int) $page['total'];
            foreach ($page['rows'] as $row) {
                $title = trim((string) $row->getAttribute('title'));
                if ($title === '') {
                    $title = trim((string) $row->getAttribute('original_name'));
                }
                $posterStatus = (string) ($row->poster_status ?? 'pending');
                $allRows[] = [
                    'id' => (int) $row->id,
                    'category' => 'poster',
                    'task_type' => 'poster',
                    'media_type' => $mediaType,
                    'status' => $status === 'leased' ? 'leased' : ($posterStatus === 'ready' ? 'completed' : $posterStatus),
                    'priority' => 0,
                    'content_text' => $title !== '' ? $title : "#{$row->id}",
                    'language' => null,
                    'assigned_to' => $row->assist_claimed_by ?? null,
                    'leased_at' => $row->assist_claimed_at !== null ? $row->assist_claimed_at->toIso8601String() : null,
                    'retry_count' => 0,
                ];
            }
        }

        $items = array_slice($allRows, $start, $limit);

        return [
            'category' => 'poster',
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromAssistRequests(
        string $recordType,
        string $requestType,
        ?string $status,
        int $start,
        int $limit,
        string $search
    ): array
    {
        $category = $recordType === 'subtitle' ? 'subtitle_lang' : 'book_lang';
        if (!self::assistRequestsTableReady()) {
            return [
                'category' => $category,
                'status' => $status,
                'total' => 0,
                'start' => $start,
                'limit' => $limit,
                'items' => [],
            ];
        }

        $result = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1AssistRequestModel::queuePage(
            $recordType,
            $requestType,
            $status,
            $start,
            $limit,
            $search
        );
        $total = $result['total'];
        $rows = $result['rows'];

        $items = [];
        foreach ($rows as $row) {
            $isLeased = $row->claimed_at !== null
                && $row->claimed_at >= now()->subMinutes(\App\Apps\AppQyV1\AppQyV1Models\AppQyV1AssistRequestModel::LEASE_MINUTES);
            $items[] = [
                'id' => (int) $row->id,
                'category' => $category,
                'task_type' => $requestType,
                'status' => $status === 'leased' || $isLeased ? 'leased' : (string) $row->status,
                'priority' => (int) ($row->priority ?? 0),
                'content_text' => "{$recordType}#{$row->record_id}",
                'language' => $row->language ?? null,
                'assigned_to' => $row->claimed_by ?? null,
                'leased_at' => $row->claimed_at !== null ? $row->claimed_at->toIso8601String() : null,
                'retry_count' => 0,
                'created_at' => $row->created_at !== null ? $row->created_at->toIso8601String() : null,
            ];
        }

        return [
            'category' => $category,
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }
}
