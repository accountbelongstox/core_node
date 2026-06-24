<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * Contract for a single AI-dev-tool history extractor.
 *
 * Split into cheap discovery (list source files + mtimes, no parsing) and
 * per-source parsing, so the resident scanner can re-parse ONLY changed files.
 */
interface ExtractorInterface
{
    /**
     * Short tool identifier used for classification (e.g. 'claude', 'codex').
     */
    public function tool(): string;

    /**
     * Cheaply list the source files for one user home (no parsing).
     *
     * @return array<int, array{path: string, mtime: int, bytes: int}>
     */
    public function discover(string $home, string $user): array;

    /**
     * Parse ONE source file into zero or more normalized session records.
     *
     * @return array<int, array<string, mixed>>
     */
    public function parseSource(string $path, string $user): array;
}
