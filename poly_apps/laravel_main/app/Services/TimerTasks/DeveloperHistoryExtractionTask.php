<?php

namespace App\Services\TimerTasks;

use App\Providers\PathMapper;
use App\Services\DeveloperHistory\DeveloperHistoryService;
use App\Services\DeveloperHistory\DevHistoryAssistService;

/**
 * Developer History Extraction Task.
 *
 * Resident-process submodule: every 10s it keeps probing for AI-tool installs
 * and refreshes the history store. The probe is cheap — a discovery pass over
 * file mtimes yields a signature, and the service returns immediately when
 * nothing changed, re-parsing ONLY changed files. Disabled on production hosts.
 */
class DeveloperHistoryExtractionTask extends OctaneTimerTaskAbstract
{
    public function getName(): string
    {
        return 'developer_history_extraction';
    }

    public function getInterval(): int
    {
        return 10; // continuous fast probe
    }

    public function isEnabled(): bool
    {
        // Developer/desktop hosts only — never registers on production servers.
        return PathMapper::hasDesktopEnvironment() || PathMapper::isWSL();
    }

    public function exec(): void
    {
        try {
            (new DeveloperHistoryService())->extract(false);
        } catch (\Throwable $e) {
            $this->logError('Developer history extraction failed', ['error' => $e->getMessage()]);
        }

        // Auto-dispatch translation assist for new non-English prompts (deduped,
        // capped per run). Isolated so a queue/DB hiccup never breaks extraction.
        try {
            (new DevHistoryAssistService())->scanAndEnqueue();
        } catch (\Throwable $e) {
            $this->logError('Developer history assist dispatch failed', ['error' => $e->getMessage()]);
        }
    }
}
