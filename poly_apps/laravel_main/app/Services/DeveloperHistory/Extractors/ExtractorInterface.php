<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * Contract for a single AI-dev-tool history extractor.
 *
 * Each extractor knows one tool's on-disk layout (Claude Code, Codex, Gemini,
 * Cursor, ...) and returns normalized session records for a given user home.
 */
interface ExtractorInterface
{
    /**
     * Short tool identifier used for classification (e.g. 'claude', 'codex').
     */
    public function tool(): string;

    /**
     * Extract all sessions for one user home.
     *
     * @param string $home Absolute path to a user home (e.g. /home/kali, /root)
     * @param string $user OS user name owning that home
     * @return array<int, array<string, mixed>> Normalized session records
     */
    public function extract(string $home, string $user): array;
}
