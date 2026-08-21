<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Models\GlobalTask;
use App\Services\TaskManagerService;

class AppQyV1WordTranslationQueueService
{
    public const PRIORITY_HIGH = 100;
    public const PRIORITY_ELEVATED = 200;
    public const WORDS_PER_TASK = 40;

    private TaskManagerService $taskManager;
    private AppQyV1TranslationRealtimeService $realtime;

    public function __construct(
        TaskManagerService $taskManager,
        AppQyV1TranslationRealtimeService $realtime
    ) {
        $this->taskManager = $taskManager;
        $this->realtime = $realtime;
    }

    public function stackWords(
        array $rawWords,
        string $language,
        string $targetLanguage,
        int $priority,
        bool $interactive = false,
        string $engine = 'google'
    ): array {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        $words = [];
        $results = [];
        $toQueue = [];
        $taskIds = [];
        $skipped = 0;
        $moved = 0;
        $md5ByWord = [];
        $missingRows = [];

        foreach ($rawWords as $rawWord) {
            $word = trim($rawWord);
            if ($word !== '' && !in_array($word, $words, true)) {
                $words[] = $word;
            }
        }

        $pendingIndex = $this->buildPendingWordIndex($langCode, $targetCode);
        foreach ($words as $word) {
            $md5ByWord[$word] = md5($word);
        }
        $existing = AppQyV1LangDictionaryModel::rowsByHashes(
            $langCode,
            array_values($md5ByWord),
            ['md5', 'translations', 'is_valid']
        )->keyBy('md5');
        $now = now();

        foreach ($words as $word) {
            if (!$existing->has($md5ByWord[$word])) {
                $missingRows[] = [
                    'content' => $word,
                    'md5' => $md5ByWord[$word],
                    'has_translation' => false,
                    'query_count' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }
        if (!empty($missingRows)) {
            AppQyV1LangDictionaryModel::insertRows($langCode, $missingRows);
            AppQyV1LangDictionaryModel::forgetMetricsCache($langCode);
        }

        foreach ($words as $word) {
            $existingEntry = $existing->get($md5ByWord[$word]);
            $translations = $existingEntry ? $existingEntry->translations : null;
            if (is_array($translations) && isset($translations[$targetCode]) && $translations[$targetCode] !== '') {
                $results[] = ['word' => $word, 'status' => 'already_translated'];
                $skipped++;
                continue;
            }
            if ($existingEntry && $existingEntry->is_valid === false) {
                $results[] = ['word' => $word, 'status' => 'skipped_invalid'];
                $skipped++;
                continue;
            }
            if (isset($pendingIndex[$word])) {
                $taskId = $pendingIndex[$word];
                $this->bumpTaskPriority($taskId, $priority);
                if (!in_array($taskId, $taskIds, true)) {
                    $taskIds[] = $taskId;
                }
                $results[] = ['word' => $word, 'status' => 'moved_to_front', 'task_id' => $taskId];
                $moved++;
                continue;
            }
            $toQueue[] = $word;
            $results[] = ['word' => $word, 'status' => 'queued'];
        }

        foreach (array_chunk($toQueue, self::WORDS_PER_TASK) as $chunk) {
            $task = $this->createTask($language, $targetLanguage, $chunk, $priority, $interactive, $engine);
            $taskIds[] = $task->task_id;
            foreach ($results as &$result) {
                if (($result['status'] ?? null) === 'queued' && in_array($result['word'] ?? '', $chunk, true)) {
                    $result['task_id'] = (string) $task->task_id;
                }
            }
            unset($result);
        }

        return [
            'results' => $results,
            'moved' => $moved,
            'queued' => count($toQueue),
            'skipped' => $skipped,
            'task_ids' => $taskIds,
        ];
    }

    public function bumpQueriedWord(string $word, string $language, string $targetLanguage): void
    {
        $word = trim($word);
        if ($word === '' || trim($targetLanguage) === '') {
            return;
        }

        try {
            $this->stackWords([$word], $language, $targetLanguage, self::PRIORITY_ELEVATED);
        } catch (\Throwable $exception) {
            logger()->warning('[TranslationQueue] query bump failed', [
                'word' => $word,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function buildPendingWordIndex(string $langCode, string $targetCode): array
    {
        $index = [];
        $tasks = GlobalTask::pendingPayloadTasksForPair(
            'AppQyV1',
            'word_translation',
            $langCode,
            $targetCode
        );

        foreach ($tasks as $task) {
            $payload = $task->payload;
            if (!is_array($payload)) {
                continue;
            }
            $taskWords = $payload['words'] ?? [];
            if (!is_array($taskWords)) {
                continue;
            }
            foreach ($taskWords as $taskWord) {
                if (is_string($taskWord) && !isset($index[$taskWord])) {
                    $index[$taskWord] = $task->task_id;
                }
            }
        }

        return $index;
    }

    private function bumpTaskPriority(string $taskId, int $priority): void
    {
        $updated = GlobalTask::raisePendingPriority($taskId, $priority);
        if ($updated > 0) {
            $this->realtime->priority($taskId, $priority);
        }
    }

    private function createTask(
        string $language,
        string $targetLanguage,
        array $words,
        int $priority,
        bool $interactive,
        string $engine
    ): GlobalTask {
        $timeoutSeconds = min(600, 60 + (count($words) * 3));
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        $payload = [
            'words' => array_values($words),
            'language' => $langCode,
            'target_language' => $targetCode,
            'word_count' => count($words),
        ];
        $capability = null;
        if ($interactive) {
            $capability = $engine === 'ai'
                ? GlobalTask::capability('ai_translate')
                : GlobalTask::capability('translate');
        }

        $task = $this->taskManager->createTask(
            'AppQyV1',
            'word_translation',
            GlobalTask::executionType('remote_translation'),
            $payload,
            $timeoutSeconds,
            $priority,
            3,
            $interactive,
            $capability
        );
        $this->realtime->queued($task->task_id, $words, $langCode, $targetCode, $priority);

        return $task;
    }
}
