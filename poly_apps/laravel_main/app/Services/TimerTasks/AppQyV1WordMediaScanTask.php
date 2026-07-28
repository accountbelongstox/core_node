<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use Illuminate\Support\Facades\Schema;

/**
 * Word Media Auto-Scan (missing-image lane).
 *
 * Background enqueuer for the ONE missing-media state that has no proactive
 * scanner yet: translated words that still lack a sample image. (Missing
 * TRANSLATION is already enqueued by AppQyV1WordTranslationScanTask +
 * AppQyV1DictionaryTranslationTask; missing AUDIO by AppQyV1TTSGenerationTask /
 * the pycore TTS lane. This task deliberately does NOT re-enqueue those, to
 * avoid a third translation enqueuer / duplicate audio work.)
 *
 * It enqueues word_media tasks on the shared image-capability lane. The Chrome
 * media-image worker fills each missing image through web image search.
 * Selection honors the project rules:
 *   - has_translation = true   (缺图片 only under the premise of a translation)
 *   - is_valid = true          (never touch invalid / placeholder words)
 *   - no mcp-chrome submission marker yet, even when a legacy image exists
 *
 * Registered automatically by the auto-discovering OctaneTimerServiceProvider
 * (sys:init wires it in). The mcp-chrome task checkbox controls task claiming;
 * this bounded scanner only keeps the queue populated.
 */
class AppQyV1WordMediaScanTask extends OctaneTimerTaskAbstract
{
    private const PRIORITY_LOW = 0;
    private const TARGET_LANGUAGE = 'zh';
    private const WORDS_PER_TASK = 40;
    private const MAX_TASKS_PER_LANGUAGE = 2;

