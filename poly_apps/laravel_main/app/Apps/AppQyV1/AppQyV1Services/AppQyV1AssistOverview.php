<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Cache;

trait AppQyV1AssistOverview
{
    public const OVERVIEW_SNAPSHOT_KEY = 'appqyv1:assist:overview_snapshot:v2';
    public const OVERVIEW_TTL = 30;
    public const OVERVIEW_STALE_TTL = 300;

    /**
     * Laravel supplies metrics; config/queue_center_contract.json supplies all
     * category, claimant, and handler definitions. Browser clients consume the
     * snapshot directly while pycore workers use their own task interfaces.
     */
    public function overviewSnapshot(bool $fresh = false): array
    {
        $cache = Cache::store('file');
        $build = function (): array {
            $cover = $this->coverCounts();
            $poster = $this->posterCounts();
            $workers = $this->workers();
            $metricsByKey = [
                'word_translation' => $this->wordTranslationCounts(),
                'ai_translate' => $this->aiTranslateCounts(),
                'word_media' => $this->wordImageCounts(),
                'word_audio' => $this->wordAudioCounts(),
                'sentence_audio' => $this->sentenceCounts(),
                'subtitle_search' => $this->subtitleSearchCounts(),
                'subtitle_lang' => $this->assistRequestGroupCounts('subtitle', 'add_language'),
                'book_lang' => $this->assistRequestGroupCounts('book', 'add_language'),
                'cover' => [
                    'pending' => max(
                        0,
                        (int) ($cover['pending'] ?? 0)
                            + (int) ($cover['retry'] ?? 0)
                            - (int) ($cover['leased'] ?? 0)
                    ),
                    'processing' => (int) ($cover['processing'] ?? 0),
                    'leased' => (int) ($cover['leased'] ?? 0),
                    'total' => (int) ($cover['total'] ?? 0),
                    'sample' => $this->coverSample(),
                ],
                'poster' => [
                    'pending' => max(0, (int) ($poster['pending'] ?? 0) - (int) ($poster['leased'] ?? 0)),
                    'processing' => (int) ($poster['processing'] ?? 0),
                    'leased' => (int) ($poster['leased'] ?? 0),
                    'total' => (int) ($poster['total'] ?? 0),
                    'sample' => $this->posterSample(),
                ],
                'notebooklm' => $this->notebookLmCounts(),
                'gemini_image' => $this->geminiImageCounts(),
                'gemini_chat' => $this->geminiChatCounts(),
                'chatgpt_chat' => $this->chatGptCounts(),
            ];
            $generatedAt = now()->toIso8601String();

            return [
                'success' => true,
                'schema_version' => QueueCenterContract::schemaVersion(),
                'generated_at' => $generatedAt,
                'observed_at' => $generatedAt,
                'categories' => QueueCenterContract::normalizeCategories($metricsByKey, $workers),
                'workers' => $workers,
            ];
        };

        if ($fresh) {
            $cache->forget(self::OVERVIEW_SNAPSHOT_KEY);
        }

        return $cache->flexible(
            self::OVERVIEW_SNAPSHOT_KEY,
            [self::OVERVIEW_TTL, self::OVERVIEW_STALE_TTL],
            $build
        );
    }

    /** @return array<int,array{id:int,title:?string}> */
    private function coverSample(): array
    {
        try {
            return AppQyV1VocabularyLibraryModel::query()
                ->whereNotNull('cover_filename')
                ->whereIn('cover_status', ['pending', 'retry', 'processing'])
                ->orderByDesc('cover_priority')
                ->limit(self::OVERVIEW_SAMPLE_LIMIT)
                ->get(['id', 'name'])
                ->map(static fn ($row) => [
                    'id' => (int) $row->id,
                    'title' => $row->name !== null ? (string) $row->name : null,
                ])->all();
        } catch (\Throwable $e) {
            return [];
        }
    }

    /** @return array<int,array{id:int,title:?string}> */
    private function posterSample(): array
    {
        if (!self::posterColumnsReady()) {
            return [];
        }
        $sample = [];
        foreach ([Book::class, Subtitle::class] as $modelClass) {
            if (count($sample) >= self::OVERVIEW_SAMPLE_LIMIT) {
                break;
            }
            try {
                $rows = $modelClass::query()
                    ->whereIn('poster_status', ['pending', 'failed'])
                    ->limit(self::OVERVIEW_SAMPLE_LIMIT - count($sample))
                    ->get(['id', 'title', 'original_name']);
                foreach ($rows as $row) {
                    $title = trim((string) $row->getAttribute('title'));
                    if ($title === '') {
                        $title = trim((string) $row->getAttribute('original_name'));
                    }
                    $sample[] = [
                        'id' => (int) $row->id,
                        'title' => $title !== '' ? $title : null,
                    ];
                }
            } catch (\Throwable $e) {
                continue;
            }
        }
        return $sample;
    }

    public const PENDING_SNAPSHOT_KEY = 'appqyv1:assist:pending_snapshot';
    public const PENDING_SNAPSHOT_TTL = 30;
    public const PENDING_SNAPSHOT_STALE_TTL = 300;

    public function pendingSnapshot(bool $fresh = false): array
    {
        $cache = Cache::store('file');
        $build = function (): array {
            return [
                'generated_at' => now()->toIso8601String(),
                'enabled' => self::isAssistEnabled(),
                'lease_minutes' => self::LEASE_MINUTES,
                'cover' => $this->coverCounts(),
                'tts' => $this->ttsCounts(),
                'translation' => $this->translationCounts(),
                'poster' => $this->posterCounts(),
            ];
        };

        if ($fresh) {
            $cache->forget(self::PENDING_SNAPSHOT_KEY);
        }

        return $cache->flexible(
            self::PENDING_SNAPSHOT_KEY,
            [self::PENDING_SNAPSHOT_TTL, self::PENDING_SNAPSHOT_STALE_TTL],
            $build
        );
    }

    public static function looksLikeImage(string $bytes): bool
    {
        if (strlen($bytes) < 12) {
            return false;
        }

        return str_starts_with($bytes, "\x89PNG\r\n\x1a\n")
            || str_starts_with($bytes, "\xFF\xD8\xFF")
            || (str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP')
            || str_starts_with($bytes, 'GIF87a')
            || str_starts_with($bytes, 'GIF89a');
    }

    private function clearCoverLease(AppQyV1VocabularyLibraryModel $library): void
    {
        if ($library->assist_claimed_at !== null || $library->assist_claimed_by !== null) {
            $library->assist_claimed_at = null;
            $library->assist_claimed_by = null;
            $library->save();
        }
    }
}
