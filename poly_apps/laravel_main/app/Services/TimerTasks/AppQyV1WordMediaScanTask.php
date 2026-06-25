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
 * It enqueues word_media tasks (EXECUTION_REMOTE_CLIENT — the chrome Bing
 * worker) whose single lookup pass fills the image (and re-confirms translation
 * fill-missing). Selection honors the project rules:
 *   - has_translation = true   (缺图片 only under the premise of a translation)
 *   - is_valid = true          (never touch invalid / placeholder words)
 *   - no image on the row yet   (image_files empty)
 *   - image_status NOT terminal (NULL / not in ['completed','none']) — so a word
 *     Bing was already checked for and has NO images (image_status='none') is
 *     never re-queued.
 *
 * Registered automatically by the auto-discovering OctaneTimerServiceProvider
 * (sys:init wires it in). Default OFF — flip APPQYV1_MEDIA_SCAN=true to enable.
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
        // Default OFF: the on-query path (AppQyV1WordMediaService) already enqueues
        // word_media for visible words; flip APPQYV1_MEDIA_SCAN=true to also scan
        // the whole dictionary for translated-but-image-less words in the
        // background.
        return env('APPQYV1_MEDIA_SCAN', false);
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
            $words = $this->translatedWordsMissingImages($langCode, $limit);
            if (empty($words)) {
                continue;
            }

            foreach (array_chunk($words, self::WORDS_PER_TASK) as $chunk) {
                $this->createTask($langCode, $chunk);
                $totalCreated++;
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background word_media (missing-image) tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    /**
     * Translated, valid words that still lack an image and are NOT terminal
     * (image_status NULL or not in ['completed','none']). Returns [{word,md5}].
     */
    private function translatedWordsMissingImages(string $langCode, int $limit): array
    {
        $hasStatus = $this->hasImageStatusColumn($langCode);
        $out = [];

        // Branch A — never-fetched / pending: empty image_files and NOT a terminal
        // verdict. Nested closure so the image_status predicate is ANDed under
        // has_translation/is_valid (a top-level orWhere would drop those guards).
        $qa = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('has_translation', true)
            ->where('is_valid', true)
            ->where(function ($q) {
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
        foreach ($qa->orderByDesc('query_count')->limit($limit)->get(['content', 'md5']) as $row) {
            $word = $row->content ?? null;
            if (is_string($word) && $word !== '') {
                $out[] = ['word' => $word, 'md5' => $row->md5 ?? md5($word)];
            }
        }

        // Branch B — REPAIR: rows that CLAIM images (non-empty image_files,
        // image_status='completed') but whose STATIC FILE is gone. This is exactly
        // the user's "翻译中标识有图但静态文件不存在" case, which Branch A (empty
        // image_files only) cannot catch and the on-demand path treats as settled.
        // Detect via resolveImageUrl()===null (the is_file check), then revert the
        // row to never-checked (image_files/image_status null) so the writeback's
        // fill-missing re-stores on the next scrape. Bounded by $limit.
        if ($hasStatus && count($out) < $limit) {
            $media = new AppQyV1WordMediaService();
            $candidates = AppQyV1LangDictionaryModel::forLanguage($langCode)
                ->where('has_translation', true)
                ->where('is_valid', true)
                ->where('image_status', 'completed')
                ->whereNotNull('image_files')
                ->orderByDesc('query_count')
                ->limit($limit)
                ->get();
            foreach ($candidates as $row) {
                if (count($out) >= $limit) {
                    break;
                }
                // Intact file on disk -> not missing, leave it.
                if ($media->resolveImageUrl($row) !== null) {
                    continue;
                }
                $word = $row->content ?? null;
                if (!is_string($word) || $word === '') {
                    continue;
                }
                $row->image_files = null;
                $row->image_status = null;
                $row->image_completed_at = null;
                try {
                    $row->save();
                } catch (\Throwable $e) {
                    continue;
                }
                $out[] = ['word' => $word, 'md5' => $row->md5 ?? md5($word)];
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

    private function countPendingForLanguage(string $langCode): int
    {
        return GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_media')
            ->where('status', GlobalTask::STATUS_PENDING)
            ->where('payload->language', $langCode)
            ->count();
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

        $this->taskManager->createTask(
            'AppQyV1',
            'word_media',
            GlobalTask::EXECUTION_REMOTE_CLIENT,
            $payload,
            $timeoutSeconds,
            self::PRIORITY_LOW,
            3
        );
    }
}
