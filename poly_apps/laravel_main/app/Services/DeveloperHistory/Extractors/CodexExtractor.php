<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * OpenAI Codex CLI extractor (paths confirmed via openai/codex docs).
 *
 *   <home>/.codex/sessions/rollout-<ts>-<uuid>.jsonl   per-session rollout (JSONL)
 *   (newer builds bucket by date: sessions/YYYY/MM/DD/rollout-*.jsonl)
 *   <home>/.codex/history.jsonl                        typed-prompt log
 *
 * Each rollout line is a canonical rollout item; newer builds wrap it as
 * {timestamp,type,payload}. First line is a session_meta. Sub-agents are
 * separate rollout files (no in-line sidechain flag).
 */
class CodexExtractor extends AbstractExtractor
{
    public function tool(): string
    {
        return 'codex';
    }

    public function discover(string $home, string $user): array
    {
        $root = $home . '/.codex';
        if (!is_dir($root)) {
            return [];
        }
        $out = [];
        $sessionsDir = $root . '/sessions';
        if (is_dir($sessionsDir)) {
            foreach ($this->findRollouts($sessionsDir) as $file) {
                $out[] = $this->descriptor($file);
            }
        }
        $history = $root . '/history.jsonl';
        if (is_file($history)) {
            $out[] = $this->descriptor($history);
        }
        return $out;
    }

    public function parseSource(string $path, string $user): array
    {
        if (basename($path) === 'history.jsonl') {
            $sess = $this->parseGlobalPrompts($path, $user);
            return $sess !== null ? [$sess] : [];
        }
        $sess = $this->parseRollout($path, $user);
        return $sess !== null ? [$sess] : [];
    }

    /** Recursively collect rollout-*.jsonl files (flat or date-bucketed). */
    private function findRollouts(string $dir, int $depth = 0): array
    {
        if ($depth > 6) {
            return []; // date buckets are YYYY/MM/DD; bound against symlink cycles
        }
        $found = [];
        foreach (@glob($dir . '/*') ?: [] as $path) {
            if (is_dir($path)) {
                if (is_link($path)) {
                    continue;
                }
                $found = array_merge($found, $this->findRollouts($path, $depth + 1));
            } elseif (str_ends_with($path, '.jsonl') && str_contains(basename($path), 'rollout')) {
                $found[] = $path;
            }
        }
        return $found;
    }

    private function parseRollout(string $file, string $user): ?array
    {
        $entries = $this->loadJsonl($file);
        if (empty($entries)) {
            return null;
        }

        $turns = [];
        $prompts = [];
        $sessionId = '';
        $project = '';
        $first = 0;
        $last = 0;

        foreach ($entries as $e) {
            $ts = $this->tsToEpoch($e['timestamp'] ?? null);
            if ($ts > 0) {
                $last = $ts;
                if ($first === 0) {
                    $first = $ts;
                }
            }
            $type = $e['type'] ?? ($e['record_type'] ?? '');
            $payload = $e['payload'] ?? $e;
            $ptype = $payload['type'] ?? '';

            // Only a genuine session_meta record is metadata; do NOT treat any
            // line that merely carries a 'cwd' as meta (would drop its content).
            if ($type === 'session_meta' || $ptype === 'session_meta') {
                $sessionId = $sessionId !== '' ? $sessionId : (string) ($payload['id'] ?? '');
                $project = $project !== '' ? $project : (string) ($payload['cwd'] ?? '');
                continue;
            }
            if ($project === '' && isset($payload['cwd'])) {
                $project = (string) $payload['cwd'];
            }
            if ($ptype === 'message') {
                $role = (string) ($payload['role'] ?? 'assistant');
                $text = $this->extractResponseText($payload['content'] ?? []);
                if (trim($text) === '') {
                    continue;
                }
                if ($role === 'user') {
                    $prompts[] = ['ts' => $ts, 'text' => $this->truncate($text)];
                    $turns[] = $this->turn($ts, 'user', $text);
                } else {
                    $turns[] = $this->turn($ts, 'assistant', $text);
                }
            } elseif ($ptype === 'function_call') {
                $args = json_encode($payload['arguments'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $turns[] = $this->turn($ts, 'tool_use', (string) $args, false, null, (string) ($payload['name'] ?? '?'));
            } elseif ($ptype === 'function_call_output') {
                $turns[] = $this->turn($ts, 'tool_result', (string) ($payload['output'] ?? ''));
            }

            if (count($turns) > self::MAX_TURNS) {
                break;
            }
        }

        if ($sessionId === '') {
            $sessionId = pathinfo($file, PATHINFO_FILENAME);
        }
        if (empty($turns)) {
            return null;
        }

        return $this->session('codex', $user, $sessionId, [
            'project' => $project,
            'firstTs' => $first,
            'lastTs' => $last,
            'source' => $file,
            'prompts' => $prompts,
            'turns' => $turns,
        ]);
    }

    /** Responses-API content[] -> text (input_text/output_text blocks). */
    private function extractResponseText($content): string
    {
        if (is_string($content)) {
            return $content;
        }
        if (!is_array($content)) {
            return '';
        }
        $parts = [];
        foreach ($content as $b) {
            if (is_array($b) && isset($b['text'])) {
                $parts[] = (string) $b['text'];
            } elseif (is_string($b)) {
                $parts[] = $b;
            }
        }
        return implode("\n", $parts);
    }

    private function parseGlobalPrompts(string $src, string $user): ?array
    {
        $rows = $this->loadJsonl($src);
        if (empty($rows)) {
            return null;
        }
        $prompts = [];
        $turns = [];
        $first = 0;
        $last = 0;
        foreach ($rows as $d) {
            $text = trim((string) ($d['text'] ?? ($d['display'] ?? '')));
            if ($text === '') {
                continue;
            }
            $ts = $this->tsToEpoch($d['ts'] ?? ($d['timestamp'] ?? null));
            if ($ts > 0) {
                $last = $ts;
                if ($first === 0) {
                    $first = $ts;
                }
            }
            $prompts[] = ['ts' => $ts, 'text' => $this->truncate($text)];
            $turns[] = $this->turn($ts, 'user', $text);
        }
        if (empty($prompts)) {
            return null;
        }

        return $this->session('codex', $user, 'global-typed-prompts', [
            'project' => '(all projects)',
            'title' => 'Typed prompts (global history.jsonl)',
            'firstTs' => $first,
            'lastTs' => $last,
            'source' => $src,
            'prompts' => $prompts,
            'turns' => $turns,
        ]);
    }
}
