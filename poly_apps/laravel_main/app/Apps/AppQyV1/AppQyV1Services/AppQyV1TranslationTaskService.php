<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Services\TaskManagerService;
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use Illuminate\Support\Facades\Log;

class AppQyV1TranslationTaskService
{
    private $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    /**
     * Create dictionary explanation task for words without explanations
     * Backend always returns REAL untranslated words from database
     * Frontend Worker decides whether to submit in demo mode or real mode
     *
     * @param string $language Language name (e.g., 'english', 'japanese', 'korean')
     * @param int $limit Maximum number of words per task
     * @return array Created task information
     */
    public function createDictionaryExplanationTask(
        string $language = 'english',
        int $limit = 50
    ): array {
        $untranslatedWords = AppQyV1DictionaryService::getUntranslatedWords($language, $limit);

        if (empty($untranslatedWords)) {
            return [
                'status' => 'no_words_needed',
                'message' => 'No words need explanations',
                'word_count' => 0,
            ];
        }

        // Always use real task type - backend never creates demo tasks
        $taskType = 'dictionary_explanation';
        $timeoutSeconds = 60 + (count($untranslatedWords) * 3);

        if ($timeoutSeconds > 600) {
            $timeoutSeconds = 600;
        }

        // Payload contains only real data from database
        $payload = [
            'words' => $untranslatedWords,
            'language' => $language,
            'word_count' => count($untranslatedWords),
        ];

        $task = $this->taskManager->createTask(
            'AppQyV1',
            $taskType,
            GlobalTask::EXECUTION_REMOTE_CLIENT,
            $payload,
            $timeoutSeconds,
            50,
            3
        );

        Log::info('[AppQyV1TranslationTaskService] Dictionary explanation task created', [
            'task_id' => $task->task_id,
            'word_count' => count($untranslatedWords),
            'language' => $language,
        ]);

        return [
            'task_id' => $task->task_id,
            'word_count' => count($untranslatedWords),
            'timeout_seconds' => $timeoutSeconds,
            'status' => 'pending',
        ];
    }

    /**
     * Get untranslated words for task creation
     *
     * @param int $limit Limit
     * @return array
     */
    public function getUntranslatedWords(int $limit = 100): array
    {
        $words = AppQyV1DictionaryService::getUntranslatedWords('english', $limit);

        return $words;
    }

    /**
     * Process dictionary explanation result (callback after worker completes)
     *
     * @param string $taskId Task ID
     * @param string $language Language name
     * @param array $explanations Explanation results
     * @param bool $isDemoMode Demo mode flag
     * @return array Processing result
     */
    public function processExplanationResult(
        string $taskId,
        string $language,
        array $explanations,
        bool $isDemoMode = false
    ): array {
        if ($isDemoMode) {
            Log::info('[AppQyV1TranslationTaskService] Demo mode - skipping database write', [
                'task_id' => $taskId,
                'explanation_count' => count($explanations),
            ]);

            return [
                'processed' => count($explanations),
                'skipped' => count($explanations),
                'demo_mode' => true,
            ];
        }

        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $processed = 0;
        $failed = 0;

        foreach ($explanations as $explanation) {
            $word = null;
            if (isset($explanation['word'])) {
                $word = $explanation['word'];
            }

            $md5 = null;
            if (isset($explanation['md5'])) {
                $md5 = $explanation['md5'];
            }

            $explanationText = null;
            if (isset($explanation['explanation'])) {
                $explanationText = $explanation['explanation'];
            }

            if (!$word) {
                $failed++;
                continue;
            }
            if (!$md5) {
                $failed++;
                continue;
            }
            if (!$explanationText) {
                $failed++;
                continue;
            }

            $updateData = [
                'translations' => $explanationText,
                'has_translation' => true,
            ];

            if (isset($explanation['phonetic'])) {
                $updateData['phonetic'] = $explanation['phonetic'];
            }
            if (isset($explanation['us_phonetic'])) {
                $updateData['us_phonetic'] = $explanation['us_phonetic'];
            }
            if (isset($explanation['uk_phonetic'])) {
                $updateData['uk_phonetic'] = $explanation['uk_phonetic'];
            }
            if (isset($explanation['provider'])) {
                $updateData['translation_provider'] = $explanation['provider'];
            }

            AppQyV1MultiLangDictionaryModel::updateWord($langCode, $md5, $updateData);
            $processed++;
        }

        Log::info('[AppQyV1TranslationTaskService] Explanation result processed', [
            'task_id' => $taskId,
            'processed' => $processed,
            'failed' => $failed,
        ]);

        return [
            'processed' => $processed,
            'failed' => $failed,
            'demo_mode' => false,
        ];
    }
}
