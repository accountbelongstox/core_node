<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordTranslationWriteback;
use Illuminate\Support\Facades\Log;

/**
 * Word Validity Task Processor
 *
 * Write-back stage of the batch invalid-word DETECTION lane (word_validity tasks
 * on the dedicated remote_validity execution lane). A chrome web-LLM worker
 * (DeepSeek web by default) classifies a batch of untranslated+unchecked words
 * as real dictionary words vs nonsense AND translates the valid ones in the
 * same pass (2.4: validity and translation are ONE feature). It posts:
 *   { "valid_words":   [ {"word": string, "md5": string, "translation"?: string}, ... ],
 *     "invalid_words": [ {"word": string, "md5": string}, ... ],
 *     "provider": string }
 * Valid entries with a translation are written through the canonical
 * AppQyV1WordTranslationWriteback (fill-missing — an existing translation is
 * never overwritten).
 * (possibly wrapped in a {result:{...}} envelope — chrome workers enrich that
 * way; pycore would post it flat).
 *
 * Each entry is one markValidity() UPDATE keyed by md5. CRITICAL: the writeback
 * keys on the md5 CARRIED in the result (echoed from the task payload), never
 * md5($returnedWord) — an LLM that re-cases a word ("Hello" for stored "hello")
 * would otherwise hash-miss, affect 0 rows, and trip the empty_store gate that
 * downgrades the whole completed batch to failed.
 *
 * Once a word is flipped is_valid=false it is permanently dropped from the
 * translation enqueue (AppQyV1MultiLangDictionaryModel::getWordsNeedingTranslation
 * filters is_valid=true), so the dictionary stops wasting lookups on junk.
 */
class WordValidityTaskProcessor extends AbstractTaskProcessor
{
    protected TaskManagerService $taskManager;

    // Granular reception summary of the LAST processResult() call, surfaced to
    // the worker (via TaskProcessorRegistry::process -> submitResult $outcome):
    // { valid, invalid, stored }.
    protected ?array $lastOutcome = null;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    /** Granular write-back summary of the last processResult() (or null). */
    public function lastWritebackOutcome(): ?array
    {
        return $this->lastOutcome;
    }

    protected function taskTypeRoles(): array
    {
        return ['word_validity'];
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        $this->lastOutcome = null;

        // Chrome workers wrap the payload in {result:{...}}; unwrap so both forms
        // work (mirrors WordTranslationTaskProcessor).
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        $valid = $inner['valid_words'] ?? ($result['valid_words'] ?? []);
        $invalid = $inner['invalid_words'] ?? ($result['invalid_words'] ?? []);
        $langCode = $task->payload['language'] ?? 'en';

        if (!is_array($valid)) {
            $valid = [];
        }
        if (!is_array($invalid)) {
            $invalid = [];
        }

        if (empty($valid) && empty($invalid)) {
            $this->lastOutcome = ['valid' => 0, 'invalid' => 0, 'stored' => 0];
            return 0;
        }

        // Demo-mode tasks never touch the database (mirrors the other processors).
        if ($isDemoMode) {
            $this->lastOutcome = ['valid' => 0, 'invalid' => 0, 'stored' => 0];
            return 0;
        }

        $stored = 0;
        $stored += $this->mark($langCode, $valid, true);
        $stored += $this->mark($langCode, $invalid, false);

        // One feature end-to-end (2.4): valid words carrying a translation are
        // written through the CANONICAL translation write-back, which only
        // fills a MISSING target translation (an existing one is never
        // overwritten) and also marks those rows valid.
        $translationsFilled = 0;
        $translationsToWrite = [];
        foreach ($valid as $e) {
            if (!is_array($e)) {
                continue;
            }
            $word = isset($e['word']) && is_string($e['word']) ? trim($e['word']) : '';
            $translation = isset($e['translation']) && is_string($e['translation']) ? trim($e['translation']) : '';
            if ($word !== '' && $translation !== '') {
                $translationsToWrite[] = ['word' => $word, 'translation' => $translation];
            }
        }
        if (!empty($translationsToWrite) && !$isDemoMode) {
            $targetCode = isset($task->payload['target_language']) && is_string($task->payload['target_language'])
                && trim($task->payload['target_language']) !== ''
                ? trim($task->payload['target_language'])
                : 'zh';
            $provider = isset($inner['provider']) && is_string($inner['provider']) && $inner['provider'] !== ''
                ? $inner['provider']
                : 'word-validity';
            $writeback = AppQyV1WordTranslationWriteback::apply(
                $task->task_id,
                $langCode,
                $targetCode,
                $provider,
                $translationsToWrite
            );
            $translationsFilled = (int) ($writeback['processed'] ?? 0);
        }

        $this->lastOutcome = [
            'valid' => count($valid),
            'invalid' => count($invalid),
            'stored' => $stored,
            'translations_filled' => $translationsFilled,
        ];

        Log::info('Word-validity writeback', [
            'task_id' => $task->task_id,
            'language' => $langCode,
            'valid' => count($valid),
            'invalid' => count($invalid),
            'stored' => $stored,
            'translations_filled' => $this->lastOutcome['translations_filled'] ?? 0,
        ]);

        // stored_count for the result-trust layer: a 0 here trips the empty_store
        // gate and re-routes the task (md5 drift / all-already-checked).
        return $stored;
    }

    /**
     * Mark a verdict-class. Keys each UPDATE on the CARRIED md5 (result entry's
     * md5 field, echoed from the payload) so an LLM re-casing the word cannot
     * hash-miss; falls back to md5($word) only when the worker omitted it.
     *
     * @param array<int,mixed> $entries
     */
    private function mark(string $langCode, array $entries, bool $isValid): int
    {
        $n = 0;
        foreach ($entries as $e) {
            $word = null;
            $md5 = null;
            if (is_array($e)) {
                $word = isset($e['word']) && is_string($e['word']) ? $e['word'] : null;
                $md5 = isset($e['md5']) && is_string($e['md5']) && $e['md5'] !== '' ? $e['md5'] : null;
            } elseif (is_string($e)) {
                $word = $e;
            }
            if ($md5 === null) {
                if (!is_string($word) || $word === '') {
                    continue;
                }
                $md5 = md5($word);
            }
            if (AppQyV1LangDictionaryModel::markValidity($langCode, $md5, $isValid, 'word-validity')) {
                $n++;
            }
        }
        return $n;
    }

}