    private $taskManager;
    // image_status existence is host-dependent; probed lazily per language table.
    private array $imageStatusColumnCache = [];
    private array $imageMcpColumnCache = [];

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
    }

    public function getName(): string
    {
        return 'appqyv1_word_media_scan';
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function isEnabled(): bool
    {
        return env('APPQYV1_MEDIA_SCAN', true);
    }

    public function exec(): void
    {
        $allLanguageStats = AppQyV1DictionaryService::getAllLanguageStatistics();
        if (empty($allLanguageStats)) {
            return;
        }

        $totalCreated = 0;

        foreach ($allLanguageStats as $langCode => $stats) {
            // Don't pile up: skip languages that already have enough pending
            // background word_media tasks.
            $pendingCount = $this->countPendingForLanguage($langCode);
            if ($pendingCount >= self::MAX_TASKS_PER_LANGUAGE) {
                continue;
            }

            $limit = self::WORDS_PER_TASK * (self::MAX_TASKS_PER_LANGUAGE - $pendingCount);
            $words = $this->translatedWordsMissingImages(
                $langCode,
                $limit,
                $this->pendingWordMd5ForLanguage($langCode)
            );

            foreach (array_chunk($words, self::WORDS_PER_TASK) as $chunk) {
                $this->createTask($langCode, $chunk);
                $totalCreated++;
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background mcp-chrome word_media tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    /**
     * Translated, valid words without an mcp-chrome submission marker.
     * Returns [{word,md5}].
     */
    private function translatedWordsMissingImages(string $langCode, int $limit, array $excludedMd5): array
    {
        $hasStatus = $this->hasImageStatusColumn($langCode);
        $hasMcpMarker = $this->hasImageMcpColumn($langCode);
        $out = [];

        $qa = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('has_translation', true)
            ->where('is_valid', true);
        if (!empty($excludedMd5)) {
            $qa->whereNotIn('md5', $excludedMd5);
        }
        if ($hasMcpMarker) {
            $qa->whereNull('image_mcp_submitted_at');
        } else {
            $qa->where(function ($q) {
                $q->whereNull('image_files')
                    ->orWhere('image_files', '')
                    ->orWhere('image_files', '[]')
                    ->orWhere('image_files', '{}');
            });
            if ($hasStatus) {
                $qa->where(function ($q) {
                    $q->whereNull('image_status')
                        ->orWhereNotIn('image_status', ['completed', 'none']);
                });
            }
        }
        foreach ($qa->orderByDesc('query_count')->limit($limit)->get(['content', 'md5']) as $row) {
            $word = $row->content ?? null;
            if (is_string($word) && $word !== '') {
                $out[] = ['word' => $word, 'md5' => $row->md5 ?? md5($word)];
            }
        }

        // Repair mcp-submitted rows whose local file was removed. Clearing the
        // marker makes the row claimable again and lets mcp-chrome replace it.
        if (($hasMcpMarker || $hasStatus) && count($out) < $limit) {
            $media = new AppQyV1WordMediaService();
            $candidateQuery = AppQyV1LangDictionaryModel::forLanguage($langCode)
                ->where('has_translation', true)
                ->where('is_valid', true)
                ->whereNotNull('image_files');
            if (!empty($excludedMd5)) {
                $candidateQuery->whereNotIn('md5', $excludedMd5);
            }
            if ($hasMcpMarker) {
                $candidateQuery->whereNotNull('image_mcp_submitted_at');
            } elseif ($hasStatus) {
                $candidateQuery->where('image_status', 'completed');
            }
            $candidates = $candidateQuery->orderByDesc('query_count')->limit($limit)->get();
            foreach ($candidates as $row) {
                if (count($out) >= $limit) {
                    break;
                }
                if ($media->resolveImageUrl($row) !== null) {
                    continue;
                }
                $word = $row->content ?? null;
                if (!is_string($word) || $word === '') {
                    continue;
                }
                $row->image_files = null;
                if ($hasStatus) {
                    $row->image_status = null;
                    $row->image_completed_at = null;
                }
                if ($hasMcpMarker) {
                    $row->image_mcp_submitted_at = null;
                }
                try {
                    $row->save();
                } catch (\Throwable $e) {
                    continue;
                }
                $md5 = $row->md5 ?? md5($word);
                $out[] = ['word' => $word, 'md5' => $md5];
            }
        }

        return $out;
    }

    private function hasImageStatusColumn(string $langCode): bool
    {
        if (array_key_exists($langCode, $this->imageStatusColumnCache)) {
            return $this->imageStatusColumnCache[$langCode];
        }
        try {
            $model = AppQyV1LangDictionaryModel::forLanguage($langCode)->getModel();
            $has = Schema::connection($model->getConnectionName())
                ->hasColumn($model->getTable(), 'image_status');
        } catch (\Throwable $e) {
            $has = false;
        }
        return $this->imageStatusColumnCache[$langCode] = $has;
    }

    private function hasImageMcpColumn(string $langCode): bool
    {
        if (array_key_exists($langCode, $this->imageMcpColumnCache)) {
            return $this->imageMcpColumnCache[$langCode];
        }
        try {
            $model = AppQyV1LangDictionaryModel::forLanguage($langCode)->getModel();
            $has = Schema::connection($model->getConnectionName())
                ->hasColumn($model->getTable(), 'image_mcp_submitted_at');
        } catch (\Throwable $e) {
            $has = false;
        }
        return $this->imageMcpColumnCache[$langCode] = $has;
    }

    private function countPendingForLanguage(string $langCode): int
    {
        return GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_media')
            ->where('status', GlobalTask::status('pending'))
            ->where('payload->language', $langCode)
            ->count();
    }

    private function pendingWordMd5ForLanguage(string $langCode): array
    {
        $seen = [];
        $tasks = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_media')
            ->where('status', GlobalTask::status('pending'))
            ->where('payload->language', $langCode)
            ->get(['payload']);
        foreach ($tasks as $task) {
            $payload = is_array($task->payload) ? $task->payload : [];
            $items = is_array($payload['words'] ?? null)
                ? $payload['words']
                : [$payload['content'] ?? null];
            foreach ($items as $item) {
                $word = is_array($item) ? ($item['word'] ?? null) : $item;
                $md5 = is_array($item) ? ($item['md5'] ?? null) : null;
                if (is_string($md5) && $md5 !== '') {
                    $seen[$md5] = true;
                } elseif (is_string($word) && $word !== '') {
                    $seen[md5($word)] = true;
                }
            }
        }
        return array_keys($seen);
    }

    private function createTask(string $langCode, array $words): void
    {
        $timeoutSeconds = 60 + (count($words) * 3);
        if ($timeoutSeconds > 600) {
            $timeoutSeconds = 600;
        }

        $payload = [
            'words' => array_values($words),
            'language' => $langCode,
            'target_language' => self::TARGET_LANGUAGE,
            'word_count' => count($words),
        ];
        // word_media belongs to the shared image-capability lane. Keep the low
        // background priority while making it claimable by the media-image worker.
        $this->taskManager->createTask(
            'AppQyV1',
            'word_media',
            GlobalTask::executionType('remote_fast'),
            $payload,
            $timeoutSeconds,
            self::PRIORITY_LOW,
            3,
            false,
            GlobalTask::capability('image')
        );
    }
}
