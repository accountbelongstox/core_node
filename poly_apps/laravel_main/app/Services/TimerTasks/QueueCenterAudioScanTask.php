<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Models\GlobalTask;
use App\Models\LangSentence;
use App\Services\QueueCenter\QueueCenterService;

/**
 * Queue Center Audio Scan (word_audio + sentence_audio feeder).
 *
 * Every 60s scans the canonical tables for rows still missing audio and
 * batch-enqueues them into the queue center (global_tasks) via
 * QueueCenterService::enqueue. Dedup on group_key prevents queue growth: a
 * row already covered by a live task is skipped (created=false), so the scan
 * is safe to run forever.
 *
 *   - words:     mirrors the worker claim selection
 *                (AppQyV1DictionaryTTSCoordinator::pendingWordsQuery — pending,
 *                unleased, valid, retry budget left), capped per tick.
 *   - sentences: {prefix}_sentences_{lang} rows with has_audio=false, ordered
 *                by tts_priority, capped per tick.
 *
 * Cheap by construction: indexed where-clauses + LIMIT, no per-row file
 * stats, and no writes at all when nothing matches.
 *
 * Registered automatically by the auto-discovering OctaneTimerServiceProvider.
 */
class QueueCenterAudioScanTask extends OctaneTimerTaskAbstract
{
    private const WORDS_PER_TICK = 200;
    private const SENTENCES_PER_TICK = 200;

    private QueueCenterService $queueCenter;
    private AppQyV1DictionaryTTSCoordinator $coordinator;

    public function __construct()
    {
        $this->queueCenter = app(QueueCenterService::class);
        $this->coordinator = new AppQyV1DictionaryTTSCoordinator();
    }

    public function getName(): string
    {
        return 'queue_center_audio_scan';
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function isEnabled(): bool
    {
        return env('QUEUE_CENTER_AUDIO_SCAN', true);
    }

    public function exec(): void
    {
        $wordsCreated = $this->scanWords();
        $sentencesCreated = $this->scanSentences();

        if ($wordsCreated + $sentencesCreated > 0) {
            $this->logInfo('Queue center audio scan enqueued tasks', [
                'word_audio' => $wordsCreated,
                'sentence_audio' => $sentencesCreated,
            ]);
        }
    }

    /**
     * Enqueue word_audio tasks for dictionary rows missing audio.
     *
     * @return int Number of NEW tasks created (dedup skips are not counted)
     */
    private function scanWords(): int
    {
        $processed = 0;
        $created = 0;

        foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
            if ($processed >= self::WORDS_PER_TICK) {
                break;
            }

            try {
                $model = AppQyV1LangDictionaryModel::forLanguage($lang)->getModel();
                if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                    continue;
                }

                $rows = $this->coordinator->pendingWordsQuery($lang)
                    ->limit(self::WORDS_PER_TICK - $processed)
                    ->get(['id', 'content', 'md5', 'tts_priority']);
            } catch (\Throwable $e) {
                $this->logWarning('Word scan skipped language', [
                    'language' => $lang,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }

            foreach ($rows as $row) {
                $processed++;
                $word = trim((string) ($row->content ?? ''));
                if ($word === '') {
                    continue;
                }
                $md5 = (string) ($row->md5 ?? '') !== '' ? (string) $row->md5 : md5($word);

                try {
                    $result = $this->queueCenter->enqueue(
                        QueueCenterService::QUEUE_WORD_AUDIO,
                        [
                            'word' => $word,
                            'language' => $lang,
                            'md5' => $md5,
                            'dict_row_id' => (int) $row->id,
                        ],
                        QueueCenterService::dedupKeyFor(QueueCenterService::QUEUE_WORD_AUDIO, $lang, $md5),
                        false,
                        [
                            'dict_row_id' => (int) $row->id,
                            'dict_language' => $lang,
                            'dict_row_table' => $model->getTable(),
                        ],
                        // Background enqueue stays below the FAST tier so scan
                        // rows never inflate pending_urgent; a genuine bump is
                        // applied later by moveToHead.
                        min((int) ($row->tts_priority ?? 0), GlobalTask::priority('fast') - 1),
                        300
                    );
                    if ($result['created']) {
                        $created++;
                    }
                } catch (\Throwable $e) {
                    $this->logWarning('Word enqueue failed', [
                        'language' => $lang,
                        'md5' => $md5,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return $created;
    }

    /**
     * Enqueue sentence_audio tasks for sentence rows with has_audio=false.
     *
     * @return int Number of NEW tasks created (dedup skips are not counted)
     */
    private function scanSentences(): int
    {
        $processed = 0;
        $created = 0;

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            if ($processed >= self::SENTENCES_PER_TICK) {
                break;
            }

            try {
                $model = LangSentence::for($lang);
                if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                    continue;
                }

                $rows = LangSentence::onLang($lang)
                    ->where('has_audio', false)
                    ->orderByDesc('tts_priority')
                    ->orderBy('id')
                    ->limit(self::SENTENCES_PER_TICK - $processed)
                    ->get(['content_id', 'text', 'tts_priority']);
            } catch (\Throwable $e) {
                $this->logWarning('Sentence scan skipped language', [
                    'language' => $lang,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }

            foreach ($rows as $row) {
                $processed++;
                $contentId = trim((string) ($row->content_id ?? ''));
                $text = trim((string) ($row->text ?? ''));
                if ($contentId === '' || $text === '') {
                    continue;
                }

                try {
                    $result = $this->queueCenter->enqueue(
                        QueueCenterService::QUEUE_SENTENCE_AUDIO,
                        [
                            'text' => $text,
                            'language' => $lang,
                            'content_id' => $contentId,
                        ],
                        QueueCenterService::dedupKeyFor(QueueCenterService::QUEUE_SENTENCE_AUDIO, $lang, $contentId),
                        false,
                        [],
                        min((int) ($row->tts_priority ?? 0), GlobalTask::priority('fast') - 1),
                        120
                    );
                    if ($result['created']) {
                        $created++;
                    }
                } catch (\Throwable $e) {
                    $this->logWarning('Sentence enqueue failed', [
                        'language' => $lang,
                        'content_id' => $contentId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return $created;
    }
}
