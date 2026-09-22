<?php

namespace App\Logging;

use Monolog\Handler\RotatingFileHandler;
use Monolog\LogRecord;

/**
 * Daily rotating handler that owns its own hygiene: before every write it
 * caps the active file by size, and once per minute per process it sweeps
 * the log directory for aged or oversized rotated files and the stale
 * legacy single-channel laravel.log. Idempotent by construction — the sweep
 * only deletes or truncates, never rewrites valid state.
 */
final class SizeCappedRotatingFileHandler extends RotatingFileHandler
{
    private const MAX_BYTES = 10485760;

    private const KEEP_TAIL_BYTES = 1048576;

    private const SWEEP_INTERVAL_SECONDS = 60;

    private const LEGACY_STALE_SECONDS = 86400;

    private int $lastSweep = 0;

    protected function write(LogRecord $record): void
    {
        $this->capActiveFile();
        $this->sweepDirectory();
        parent::write($record);
    }

    private function capActiveFile(): void
    {
        clearstatcache(true, $this->url);
        $size = @filesize($this->url);
        if ($size !== false && $size > self::MAX_BYTES) {
            $this->truncateToTail($this->url);
        }
    }

    private function sweepDirectory(): void
    {
        $now = time();
        if ($now - $this->lastSweep < self::SWEEP_INTERVAL_SECONDS) {
            return;
        }
        $this->lastSweep = $now;

        $directory = dirname($this->url);
        $activeFile = basename($this->getTimedFilename());
        $cutoff = $now - ($this->maxFiles * 86400);

        foreach (glob($directory . DIRECTORY_SEPARATOR . 'laravel*.log') ?: [] as $path) {
            $name = basename($path);
            if ($name === $activeFile) {
                continue;
            }
            clearstatcache(true, $path);
            $size = @filesize($path);
            $mtime = @filemtime($path);
            if ($size === false || $mtime === false) {
                continue;
            }

            if ($name === 'laravel.log') {
                // Legacy single-channel leftover: fresh oversized files are
                // truncated; once stale for a day it is removed outright.
                if ($now - $mtime > self::LEGACY_STALE_SECONDS) {
                    @unlink($path);
                } elseif ($size > self::MAX_BYTES) {
                    $this->truncateToTail($path);
                }
                continue;
            }

            if ($mtime < $cutoff || $size > self::MAX_BYTES) {
                @unlink($path);
            }
        }
    }

    private function truncateToTail(string $path): void
    {
        $tail = '';
        $stream = @fopen($path, 'rb');
        if ($stream !== false) {
            fseek($stream, -self::KEEP_TAIL_BYTES, SEEK_END);
            $tail = (string) stream_get_contents($stream);
            fclose($stream);
        }
        // The handler's own stream is append-mode, so rewriting underneath
        // it is safe: every subsequent write lands at the new end of file.
        @file_put_contents($path, $tail, LOCK_EX);
    }
}
