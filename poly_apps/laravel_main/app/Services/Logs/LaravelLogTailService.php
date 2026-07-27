<?php

namespace App\Services\Logs;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;

class LaravelLogTailService
{
    /**
     * Read the latest entries from the Laravel log file.
     * 
     * @param string|null $fileId Optional file ID (e.g., 'laravel-2026-07-27'). If null, uses the active log.
     * @param int|null $offset Byte offset to start reading from. If null, reads from the end.
     * @param int $limit Maximum number of entries to return.
     * @param int $maxBytes Maximum number of bytes to read backwards if offset is null.
     * @return array
     */
    public function getLatestLogs(?string $fileId = null, ?int $offset = null, int $limit = 200, int $maxBytes = 262144): array
    {
        $logPath = $this->resolveLogPath($fileId);
        
        if (!File::exists($logPath)) {
            return [
                'success' => false,
                'error' => 'Log file not found',
                'file_id' => $fileId,
            ];
        }

        $fileSize = filesize($logPath);
        $mtime = filemtime($logPath);
        $actualFileId = $fileId ?? $this->getFileIdFromPath($logPath);

        // If offset is provided and valid, read forward from offset
        if ($offset !== null && $offset >= 0 && $offset <= $fileSize) {
            return $this->readForward($logPath, $actualFileId, $offset, $fileSize, $mtime, $limit);
        }

        // Otherwise, read backwards from the end
        return $this->readBackward($logPath, $actualFileId, $fileSize, $mtime, $limit, $maxBytes);
    }

    private function resolveLogPath(?string $fileId): string
    {
        $logDir = storage_path('logs');
        
        if ($fileId) {
            // Sanitize fileId to prevent directory traversal
            $safeFileId = preg_replace('/[^a-zA-Z0-9\-_]/', '', $fileId);
            $path = $logDir . '/' . $safeFileId . '.log';
            if (File::exists($path)) {
                return $path;
            }
        }

        // Default to laravel.log if daily rotation is not used or fileId not found
        $defaultPath = $logDir . '/laravel.log';
        if (File::exists($defaultPath)) {
            return $defaultPath;
        }

        // If daily rotation is used, find the latest laravel-*.log
        $files = File::glob($logDir . '/laravel-*.log');
        if (!empty($files)) {
            rsort($files); // Sort descending to get the latest date
            return $files[0];
        }

        return $defaultPath;
    }

    private function getFileIdFromPath(string $path): string
    {
        return pathinfo($path, PATHINFO_FILENAME);
    }

    private function readForward(string $path, string $fileId, int $offset, int $fileSize, int $mtime, int $limit): array
    {
        if ($offset === $fileSize) {
            return [
                'success' => true,
                'source_updated_at' => date('c', $mtime),
                'next_cursor' => ['file_id' => $fileId, 'offset' => $fileSize],
                'entries' => [],
                'truncated' => false,
                'has_more' => false,
            ];
        }

        $fp = fopen($path, 'r');
        if (!$fp) {
            return ['success' => false, 'error' => 'Could not open log file'];
        }

        fseek($fp, $offset);
        $buffer = '';
        while (!feof($fp)) {
            $buffer .= fread($fp, 8192);
        }
        $newOffset = ftell($fp);
        fclose($fp);

        $entries = $this->parseLogBuffer($buffer);
        
        // If we got more than limit, we truncate (though forward reading usually means we want all new)
        $truncated = false;
        if (count($entries) > $limit) {
            $entries = array_slice($entries, 0, $limit);
            $truncated = true;
            // Note: recalculating exact offset for truncation is complex, 
            // so we just return the end offset and let the client know it might have missed some in the middle.
            // In a real robust tailer, we'd parse line by line and track offsets.
        }

        return [
            'success' => true,
            'source_updated_at' => date('c', $mtime),
            'next_cursor' => ['file_id' => $fileId, 'offset' => $newOffset],
            'entries' => $entries,
            'truncated' => $truncated,
            'has_more' => $truncated,
        ];
    }

