<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Services\MediaIngestService;
use App\Services\QueueCenter\QueueCenterService;
use Illuminate\Support\Facades\Log;

trait AppQyV1SentenceAudioPriorityTrait
{
    /**
     * Raise a sentence's audio priority: keep the row-level move-to-front
     * ticket (the row-based claim fallback and the FE still read tts_priority)
     * and delegate the actual queue ordering — enqueue, fast-lane bump and
     * outbox event — to the queue center (global_tasks).
     *
     * @return array{ok:bool,tts_priority?:int,task_id?:string,already_done?:bool,error?:string}
     */
    public function bumpPriority(
        string $contentId,
        string $language,
        bool $createTask = true,
        bool $interactive = true,
        ?string $text = null,
        bool $emitEvent = true
    ): array {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'error' => 'Unknown or missing language'];
        }
        $sentence = LangSentence::onLang($language)->where('content_id', $contentId)->first();
        if (!$sentence) {
            $textTrimmed = ($text !== null) ? trim($text) : '';
            if ($textTrimmed !== '') {
                $sentence = $this->ensureSentenceRow($contentId, $language, $textTrimmed);
            }
        }
        if (!$sentence) {
            return ['ok' => false, 'error' => 'Sentence not found'];
        }
        $this->reconcilePartialRow($sentence, $language);
        if (!$this->rowNeedsAudioWork($language, $sentence)) {
            return ['ok' => true, 'tts_priority' => (int) ($sentence->tts_priority ?? 0), 'already_done' => true];
        }

        $sentence->tts_requested_at = now();
        if ($sentence->tts_status !== 'processing') {
            $sentence->tts_status = 'pending';
        }
        $ticket = $this->assignFrontTicket($sentence);

        // The queue center owns ordering now. Its moveToHead emits
        // sentence.priority itself, so the local emit below only fires for the
        // paths that do NOT go through moveToHead (non-interactive enqueue or
        // row-only bumps) — preserving the endpoint's event behavior without
        // double-emitting.
        $taskId = null;
        if ($createTask) {
            try {
                $queueCenter = app(QueueCenterService::class);
                $dedupKey = QueueCenterService::dedupKeyFor(
                    QueueCenterService::QUEUE_SENTENCE_AUDIO,
                    $language,
                    $contentId
                );
                $queuePayload = [
                    'text' => (string) $sentence->text,
                    'language' => $language,
                    'content_id' => $contentId,
                    'engine_profile' => $this->sentenceEngineInfo()['profile'],
                    'preferred_engine' => $this->sentenceEngineInfo()['primary'],
                ];
                $result = $queueCenter->schedule(
                    QueueCenterService::QUEUE_SENTENCE_AUDIO,
                    $queuePayload,
                    $dedupKey,
                    $interactive,
                    $emitEvent
                );
                $taskId = isset($result['task_id']) ? (string) $result['task_id'] : null;
                if (!$interactive && $emitEvent) {
                    $this->emitPriorityEvent([
                        'content_id' => $contentId,
                        'language' => $language,
                        'priority' => $ticket,
                        'text' => (string) $sentence->text,
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning('[SentenceAudio] bump task create failed', [
                    'content_id' => $contentId,
                    'language' => $language,
                    'error' => $e->getMessage(),
                ]);
            }
        } elseif ($emitEvent) {
            $this->emitPriorityEvent([
                'content_id' => $contentId,
                'language' => $language,
                'priority' => $ticket,
                'text' => (string) $sentence->text,
            ]);
        }

        return [
            'ok' => true,
            'tts_priority' => $ticket,
            'task_id' => $taskId,
        ];
    }

    /**
     * Batch priority update for the visible reader page. One aggregate SSE
     * event wakes pycore after all rows receive their move-to-front tickets.
     *
     * @param array<int,array{text?:string,language?:string}> $items
     * @return array{ok:bool,queued:int,total:int,items:array<int,array<string,mixed>>}
     */
    public function bumpPriorityBatch(array $items, bool $interactive = true): array
    {
        $queued = 0;
        $total = 0;
        $seen = [];
        $bumpedLanguages = [];
        $receipts = [];
        foreach ($items as $item) {
            $text = isset($item['text']) ? trim((string) $item['text']) : '';
            $language = isset($item['language']) ? (string) $item['language'] : '';
            if ($text === '' || $language === '') {
                continue;
            }
            $contentId = MediaIngestService::computeContentId($text);
            $dedupKey = $language . ':' . $contentId;
            if (isset($seen[$dedupKey])) {
                continue;
            }
            $seen[$dedupKey] = true;
            $total++;
            try {
                $result = $this->bumpPriority($contentId, $language, true, $interactive, $text, false);
                if (($result['ok'] ?? false) === true && !($result['already_done'] ?? false)) {
                    $queued++;
                    $bumpedLanguages[$language] = true;
                    $receipts[] = [
                        'text' => $text,
                        'language' => $language,
                        'content_id' => $contentId,
                        'task_id' => $result['task_id'] ?? null,
                    ];
                }
            } catch (\Throwable $e) {
                Log::warning('[SentenceAudio] batch bump item failed', [
                    'language' => $language,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        if ($queued > 0) {
            $this->emitPriorityEvent([
                'batch' => true,
                'count' => $queued,
                'languages' => array_keys($bumpedLanguages),
            ]);
        }
        return ['ok' => true, 'queued' => $queued, 'total' => $total, 'items' => $receipts];
    }

    private function assignFrontTicket(LangSentence $sentence): int
    {
        return $sentence->getConnection()->transaction(function () use ($sentence) {
            $conn = $sentence->getConnection();
            $table = $sentence->getTable();
            AppQyV1TableMaps::lockTableForFrontTicket($conn, $table);
            $sentence->save();
            $id = $sentence->id;
            $conn->statement(
                "UPDATE {$table} SET tts_priority = (SELECT m FROM (SELECT COALESCE(MAX(tts_priority), 0) + 1 AS m FROM {$table}) x) WHERE id = ?",
                [$id]
            );
            $sentence->refresh();
            return (int) $sentence->tts_priority;
        });
    }

    private function emitPriorityEvent(array $payload): void
    {
        try {
            AppQyV1TranslationEventModel::emit('sentence.priority', $payload);
        } catch (\Throwable $e) {
            Log::warning('[SentenceAudio] sentence.priority emit failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
