<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Services\MediaIngestService;
use App\Services\QueueCenter\QueueCenterService;
use Illuminate\Support\Facades\Log;

trait AppQyV1SentenceAudioQueueTrait
{
    public function moveToHead(
        string $contentId,
        string $language,
        bool $createTask = true,
        ?string $text = null,
        bool $emitEvent = true
    ): array {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'error' => 'Unknown or missing language'];
        }
        $sentence = LangSentence::findByContentId($language, $contentId);
        $textTrimmed = $text !== null ? trim($text) : '';
        if ($sentence === null && $textTrimmed !== '') {
            $sentence = $this->ensureSentenceRow($contentId, $language, $textTrimmed);
        }
        if ($sentence === null) {
            return ['ok' => false, 'error' => 'Sentence not found'];
        }

        $this->reconcilePartialRow($sentence, $language);
        if (!$this->rowNeedsAudioWork($language, $sentence)) {
            return ['ok' => true, 'already_done' => true];
        }

        $sentence->tts_requested_at = now();
        if ($sentence->tts_status !== 'processing') {
            $sentence->tts_status = 'pending';
        }
        $sentence->saveRecord();
        if (!$createTask) {
            return ['ok' => true, 'task_id' => null, 'queue_position' => null];
        }

        try {
            $queueCenter = app(QueueCenterService::class);
            $result = $queueCenter->moveToHead(
                QueueCenterService::QUEUE_SENTENCE_AUDIO,
                QueueCenterService::dedupKeyFor(
                    QueueCenterService::QUEUE_SENTENCE_AUDIO,
                    $language,
                    $contentId
                ),
                [
                    'text' => (string) $sentence->text,
                    'language' => $language,
                    'content_id' => $contentId,
                    'engine_profile' => $this->sentenceEngineInfo()['profile'],
                    'preferred_engine' => $this->sentenceEngineInfo()['primary'],
                ],
                $emitEvent
            );
        } catch (\Throwable $exception) {
            Log::warning('[SentenceAudio] queue-head request failed', [
                'content_id' => $contentId,
                'language' => $language,
                'error' => $exception->getMessage(),
            ]);

            return ['ok' => false, 'error' => 'Queue Center task creation failed'];
        }

        return [
            'ok' => true,
            'task_id' => $result['task_id'] ?? null,
            'queue_position' => isset($result['queue_position'])
                ? (int) $result['queue_position']
                : null,
            'status' => $result['status'] ?? null,
            'head_action' => $result['head_action'] ?? null,
        ];
    }

    public function moveToHeadBatch(array $items): array
    {
        $normalized = [];
        foreach ($items as $item) {
            $text = isset($item['text']) ? trim((string) $item['text']) : '';
            $language = isset($item['language'])
                ? AppQyV1TableMaps::normalizeLangCode((string) $item['language'])
                : '';
            if ($text === '' || $language === '') {
                continue;
            }
            $contentId = MediaIngestService::computeContentId($text);
            $normalized[$language . ':' . $contentId] = [
                'text' => $text,
                'language' => $language,
                'content_id' => $contentId,
            ];
        }

        $receipts = [];
        $queued = 0;
        foreach (array_reverse(array_values($normalized)) as $item) {
            $result = $this->moveToHead(
                $item['content_id'],
                $item['language'],
                true,
                $item['text'],
                true
            );
            $ok = (bool) ($result['ok'] ?? false);
            $alreadyDone = (bool) ($result['already_done'] ?? false);
            if ($ok && !$alreadyDone) {
                $queued++;
            }
            $receipts[] = [
                'success' => $ok,
                'status' => $alreadyDone ? 'already_available' : ($ok ? 'laravel_received' : 'failed'),
                'text' => $item['text'],
                'language' => $item['language'],
                'content_id' => $item['content_id'],
                'task_id' => $result['task_id'] ?? null,
                'queue_position' => $result['queue_position'] ?? null,
                'head_action' => $result['head_action'] ?? null,
                'error' => $result['error'] ?? null,
            ];
        }

        return [
            'ok' => true,
            'queued' => $queued,
            'total' => count($normalized),
            'items' => array_reverse($receipts),
        ];
    }

}
