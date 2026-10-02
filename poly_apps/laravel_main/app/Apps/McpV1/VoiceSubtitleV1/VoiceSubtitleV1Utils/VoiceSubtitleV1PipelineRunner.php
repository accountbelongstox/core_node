<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

/**
 * Background half of a voice-subtitle task: the request only records the task
 * (202); the octane-timer background lane advances every live task one pass
 * per tick. A pass that reaches a live pycore task stores its checkpoint and
 * resumes on a later tick, so no worker waits on pycore. Any step failure ends
 * the task as failed with that step's reason (VoiceSubtitleTaskManager::runPipeline).
 */
final class VoiceSubtitleV1PipelineRunner
{
    private const TICK_TASK_LIMIT = 20;
    private const TICK_BUDGET_SECONDS = 20;

    private VoiceSubtitleTaskManager $taskManager;
    private SubtitleQueueManager $queueManager;
    private VoiceSubtitleV1PathSanitizer $paths;

    public function __construct()
    {
        $this->taskManager = new VoiceSubtitleTaskManager();
        $this->queueManager = SubtitleQueueManager::getInstance();
        $this->paths = new VoiceSubtitleV1PathSanitizer();
    }

    /** @return int tasks advanced this tick */
    public function tick(): int
    {
        $deadline = microtime(true) + self::TICK_BUDGET_SECONDS;
        $advanced = 0;

        foreach ($this->taskManager->liveTaskIds(self::TICK_TASK_LIMIT) as $taskId) {
            if (microtime(true) > $deadline) {
                break;
            }
            $this->advance((string) $taskId);
            $advanced++;
        }

        return $advanced;
    }

    public function advance(string $taskId): void
    {
        $task = $this->taskManager->getTask($taskId);
        $pipeline = $task['payload'][VoiceSubtitleTaskManager::PIPELINE_KEY] ?? null;
        $processor = new VoiceSubtitleProcessor();

        if ($task === null) {
            return;
        }
        if (!is_array($pipeline['input'] ?? null)) {
            $this->taskManager->failTask($taskId, __('mcp_v1.voice_subtitle.pipeline_input_missing', ['task_id' => $taskId]));
            return;
        }
        $processor->resume(is_array($pipeline['checkpoint'] ?? null) ? $pipeline['checkpoint'] : []);
        $this->taskManager->runPipeline($taskId, function () use ($taskId, $pipeline, $processor): void {
            try {
                $this->process($taskId, $pipeline['input'], $processor);
            } catch (VoiceSubtitleV1PipelineSuspended $suspended) {
                $this->taskManager->savePipelineCheckpoint($taskId, $processor->checkpoint());
            }
        });
    }

    private function process(string $taskId, array $input, VoiceSubtitleProcessor $processor): void
    {
        $item = null;
        $queueItem = null;

        if (($this->taskManager->getTask($taskId)['status'] ?? null) !== 'processing') {
            $this->taskManager->updateStatus($taskId, 'processing');
        }
        $processor->setProgressReporter(function ($step, $status, $message = null, $meta = []) use ($taskId) {
            $this->taskManager->markStep($taskId, $step, $status, $message, $meta);
        });

        $item = $processor->processInput(
            (string) $input['type'],
            (string) $input['content'],
            (string) $input['language'],
            (string) $input['voice'],
            $input['target_language'] ?? null
        );

        if (!$item) {
            throw new \RuntimeException(__('mcp_v1.voice_subtitle.queue_item_failed'));
        }

        $this->taskManager->markStep($taskId, 'queue_append', 'running', 'Appending item to playback queue');
        $queueItem = $this->queueManager->addItem($item, (string) $input['group']);
        $this->taskManager->markStep($taskId, 'queue_append', 'completed', 'Item added to queue', [
            'queue_item_id' => $queueItem['id'],
        ]);

        $this->taskManager->completeTask($taskId, [
            'queue_item_id' => $queueItem['id'],
            'queue_length' => $this->queueManager->getQueueLength(),
        ], $this->paths->queueItem($queueItem));
    }
}