    private function readBackward(string $path, string $fileId, int $fileSize, int $mtime, int $limit, int $maxBytes): array
    {
        $fp = fopen($path, 'r');
        if (!$fp) {
            return ['success' => false, 'error' => 'Could not open log file'];
        }

        $readBytes = min($maxBytes, $fileSize);
        $startOffset = $fileSize - $readBytes;
        
        fseek($fp, $startOffset);
        $buffer = fread($fp, $readBytes);
        fclose($fp);

        // If we didn't read from the very beginning, discard the first partial line
        if ($startOffset > 0) {
            $firstNewline = strpos($buffer, "\n");
            if ($firstNewline !== false) {
                $buffer = substr($buffer, $firstNewline + 1);
            }
        }

        $entries = $this->parseLogBuffer($buffer);
        
        // We want the LATEST entries, so we take from the end
        $truncated = false;
        if (count($entries) > $limit) {
            $entries = array_slice($entries, -$limit);
            $truncated = true;
        }

        return [
            'success' => true,
            'source_updated_at' => date('c', $mtime),
            'next_cursor' => ['file_id' => $fileId, 'offset' => $fileSize],
            'entries' => $entries,
            'truncated' => $truncated,
            'has_more' => $startOffset > 0,
        ];
    }

    private function parseLogBuffer(string $buffer): array
    {
        $lines = explode("\n", $buffer);
        $entries = [];
        $currentEntry = null;

        // Regex to match standard Laravel log format: [YYYY-MM-DD HH:MM:SS] channel.LEVEL: message {"context"}
        $pattern = '/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+)\.([A-Z]+): (.*)/';

        foreach ($lines as $line) {
            if (empty(trim($line))) {
                continue;
            }

            if (preg_match($pattern, $line, $matches)) {
                // Save previous entry
                if ($currentEntry) {
                    $entries[] = $this->finalizeEntry($currentEntry);
                }

                // Start new entry
                $timestamp = $matches[1];
                $channel = $matches[2];
                $level = $matches[3];
                $rest = $matches[4];

                // Attempt to extract JSON context at the end of the line
                $context = [];
                $message = $rest;
                
                // Simple heuristic: if it ends with } and contains {, try to parse the last JSON object
                if (str_ends_with(trim($rest), '}')) {
                    $lastBrace = strrpos($rest, '{');
                    if ($lastBrace !== false) {
                        $potentialJson = substr($rest, $lastBrace);
                        $decoded = json_decode($potentialJson, true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $context = $decoded;
                            $message = trim(substr($rest, 0, $lastBrace));
                        }
                    }
                }

                $currentEntry = [
                    'id' => md5($line . uniqid('', true)), // Generate a unique ID
                    'timestamp' => $timestamp,
                    'level' => strtolower($level),
                    'channel' => $channel,
                    'message' => $message,
                    'context' => $context,
                    'trace_id' => $context['trace_id'] ?? null,
                    'raw_lines' => [$line],
                ];
            } else {
                // Append to current entry (e.g., stack trace)
                if ($currentEntry) {
                    $currentEntry['raw_lines'][] = $line;
                }
            }
        }

        // Save last entry
        if ($currentEntry) {
            $entries[] = $this->finalizeEntry($currentEntry);
        }

        return $entries;
    }

    private function finalizeEntry(array $entry): array
    {
        // Combine raw lines into a single message if there are multiple lines (stack trace)
        if (count($entry['raw_lines']) > 1) {
            $entry['message'] .= "\n" . implode("\n", array_slice($entry['raw_lines'], 1));
        }
        
        // Redact sensitive information
        $entry['message'] = $this->redactSensitiveInfo($entry['message']);
        if (!empty($entry['context'])) {
            $entry['context'] = $this->redactContext($entry['context']);
        }

        unset($entry['raw_lines']);
        return $entry;
    }

    private function redactSensitiveInfo(string $text): string
    {
        // Redact Bearer tokens
        $text = preg_replace('/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/i', 'Bearer [REDACTED]', $text);
        
        // Redact absolute paths (basic heuristic for Windows and Linux)
        $text = preg_replace('/([A-Z]:\\\\[^\s]+|\/[a-zA-Z0-9_\-\/]+)/', '[PATH]', $text);
        
        return $text;
    }

    private function redactContext(array $context): array
    {
        $sensitiveKeys = ['password', 'token', 'authorization', 'cookie', 'api_key', 'secret'];
        
        foreach ($context as $key => &$value) {
            if (is_array($value)) {
                $value = $this->redactContext($value);
            } elseif (is_string($key)) {
                foreach ($sensitiveKeys as $sensitiveKey) {
                    if (stripos($key, $sensitiveKey) !== false) {
                        $value = '[REDACTED]';
                        break;
                    }
                }
            }
        }
        
        return $context;
    }
}
