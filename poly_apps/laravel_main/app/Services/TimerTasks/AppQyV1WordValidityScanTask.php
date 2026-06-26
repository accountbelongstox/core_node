<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;

/**
 * Word Validity Auto-Scan (invalid-word detection lane).
 *
 * Background enqueuer that pulls a batch of UNTRANSLATED + NOT-YET-CHECKED words
 * (has_translation=false AND validity_checked_at IS NULL) and hands them to a
 * chrome web-LLM worker (word_validity / remote_validity) which classifies each
 * as a real dictionary word or nonsense. The result-trust writeback then marks
 * is_valid in bulk, so the translation enqueue
 * (AppQyV1MultiLangDictionaryModel::getWordsNeedingTranslation, is_valid=true
 * filter) permanently skips the junk — no wasted translation lookups.
 *
 * Selection keys on validity_checked_at IS NULL, so a once-checked word is never
 * re-pulled (no re-classification storm). query_count DESC prioritises the words
 * users actually hit. The pile-up guard skips a language that already has a
 * pending validity batch.
 *
 * Registered automatically by the auto-discovering OctaneTimerServiceProvider
 * (sys:init wires it in). Default OFF — flip APPQYV1_VALIDITY_SCAN=true to enable.
 */
class AppQyV1WordValidityScanTask extends OctaneTimerTaskAbstract
{
    private const PRIORITY_LOW = 0;
    private const WORDS_PER_TASK = 200;
    private const MAX_RETRIES = 3;

    private $taskManager;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
    }

    public function getName(): string
    {
        return 'appqyv1_word_validity_scan';
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function isEnabled(): bool
    {
        return env('APPQYV1_VALIDITY_SCAN', false);
    }

    public function exec(): void
    {
        $languages = AppQyV1DictionaryService::scanAvailableLanguages();
        if (empty($languages)) {
            return;
        }

        $totalCreated = 0;

        foreach ($languages as $langCode) {
            // Don't pile up: one in-flight validity batch per language is enough.
            if ($this->countPendingForLanguage($langCode) > 0) {
                continue;
            }

            $words = $this->untranslatedUncheckedWords($langCode, self::WORDS_PER_TASK);
            if (empty($words)) {
                continue;
            }

            $this->createTask($langCode, $words);
            $totalCreated++;
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background word_validity tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    /**
     * Untranslated, not-yet-validity-checked words, ranked by query_count.
     * Returns [{word, md5}] — md5 rides through so the writeback keys on the
     * STORED md5 (never md5($returnedWord), which an LLM re-casing would miss).
     */
    private function untranslatedUncheckedWords(string $langCode, int $limit): array
    {
        $out = [];
        $rows = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('has_translation', false)
            ->validityUnchecked()
            ->orderByDesc('query_count')
            ->limit($limit)
            ->get(['content', 'md5']);

        foreach ($rows as $row) {
            $word = $row->content ?? null;
            if (!is_string($word) || $word === '') {
                continue;
            }
            $out[] = ['word' => $word, 'md5' => $row->md5 ?? md5($word)];
        }

        return $out;
    }

    private function countPendingForLanguage(string $langCode): int
    {
        return GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_validity')
            ->whereIn('status', [
                GlobalTask::STATUS_PENDING,
                GlobalTask::STATUS_ASSIGNED,
                GlobalTask::STATUS_PROCESSING,
            ])
            ->where('payload->language', $langCode)
            ->count();
    }

    private function createTask(string $langCode, array $words): void
    {
        $payload = [
            'words' => array_values($words),
            'language' => $langCode,
            'word_count' => count($words),
        ];

        // Dedicated remote_validity lane: the chrome web-LLM validity worker is
        // the only subscriber, so a word_validity task can never be fail-released
        // by a word_translation / prompt_translation worker (retry-burn). capability
        // stays null (routed purely by execution_type + task_type).
        $this->taskManager->createTask(
            'AppQyV1',
            'word_validity',
            GlobalTask::EXECUTION_REMOTE_VALIDITY,
            $payload,
            600,
            self::PRIORITY_LOW,
            self::MAX_RETRIES
        );
    }
}
