<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PhraseExtractionService;
use App\Support\AudioOrchestrationContract;
use App\Support\SchemaGate;

/**
 * Works the sentence phrase gap (docs_fix/DESIGN_PHRASE_PIPELINE.md §4): every
 * phrase_pipeline.extraction.tick_seconds one batch through the AI gateway, or
 * through a pycore phrase_extract task on a fallback code. The per-task run
 * lease of OctaneTimerService keeps one runner across workers.
 */
final class AppQyV1PhraseExtractionTask extends OctaneTimerTaskAbstract
{
    public function getName(): string
    {
        return 'appqyv1_phrase_extraction';
    }

    public function getInterval(): int
    {
        return max(1, (int) AudioOrchestrationContract::phrasePipeline('extraction.tick_seconds'));
    }

    public function getExecutionMode(): string
    {
        return self::EXECUTION_BACKGROUND;
    }

    public function isEnabled(): bool
    {
        return SchemaGate::allowsTimer($this->getName());
    }

    public function exec(): void
    {
        try {
            $outcome = app(AppQyV1PhraseExtractionService::class)->tick();
            if (($outcome['outcome'] ?? AppQyV1PhraseExtractionService::OUTCOME_IDLE) !== AppQyV1PhraseExtractionService::OUTCOME_IDLE) {
                $this->logInfo('phrase extraction tick', $outcome);
            }
        } catch (\Throwable $e) {
            $this->logWarning('phrase extraction tick failed', ['error' => $e->getMessage()]);
        }
    }
}
