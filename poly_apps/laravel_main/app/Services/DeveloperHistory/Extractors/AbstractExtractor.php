<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * Shared parsing helpers for the dev-tool history extractors.
 *
 * Mirrors the logic of scripts/claude_tools/extract_claude_history.py but emits
 * structured records instead of text. Never throws: bad input yields empty data.
 */
abstract class AbstractExtractor implements ExtractorInterface
{
    /** Hard caps so one runaway session cannot blow up a JSON file / worker. */
    protected const MAX_TURNS = 5000;
    protected const MAX_TEXT = 20000;
    protected const MAX_LINES = 300000;

    /**
     * Parse a JSONL file into an array of associative arrays (bad lines skipped).
     */
    protected function loadJsonl(string $path, int $maxLines = 0): array
    {
        $out = [];
        $count = 0;
        $cap = $maxLines > 0 ? $maxLines : self::MAX_LINES;
        $fh = @fopen($path, 'r');
        if ($fh === false) {
            return $out;
        }
        while (($line = fgets($fh)) !== false) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $obj = json_decode($line, true);
            if (is_array($obj)) {
                $out[] = $obj;
                $count++;
            }
            if ($count >= $cap) {
                break;
            }
        }
        fclose($fh);
        return $out;
    }

    /** Build a discovery descriptor for a source file (no parsing). */
    protected function descriptor(string $path): array
    {
        return ['path' => $path, 'mtime' => (int) @filemtime($path), 'bytes' => (int) @filesize($path)];
    }

    /** Read a whole JSON file (array/object) or null. */
    protected function loadJson(string $path): mixed
    {
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if ($raw === false) {
            return null;
        }
        $data = json_decode($raw, true);
        return $data;
    }

    /** Format an ISO-8601 string or epoch (s/ms) timestamp to local time. */
    protected function fmtTs($ts): string
    {
        $epoch = $this->tsToEpoch($ts);
        return $epoch > 0 ? date('Y-m-d H:i:s', $epoch) : '';
    }

    /** Normalize an ISO-8601 / epoch (s or ms) timestamp to epoch seconds. */
    protected function tsToEpoch($ts): int
    {
        if ($ts === null || $ts === '') {
            return 0;
        }
        if (is_int($ts) || is_float($ts) || (is_string($ts) && ctype_digit($ts))) {
            $num = (float) $ts;
            $secs = $num > 1e12 ? $num / 1000.0 : $num;
            return (int) $secs;
        }
        $parsed = strtotime(str_replace('Z', '+00:00', (string) $ts));
        return $parsed !== false ? $parsed : 0;
    }

    /** Flatten a content value (string or list of blocks) to plain text. */
    protected function stringifyContent($content): string
    {
        if (is_string($content)) {
            return $content;
        }
        if (is_array($content)) {
            $parts = [];
            foreach ($content as $block) {
                if (is_array($block)) {
                    $type = $block['type'] ?? '';
                    if ($type === 'text') {
                        $parts[] = (string) ($block['text'] ?? '');
                    } elseif ($type === 'image') {
                        $parts[] = '[image]';
                    } else {
                        $parts[] = (string) ($block['text'] ?? '');
                    }
                } else {
                    $parts[] = (string) $block;
                }
            }
            return implode("\n", array_filter($parts, static fn ($p) => $p !== ''));
        }
        return '';
    }

    /** Truncate overly long text bodies. */
    protected function truncate(string $text): string
    {
        if (strlen($text) <= self::MAX_TEXT) {
            return $text;
        }
        return substr($text, 0, self::MAX_TEXT) . "\n... [truncated]";
    }

    /**
     * Build a normalized session record from parsed parts.
     *
     * @param array{project?:string,title?:string,firstTs?:int,lastTs?:int,hasSubagent?:bool,models?:array,source:string,prompts:array,turns:array} $p
     */
    protected function session(string $tool, string $user, string $rawId, array $p): array
    {
        $first = $p['firstTs'] ?? 0;
        $last = $p['lastTs'] ?? 0;
        $source = $p['source'];
        return [
            'tool' => $tool,
            'os_user' => $user,
            'raw_id' => $rawId,
            'project' => $p['project'] ?? '',
            'title' => $p['title'] ?? '',
            'started_ts' => $first,
            'started_at' => $first > 0 ? date('Y-m-d H:i:s', $first) : '',
            'ended_at' => $last > 0 ? date('Y-m-d H:i:s', $last) : '',
            'prompt_count' => count($p['prompts']),
            'message_count' => count($p['turns']),
            'has_subagent' => $p['hasSubagent'] ?? false,
            'models' => $p['models'] ?? [],
            'source_path' => $source,
            'source_mtime' => (int) @filemtime($source),
            'bytes' => (int) @filesize($source),
            'prompts' => $p['prompts'],
            'turns' => $p['turns'],
        ];
    }

    /** Build a normalized turn record. */
    protected function turn(int $ts, string $role, string $text, bool $isSubagent = false, ?string $model = null, ?string $name = null): array
    {
        return [
            'ts' => $ts,
            'time' => $ts > 0 ? date('Y-m-d H:i:s', $ts) : '',
            'role' => $role,
            'is_subagent' => $isSubagent,
            'model' => $model,
            'name' => $name,
            'text' => $this->truncate($text),
        ];
    }
}
