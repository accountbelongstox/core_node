<?php

namespace App\Services\TimerTasks;

use App\Services\UserConfig\UserConfigService;

use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;

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
class AppQyV1WordMediaScanTask extends DiffQueueFeederTaskAbstract
{
    private const PRIORITY_LOW = 0;
    private const TARGET_LANGUAGE = 'zh';
    private const WORDS_PER_TASK = 40;
    private const MAX_TASKS_PER_LANGUAGE = 2;

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
        return (bool) app(UserConfigService::class)->get(UserConfigService::APPQYV1_MEDIA_SCAN, true);
    }

    public function exec(): void
    {
        $languages = AppQyV1DictionaryService::scanAvailableLanguages();
        if ($languages === []) {
            return;
        }

        $totalCreated = 0;

        foreach ($languages as $langCode) {
            // Don't pile up: skip languages that already have enough pending
            // background word_media tasks.
            $pendingCount = $this->countPendingForLanguage($langCode);
            if ($pendingCount >= self::MAX_TASKS_PER_LANGUAGE) {
                continue;
            }

            $limit = self::WORDS_PER_TASK * (self::MAX_TASKS_PER_LANGUAGE - $pendingCount);
            $model = AppQyV1LangDictionaryModel::forLanguage($langCode)->getModel();
            $scope = 'word_media:' . $langCode . ':' . $model->getTable();
            $page = $this->rowsForPendingPage(
                $scope,
                $model,
                $limit,
                static fn (array $ids): array => AppQyV1LangDictionaryModel::translatedWordsMissingImages(
                    $langCode,
                    $ids
                )
            );
            if ($page['rows'] === [] && ($page['page'] ?? 0) === 0) {
                continue;
            }
            try {
                foreach (array_chunk($page['rows'], self::WORDS_PER_TASK) as $chunk) {
                    $this->createTask($langCode, $chunk);
                    $totalCreated++;
                }
                $this->consumePendingPage($scope, $page);
            } catch (\Throwable $e) {
                $this->logWarning('Background word_media page failed', [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background mcp-chrome word_media tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    private function countPendingForLanguage(string $langCode): int
    {
        return $this->liveTaskCount('word_media', $langCode);
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
